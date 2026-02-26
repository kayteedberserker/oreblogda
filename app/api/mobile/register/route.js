import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import ReferralEvent from "@/app/models/ReferralEvent"; 
import geoip from "geoip-lite";
import crypto from "crypto";
import { sendPushNotification } from "@/app/lib/pushNotifications";

// 🆔 Helper: Generate a unique referral ID
const generateReferralCode = (username) => {
  const prefix = username.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "Z");
  const random = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `ORE-${prefix}-${random}`;
};

export async function POST(req) {
  try {
    await connectDB();
    const { deviceId, username, pushToken, referredBy } = await req.json();

    if (!deviceId || !username || username.trim() === "") {
      return NextResponse.json({ message: "Username is required" }, { status: 400 });
    }

    if (username.trim().toLowerCase().startsWith("admin")) {
      return NextResponse.json({ message: "This callsign is restricted." }, { status: 400 });
    }

    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";
    const geo = geoip.lookup(ip);
    const detectedCountry = geo ? geo.country : "Unknown";

    let user = await MobileUser.findOne({ deviceId });

    if (!user) {
      // 🚀 NEW USER REGISTRATION
      const myNewReferralCode = generateReferralCode(username);
      let finalReferrer = null;
      let auraBonus = 0;
      let boostDate = null;

      const boostExpiry = new Date();
      boostExpiry.setHours(boostExpiry.getHours() + 72);

      if (referredBy && referredBy.trim() !== "") {
        const cleanRef = referredBy.trim();
        const referrer = await MobileUser.findOne({ referralCode: cleanRef });

        if (referrer && referrer.deviceId !== deviceId) {
          finalReferrer = cleanRef;

          // 1. Update Referrer Record
          referrer.invitedUsers.push({ username: username, date: new Date() });
          referrer.referralCount = (referrer.referralCount || 0) + 1;
          referrer.weeklyAura = (referrer.weeklyAura || 0) + 20;
          referrer.coins = (referrer.coins || 0) + 50;
          referrer.doubleStreakUntil = boostExpiry;
          await referrer.save();

          // 🔔 SEND NOTIFICATION TO THE REFERRER
          if (referrer.pushToken) {
            try {
              await sendPushNotification(
                referrer.pushToken,
                "New Recruit Joined! 🌀",
                `${username} has joined your clan via your link. Your 72h boost is active!`,
                { type: "referral_success" }
              );
            } catch (pErr) {
              console.error("Referrer Notification Failed:", pErr);
            }
          }

          auraBonus = 20;
          boostDate = boostExpiry;
          console.log(`📈 Success: ${cleanRef} invited a new operative.`);
        }
      }

      // Create the New User
      user = await MobileUser.create({
        deviceId,
        username,
        pushToken,
        country: detectedCountry,
        referralCode: myNewReferralCode,
        referredBy: finalReferrer,
        coins: 50,
        referralCount: 0,
        weeklyAura: auraBonus,
        doubleStreakUntil: boostDate,
        lastActive: new Date()
      });

      // 🏆 DYNAMIC ROUND CALCULATION & REGISTRATION
      if (finalReferrer) {
        try {
          const referrerDoc = await MobileUser.findOne({ referralCode: finalReferrer }).select("_id");
          if (referrerDoc) {
            
            // 🔄 Check grand total to assign the correct round
            const grandTotal = await ReferralEvent.countDocuments({ status: 'verified' });
            
            let assignedRound = 1;
            if (grandTotal >= 3000) assignedRound = 3;
            else if (grandTotal >= 1000) assignedRound = 3; // Based on your logic
            else if (grandTotal >= 500) assignedRound = 2;

            await ReferralEvent.create({
              referrerId: referrerDoc._id,
              referredId: user._id,
              referredUsername: user.username,
              deviceId: deviceId, 
              round: assignedRound, // 👈 Dynamically tagged
              status: 'verified'
            });
          }
        } catch (eventErr) {
          console.error("ReferralEvent Logging Failed:", eventErr);
        }
      }

    } else {
      // 🔄 EXISTING USER UPDATE
      user.username = username;
      if (pushToken) user.pushToken = pushToken;
      if (!user.referralCode) user.referralCode = generateReferralCode(username);
      if (!user.country || user.country === "Unknown") user.country = detectedCountry;

      user.lastActive = new Date();
      await user.save();
    }

    return NextResponse.json({
      message: "Neural Link Established",
      user
    }, { status: 201 });

  } catch (err) {
    console.error("Registration Error:", err);
    return NextResponse.json({
      message: "Uplink Error",
      error: err.message
    }, { status: 500 });
  }
}

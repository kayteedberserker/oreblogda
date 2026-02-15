import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import geoip from "geoip-lite";
import crypto from "crypto";

// 🆔 Helper: Generate a unique referral ID
const generateReferralCode = (username) => {
  const prefix = username.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "Z");
  const random = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `ORE-${prefix}-${random}`;
};

export async function POST(req) {
  try {
    await connectDB();
    // 📩 Catch 'referredBy' from the request body
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

      // 🕒 Define the Boost Expiry (72 hours from now)
      const boostExpiry = new Date();
      boostExpiry.setHours(boostExpiry.getHours() + 72);

      // Check if they were invited by a valid referral code
      if (referredBy && referredBy.trim() !== "") {
        const cleanRef = referredBy.trim();
        const referrer = await MobileUser.findOne({ referralCode: cleanRef });
        
        // Validation: Referrer must exist AND not be the same device
        if (referrer && referrer.deviceId !== deviceId) {
          finalReferrer = cleanRef;
          referrer.invitedUsers.push({ username: username, date: new Date() });
          // 🎁 Reward the Inviter: +20 Aura and 3-Day Double Streak Boost
          referrer.referralCount = (referrer.referralCount || 0) + 1;
          referrer.weeklyAura = (referrer.weeklyAura || 0) + 20;
          referrer.doubleStreakUntil = boostExpiry; 
          
          await referrer.save();
          
          // Set rewards for the new user
          auraBonus = 20;
          boostDate = boostExpiry;

          console.log(`📈 Success: ${cleanRef} invited a new operative. Boosts applied.`);
        } else {
          console.log(`⚠️ Invalid Referral: Code ${cleanRef} not found or self-referral.`);
        }
      }

      user = await MobileUser.create({ 
        deviceId, 
        username, 
        pushToken,
        country: detectedCountry,
        referralCode: myNewReferralCode, 
        referredBy: finalReferrer,      
        referralCount: 0,
        weeklyAura: auraBonus, // 🔹 +20 Aura immediately if referred
        doubleStreakUntil: boostDate, // 🔹 3-day window for 2X streak
        lastActive: new Date()
      });
    } else {
      // 🔄 EXISTING USER UPDATE
      user.username = username;
      if (pushToken) user.pushToken = pushToken;
      
      if (!user.referralCode) {
        user.referralCode = generateReferralCode(username);
      }

      if (!user.country || user.country === "Unknown") {
        user.country = detectedCountry;
      }

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
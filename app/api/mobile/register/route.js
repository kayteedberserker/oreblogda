import connectDB from "@/app/lib/mongodb";
import { sendPushNotification } from "@/app/lib/pushNotifications";
import MobileUser from "@/app/models/MobileUserModel";
import ReferralEvent from "@/app/models/ReferralEvent";
import crypto from "crypto";
import geoip from "geoip-lite";
import { NextResponse } from "next/server";

// ⚡️ HELPER: Generate secure random suffix for UID
const generateSecureSuffix = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  while (true) {
    suffix = "";
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    // Basic check to avoid 1111 or 1234
    if (!/^(\w)\1+$/.test(suffix) && !"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".includes(suffix)) break;
  }
  return suffix;
};

const generateReferralCode = (username) => {
  const prefix = username.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "Z");
  const random = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `ORE-${prefix}-${random}`;
};

export async function POST(req) {
  try {
    await connectDB();
    // ⚡️ Destructure hardwareId
    const { deviceId, hardwareId, username, pushToken, referredBy, preferences, character } = await req.json();

    if (!deviceId || !username || username.trim() === "") {
      return NextResponse.json({ message: "Neural credentials incomplete." }, { status: 400 });
    }

    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";
    const geo = geoip.lookup(ip);
    const detectedCountry = geo ? geo.country : "Unknown";

    // ⚡️ Master Check: Find how many accounts already exist on this physical hardware
    const existingAccounts = await MobileUser.find({ hardwareId });

    // ⚡️ Check if the SPECIFIC software instance (deviceId) already has an account
    let user = await MobileUser.findOne({ deviceId });

    if (!user) {
      // 🚀 REGISTRATION PHASE

      // 1. Limit Check: Max 3 accounts per hardwareId
      if (existingAccounts.length >= 3) {
        return NextResponse.json({
          message: "SECURITY_PROTOCOL: Device limit reached. Maximum 3 operatives allowed per hardware unit."
        }, { status: 403 });
      }

      // 2. Generate the Public UID (Login ID)
      const suffix = generateSecureSuffix();
      const cleanName = username.trim().toUpperCase().replace(/\s+/g, "_");
      const generatedUid = `ORE-${cleanName}-${suffix}-DA`;

      // 3. Handle Duplicate deviceId for DB uniqueness
      // If this is the 2nd or 3rd account on the same phone, we tweak the deviceId
      let finalDeviceId = deviceId;
      if (existingAccounts.length > 0) {
        finalDeviceId = `${deviceId}-ACC${existingAccounts.length + 1}`;
      }

      const myNewReferralCode = generateReferralCode(username);
      let finalReferrer = null;
      let auraBonus = 0;
      let boostDate = null;
      const boostExpiry = new Date();
      boostExpiry.setHours(boostExpiry.getHours() + 72);

      // Referral Logic
      if (referredBy && referredBy.trim() !== "") {
        const cleanRef = referredBy.trim();
        const referrer = await MobileUser.findOne({ referralCode: cleanRef });

        if (referrer && referrer.hardwareId !== hardwareId) { // Prevent self-referral via multi-account
          finalReferrer = cleanRef;
          referrer.invitedUsers.push({ username: username, date: new Date() });
          referrer.referralCount = (referrer.referralCount || 0) + 1;
          referrer.weeklyAura = (referrer.weeklyAura || 0) + 20;
          referrer.coins = (referrer.coins || 0) + 50;
          referrer.doubleStreakUntil = boostExpiry;
          await referrer.save();

          if (referrer.pushToken) {
            try {
              await sendPushNotification(
                referrer.pushToken,
                "New Recruit Joined! 🌀",
                `${username} joined your clan. 72h boost active!`,
                { type: "referral_success" }
              );
            } catch (pErr) { console.error(pErr); }
          }
          auraBonus = 20;
          boostDate = boostExpiry;
        }
      }

      const defaultWardrobe = [
        { clothingId: 'default_hair', name: 'Standard Hair', type: 'hair', isDefault: true },
        { clothingId: 'default_top', name: 'Recruit Uniform', type: 'top', isDefault: true },
        { clothingId: 'default_pant', name: 'Training Slacks', type: 'pant', isDefault: true },
        { clothingId: 'default_shoe', name: 'Issued Boots', type: 'shoe', isDefault: true },
      ];

      // ⚡️ CREATE NEW ACCOUNT
      user = await MobileUser.create({
        uid: generatedUid,    // The Login ID
        deviceId: finalDeviceId, // Unique for DB
        hardwareId,           // Linked to physical phone
        username,
        pushToken,
        country: detectedCountry,
        referralCode: myNewReferralCode,
        referredBy: finalReferrer,
        preferences,
        character: character || {
          base: { gender: 'male', skinTone: 'medium', name: username },
          equipped: { hair: 'default_hair', top: 'default_top', pant: 'default_pant', shoe: 'default_shoe', action: 'idle' }
        },
        wardrobe: defaultWardrobe,
        coins: 20,
        aura: auraBonus,
        weeklyAura: auraBonus,
        doubleStreakUntil: boostDate,
        lastActive: new Date()
      });

      // Log referral event
      if (finalReferrer) {
        try {
          const referrerDoc = await MobileUser.findOne({ referralCode: finalReferrer }).select("_id");
          if (referrerDoc) {
            await ReferralEvent.create({
              referrerId: referrerDoc._id,
              referredId: user._id,
              referredUsername: user.username,
              deviceId: hardwareId, // Use hardwareId for tracking
              status: 'verified'
            });
          }
        } catch (e) { console.error(e); }
      }

    } else {
      // 🔄 EXISTING USER UPDATE
      user.username = username;
      if (pushToken) user.pushToken = pushToken;
      if (preferences) user.preferences = preferences;
      if (character) user.character = { ...user.character, ...character };
      if (hardwareId) user.hardwareId = hardwareId;

      user.lastActive = new Date();
      await user.save();
    }

    return NextResponse.json({
      message: "Neural Link Established",
      user // Frontend saves user.uid and user.deviceId
    }, { status: 201 });

  } catch (err) {
    console.error("Registration Error:", err);
    return NextResponse.json({ message: "Uplink Error", error: err.message }, { status: 500 });
  }
}
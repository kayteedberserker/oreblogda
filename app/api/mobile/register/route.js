import { sendPillParallel } from "@/app/lib/messagePillService";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import ReferralEvent from "@/app/models/ReferralEvent";
import crypto from "crypto";
import geoip from "geoip-lite";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

const generateSecureSuffix = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let suffix = "";
  while (true) {
    suffix = "";
    for (let i = 0; i < 4; i++) {
      suffix += chars.charAt(Math.floor(Math.random() * chars.length));
    }
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

    const { deviceId, hardwareId, username, pushToken, referredBy, preferences, character } = await req.json();

    if (!deviceId || typeof deviceId !== "string" || !username || username.trim() === "") {
      return NextResponse.json({ message: "Neural credentials incomplete." }, { status: 400 });
    }

    // 1. Check current population for Alpha Lead eligibility
    const currentGlobalUsers = await MobileUser.countDocuments();
    const isEligibleForAlpha = currentGlobalUsers < 400;

    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";
    const geo = geoip.lookup(ip);
    const detectedCountry = geo ? geo.country : "Unknown";

    const existingAccounts = await MobileUser.find({ hardwareId });

    if (existingAccounts.length >= 3) {
      return NextResponse.json({
        message: "SECURITY_PROTOCOL: Device limit reached. Maximum 3 operatives allowed per device."
      }, { status: 403 });
    }

    const suffix = generateSecureSuffix();
    const cleanName = username.trim().toUpperCase().replace(/\s+/g, "_");
    const generatedUid = `ORE-${cleanName}-${suffix}-DA`;

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

    // Initial titles for the new user (Empty by default now)
    const initialUnlockedTitles = [];

    if (referredBy && referredBy.trim() !== "") {
      const cleanRef = referredBy.trim();
      const referrer = await MobileUser.findOne({ referralCode: cleanRef });

      if (referrer && referrer.hardwareId !== hardwareId) {
        finalReferrer = cleanRef;
        referrer.invitedUsers.push({ username: username, date: new Date() });
        referrer.referralCount = (referrer.referralCount || 0) + 1;
        referrer.weeklyAura = (referrer.weeklyAura || 0) + 20;
        referrer.coins = (referrer.coins || 0) + 50;
        referrer.doubleStreakUntil = boostExpiry;

        // 🏆 ALPHA LEAD TITLE LOGIC: Award to REFERRER if total users < 400
        if (isEligibleForAlpha) {
          const alreadyHasAlpha = referrer.unlockedTitles?.some(t => t.name === "Alpha Lead");
          if (!alreadyHasAlpha) {
            const alphaTitle = { name: "Alpha Lead", tier: "LEGENDARY" };
            referrer.unlockedTitles.push(alphaTitle);

            if (referrer.pushToken) {
              try {
                await sendPillParallel(
                  [referrer.pushToken],
                  "Legendary Title Unlocked! 🏆",
                  "You've earned 'Alpha Lead' for expanding the network in its early stages!",
                  { type: "milestone_unlock" },
                  { type: 'achievement', targetId: referrer.uid, singleUser: true }
                );
              } catch (err) { console.error("Alpha Pill Error:", err); }
            }
          }
        }

        // 🎖 RECRUITER TITLE LOGIC: Award only after 2 referrals
        if (referrer.referralCount >= 2) {
          const alreadyHasRecruiter = referrer.unlockedTitles?.some(t => t.name === "The Recruiter");
          if (!alreadyHasRecruiter) {
            const recruiterTitle = { name: "The Recruiter", tier: "RARE" };
            referrer.unlockedTitles.push(recruiterTitle);

            if (referrer.pushToken) {
              try {
                await sendPillParallel(
                  [referrer.pushToken],
                  "Achievement Unlocked! 🎖",
                  "You've earned the title: 'The Recruiter'!",
                  { type: "milestone_unlock" },
                  { type: 'achievement', targetId: referrer.uid, singleUser: true }
                );
              } catch (err) { console.error("Pill Error:", err); }
            }
          }
        }

        await referrer.save();

        if (referrer.pushToken) {
          try {
            await sendPillParallel(
              [referrer.pushToken],
              "New Recruit Joined! 🌀",
              `${username} joined using your referral link. 72h boost active!`,
              { type: "referral_success" },
              { type: 'system', targetId: referrer.uid, singleUser: true }
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

    const accessTokenSecret = process.env.JWT_SECRET;
    const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;

    const initialAccessToken = jwt.sign(
      { userId: finalDeviceId, uid: generatedUid, level: 1 },
      accessTokenSecret,
      { expiresIn: "15m" }
    );

    const initialRefreshToken = jwt.sign(
      { uid: generatedUid },
      refreshTokenSecret,
      { expiresIn: "90d" }
    );

    const user = await MobileUser.create({
      uid: generatedUid,
      deviceId: finalDeviceId,
      hardwareId,
      trustedDevices: [{
        hardwareId: hardwareId,
        deviceId: finalDeviceId,
        addedAt: new Date(),
        lastActive: new Date()
      }],
      activeSessionDeviceId: finalDeviceId,
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
      lastActive: new Date(),
      totalPosts: 0,
      unlockedTitles: initialUnlockedTitles, 
      securityLevel: 1,
      refreshToken: initialRefreshToken
    });

    if (finalReferrer) {
      try {
        const referrerDoc = await MobileUser.findOne({ referralCode: finalReferrer }).select("_id");
        if (referrerDoc) {
          await ReferralEvent.create({
            referrerId: referrerDoc._id,
            referredId: user._id,
            referredUsername: user.username,
            deviceId: hardwareId,
            status: 'verified'
          });
        }
      } catch (e) { console.error(e); }
    }

    return NextResponse.json({
      message: "Neural Link Established",
      accessToken: initialAccessToken,
      refreshToken: initialRefreshToken,
      user: {
        uid: user.uid,
        username: user.username,
        deviceId: user.deviceId,
        securityLevel: user.securityLevel,
        preferences: user.preferences
      }
    }, { status: 201 });

  } catch (err) {
    console.error("Registration Error:", err);
    return NextResponse.json({ message: "Uplink Error", error: err.message }, { status: 500 });
  }
}

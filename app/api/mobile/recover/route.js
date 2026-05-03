import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollower";
import MobileUser from "@/app/models/MobileUserModel";
import geoip from "geoip-lite";
import jwt from "jsonwebtoken";
import sanitize from "mongo-sanitize";
import { NextResponse } from "next/server";
import { z } from "zod";

const loginSchema = z.object({
  recoverId: z.string().min(3),
  hardwareId: z.string().min(5),
  deviceId: z.string().optional(),
  pin: z.string().optional(),
  pushToken: z.string().optional(),
});

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

export async function POST(req) {
  try {
    await connectDB();

    const rawBody = await req.json();
    const cleanBody = sanitize(rawBody);
    const validation = loginSchema.safeParse(cleanBody);

    if (!validation.success) {
      return NextResponse.json({
        message: "Neural Protocol Violation, Incorrect data format.",
        errors: validation.error.format()
      }, { status: 400 });
    }

    const { hardwareId, recoverId, pin, pushToken } = validation.data;
    const cleanRecoverId = recoverId.trim();

    // 1. 🔍 SEARCH USER
    let user = await MobileUser.findOne({
      $or: [
        { uid: cleanRecoverId },
        { deviceId: cleanRecoverId }
      ]
    }).select("+pin +loginAttempts +lockUntil +refreshToken");

    if (!user) {
      return NextResponse.json({ message: "Identity not found." }, { status: 404 });
    }

    // 2. 🛡️ BRUTE-FORCE PROTECTION
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return NextResponse.json({
        message: `SECURITY_LOCKOUT: Try again in ${remainingMinutes} minutes.`
      }, { status: 429 });
    }

    // 3. 🛡️ TRUSTED DEVICES AUTHENTICATION
    const isTrustedDevice = user.trustedDevices.some(device => device.hardwareId === hardwareId);
    const isSameDevice = user.hardwareId === hardwareId;
    // 🛡️ Set this device as active session (logs out other devices)
    user.activeSessionDeviceId = validation.data.deviceId || deviceId;


    if (!isTrustedDevice && !isSameDevice) {
      // New device - require PIN if security level requires it
      if (user.securityLevel >= 2) {
        if (!pin) {
          return NextResponse.json({
            message: "ENCRYPTION_REQUIRED",
            detail: "New device detected. PIN required to add as trusted device."
          }, { status: 401 });
        }

        const isMatch = await user.comparePin(pin);
        if (!isMatch) {
          user.loginAttempts = (user.loginAttempts || 0) + 1;
          if (user.loginAttempts >= 5) {
            user.lockUntil = Date.now() + 30 * 60 * 1000;
          }
          await user.save();
          return NextResponse.json({
            message: "Access Denied. Incorrect PIN.",
            attemptsRemaining: 5 - (user.loginAttempts || 0)
          }, { status: 401 });
        }

        // Success! Add new device to trusted devices
        user.trustedDevices.push({
          hardwareId: hardwareId,
          deviceId: validation.data.deviceId || deviceId,
          addedAt: new Date(),
          lastActive: new Date()
        });
        user.loginAttempts = 0;
        user.lockUntil = null;
      } else {
        return NextResponse.json({
          message: "UNTRUSTED_DEVICE",
          detail: "Set up PIN first (Security Level 2+) to add new devices."
        }, { status: 403 });
      }
    }

    // Update last active for trusted device
    const trustedDeviceIndex = user.trustedDevices.findIndex(device => device.hardwareId === hardwareId);
    if (trustedDeviceIndex !== -1) {
      user.trustedDevices[trustedDeviceIndex].lastActive = new Date();
    }


    // 4. 🛡️ UID GENERATION (For legacy users)
    if (!user.uid) {
      const suffix = generateSecureSuffix();
      const cleanName = (user.username || "Guest").trim().toUpperCase().replace(/\s+/g, "_");
      user.uid = `ORE-${cleanName}-${suffix}-DA`;
    }


    // 5. 🛡️ ANTI-SPAM: Hardware Account Limit (Max 3 accounts per phone)
    const existingAccountsOnHardware = await MobileUser.find({ hardwareId });
    const isAlreadyOnThisHardware = user.hardwareId === hardwareId;
    if (!isTrustedDevice && !isAlreadyOnThisHardware && existingAccountsOnHardware.length >= 3) {
      return NextResponse.json({
        message: "DEVICE_LIMIT: This hardware unit is at maximum capacity (3/3)."
      }, { status: 403 });
    }


    // 6. 🔗 UPDATE METADATA
    if (pushToken) user.pushToken = pushToken;
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";
    const geo = geoip.lookup(ip);
    user.country = user.country && user.country !== "Unknown" ? user.country : (geo ? geo.country : "Unknown");

    user.hasLoggedOut = false;
    user.lastActive = new Date();

    // 7. 🛡️ TOKEN GENERATION (Single Session Enforcement)
    // By saving the refreshToken to the user, we invalidate any previous device
    const accessToken = jwt.sign(
      { userId: user.deviceId, uid: user.uid, level: user.securityLevel },
      process.env.JWT_SECRET,
      { expiresIn: "15m" }
    );

    const refreshToken = jwt.sign(
      { uid: user.uid },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: "90d" }
    );

    user.refreshToken = refreshToken; // Overwrites previous session's token
    await user.save();

    // 8. 🔍 DATA SYNC (Clans)
    const followedClans = await ClanFollower.find({ userId: user._id }).select("clanTag");
    const followedClanTags = followedClans.map(f => f.clanTag);

    // 9. 🛡️ ONBOARDING FLAGS (Skip intro for returning users)
    const onboardingFlags = {
      has_seen_profile_onboarding: true,
      HAS_SEEN_WELCOME: "true",
      HAS_SEEN_CLAN_UPDATE: "true",
      HAS_SEEN_COINS_V3: "true",
      HAS_SEEN_PEAK_V5: "true",
      HAS_SEEN_STORE_V4: "true",
    };

    return NextResponse.json({
      message: "Neural link re-established.",
      accessToken,
      refreshToken,
      user: {
        uid: user.uid,
        username: user.username,
        deviceId: user.deviceId,
        securityLevel: user.securityLevel,
        coins: user.coins,
        aura: user.aura,
        character: user.character
      },
      sessionData: {
        followedClans: followedClanTags,
        ...onboardingFlags
      }
    }, { status: 200 });

  } catch (err) {
    console.error("Login/Recovery Error:", err);
    return NextResponse.json({
      message: "Uplink synchronization failed",
      error: err.message
    }, { status: 500 });
  }
}
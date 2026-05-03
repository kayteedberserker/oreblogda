import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollower";
import MobileUser from "@/app/models/MobileUserModel";
import geoip from "geoip-lite";
import jwt from "jsonwebtoken";
import sanitize from "mongo-sanitize";
import { NextResponse } from "next/server";
import { z } from "zod";

// Let Zod handle the trimming so we don't have to do it manually later
const loginSchema = z.object({
  recoverId: z.string().min(3).trim(),
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

    const { hardwareId, recoverId, pin, pushToken, deviceId } = validation.data;

    // 1. 🔍 SEARCH USER
    // Finds the account associated with the provided UID or Device ID
    let user = await MobileUser.findOne({
      $or: [
        { uid: recoverId },
        { deviceId: recoverId }
      ]
    }).select("+pin +loginAttempts +lockUntil +refreshToken");

    if (!user) {
      return NextResponse.json({ message: "Identity not found." }, { status: 404 });
    }

    // 2. 🛡️ BRUTE-FORCE PROTECTION (Fail Fast)
    // Checks if the user is currently locked out before doing any heavy processing
    if (user.lockUntil && user.lockUntil > Date.now()) {
      const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return NextResponse.json({
        message: `SECURITY_LOCKOUT: Try again in ${remainingMinutes} minutes.`
      }, { status: 429 });
    }

    // 3. 🛡️ ANTI-SPAM: Hardware Account Limit 
    // Prevents abuse by limiting how many unique accounts can log in from a single physical phone
    const existingAccountsOnHardware = await MobileUser.find({ hardwareId }).select('_id');
    const isAlreadyOnThisHardware = existingAccountsOnHardware.some(acc => acc._id.equals(user._id));

    if (!isAlreadyOnThisHardware && existingAccountsOnHardware.length >= 3) {
      return NextResponse.json({
        message: "DEVICE_LIMIT: This hardware unit is at maximum capacity (3/3)."
      }, { status: 403 });
    }

    // 4. 🛡️ TRUSTED DEVICES & PIN AUTHENTICATION
    // Only enforce PIN and Trusted Device checks if the user actually has a PIN setup
    const requiresPinAuth = user.securityLevel >= 2 && user.pin;
    const isTrustedDevice = user.trustedDevices.some(device => device.hardwareId === hardwareId);

    if (requiresPinAuth && !isTrustedDevice) {
      // It's a protected account and an unknown device. Demand a PIN.
      if (!pin) {
        return NextResponse.json({
          message: "ENCRYPTION_REQUIRED",
          detail: "The data of this account has been encrypted, Input PIN to decrypt."
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
          attemptsRemaining: 5 - user.loginAttempts
        }, { status: 401 });
      }

      // Success! Reset attempts and manage the Trusted Devices array
      user.loginAttempts = 0;
      user.lockUntil = null;

      // Enforce max 3 trusted devices: remove the oldest one if at capacity
      if (user.trustedDevices.length >= 3) {
        user.trustedDevices.shift(); // Removes the first item (the oldest)
      }

      user.trustedDevices.push({
        hardwareId: hardwareId,
        deviceId: deviceId || user.deviceId,
        addedAt: new Date(),
        lastActive: new Date()
      });
    } else if (requiresPinAuth && isTrustedDevice) {
      // Device is known, just update its last active timestamp
      const trustedDeviceIndex = user.trustedDevices.findIndex(device => device.hardwareId === hardwareId);
      if (trustedDeviceIndex !== -1) {
        user.trustedDevices[trustedDeviceIndex].lastActive = new Date();
      }
    }
    // If !requiresPinAuth, the logic cleanly skips this entire block and lets them in.

    // 5. 🛡️ UID GENERATION (For legacy users)
    if (!user.uid) {
      const suffix = generateSecureSuffix();
      const cleanName = (user.username || "Guest").trim().toUpperCase().replace(/\s+/g, "_");
      user.uid = `ORE-${cleanName}-${suffix}-DA`;
    }

    // 6. 🔗 UPDATE METADATA
    // Updates session tokens, IPs, and active device states
    if (pushToken) user.pushToken = pushToken;
    user.activeSessionDeviceId = deviceId || user.deviceId; // Fixes the crash bug from original code

    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";
    const geo = geoip.lookup(ip);
    user.country = user.country && user.country !== "Unknown" ? user.country : (geo ? geo.country : "Unknown");

    user.hasLoggedOut = false;
    user.lastActive = new Date();

    // 7. 🛡️ TOKEN GENERATION (Single Session Enforcement)
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

    // 9. 🛡️ ONBOARDING FLAGS
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
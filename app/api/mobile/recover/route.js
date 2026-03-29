import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import geoip from "geoip-lite";
import { NextResponse } from "next/server";

// ⚡️ HELPER: Generate secure random suffix (Re-used for legacy recovery)
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

    const { deviceId, hardwareId, recoverId, pushToken } = await req.json();

    if (!recoverId) {
      return NextResponse.json({ message: "Operative identity is required for recovery" }, { status: 400 });
    }

    const cleanRecoverId = recoverId.trim();

    // 1. 🔍 DUAL-LAYER SEARCH: Check UID first, then legacy deviceId
    let user = await MobileUser.findOne({
      $or: [
        { uid: cleanRecoverId },
        { deviceId: cleanRecoverId } // Support for old users using their UUID
      ]
    });

    if (!user) {
      return NextResponse.json({
        message: "Identity not found. Check your credentials or initiate new registration."
      }, { status: 404 });
    }

    // 2. 🛡️ LEGACY AWAKENING: If they found the account via deviceId but have no UID yet
    if (!user.uid) {
      const suffix = generateSecureSuffix();
      const cleanName = (user.username || "Guest").trim().toUpperCase().replace(/\s+/g, "_");
      user.uid = `ORE-${cleanName}-${suffix}-DA`;
      console.log(`AWAKENED: Legacy user ${user.username} assigned UID: ${user.uid}`);
    }

    // 3. 🛡️ HARDWARE PROTECTION: Check 3-account limit
    const existingAccountsOnHardware = await MobileUser.find({ hardwareId });
    const isAlreadyOnThisHardware = user.hardwareId === hardwareId;

    if (!isAlreadyOnThisHardware && existingAccountsOnHardware.length >= 3) {
      return NextResponse.json({
        message: "DEVICE_LIMIT: This hardware unit is already at maximum capacity (3/3)."
      }, { status: 403 });
    }

    // 4. 🔗 UPDATE NEURAL LINK: Map current app install to the account
    user.deviceId = deviceId;
    user.hardwareId = hardwareId;

    if (pushToken) user.pushToken = pushToken;

    // Geo-Intel Update
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";
    const geo = geoip.lookup(ip);
    const detectedCountry = geo ? geo.country : "Unknown";

    if (!user.country || user.country === "Unknown") {
      user.country = detectedCountry;
    }

    user.lastActive = new Date();
    await user.save();

    // 5. 🚀 RETURN FULL PROFILE
    return NextResponse.json({
      message: "Neural link re-established. Welcome back, Operative.",
      user: {
        uid: user.uid, // Returns the newly generated or existing UID
        username: user.username,
        deviceId: user.deviceId,
        country: user.country,
        pushToken: user.pushToken,
        preferences: user.preferences,
        referredBy: user.referredBy
      }
    }, { status: 200 });

  } catch (err) {
    console.error("Recovery Error:", err);
    return NextResponse.json({
      message: "Uplink synchronization failed",
      error: err.message
    }, { status: 500 });
  }
}
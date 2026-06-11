import connectDB from "@/app/lib/mongodb";
import MobileUserModel from "@/app/models/MobileUserModel";
import UserStreak from "@/app/models/UserStreak";
import { NextResponse } from "next/server";

export async function GET(req) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const fingerprint = searchParams.get("fingerprint");
  // 🛡️ Security Check (brought over from streak route)
  const secret = req.headers.get("x-oreblogda-secret");
  if (secret !== "thisismyrandomsuperlongsecretkey") {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }
  if (!fingerprint) return NextResponse.json({ message: "No ID" }, { status: 400 });
  try {
    // 1. Find or Create User
    let user = await MobileUserModel.findOne({ deviceId: fingerprint }).lean();
    if (!user) {
      let randNum = Math.floor(Math.random() * 10000000);
      const newUser = await MobileUserModel.create({ deviceId: fingerprint, username: `User${randNum}` });
      user = newUser.toObject();
    } else {
      // ⚡️ LAZY DELETION FOR EXPIRED INVENTORY
      if (user.inventory && Array.isArray(user.inventory)) {
        const now = new Date();
        let inventoryNeedsUpdate = false;
        const validInventory = user.inventory.filter(item => {
          if (item.expiresAt && new Date(item.expiresAt) < now) {
            inventoryNeedsUpdate = true;
            return false;
          }
          return true;
        });
        if (inventoryNeedsUpdate) {
          // Fire and forget update (doesn't block the response)
          MobileUserModel.updateOne(
            { _id: user._id },
            { $set: { inventory: validInventory } }
          ).catch(console.error);
          user.inventory = validInventory;
        }
      }
    }
    // 2. Fetch Active Streak
    const streakDoc = await UserStreak.findOne({ userId: user._id }).lean();
    const streakData = {
      streak: streakDoc?.streak || 0,
      lastPostDate: streakDoc?.lastPostDate || null,
      expiresAt: streakDoc?.expiresAt || null,
      canRestore: !streakDoc && (user.lastStreak > 0),
      recoverableStreak: user.lastStreak || 0
    };
    // 3. Return Combined Payload
    return NextResponse.json({
      user: user,
      streak: streakData
    }, { status: 200 });
  } catch (err) {
    console.error("Merged User/Streak Fetch Error:", err);
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}
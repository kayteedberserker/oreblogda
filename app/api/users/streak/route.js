import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import UserStreak from "@/app/models/UserStreak";

export async function POST(req) {
  try {
    await connectDB();

    const { deviceId } = await req.json();
    if (!deviceId)
      return NextResponse.json({ message: "Device ID required" }, { status: 400 });

    const now = new Date();

    // 1️⃣ Find the user
    const user = await MobileUser.findOne({ deviceId });
    if (!user)
      return NextResponse.json({ message: "User not found" }, { status: 404 });

    // 2️⃣ Atomically find streak or create if missing
    let streakDoc = await UserStreak.findOne({ userId: user._id });

    if (!streakDoc) {
      // First post → create streak
      streakDoc = await UserStreak.create({
        userId: user._id,
        streak: 1,
        lastPostDate: now,
        expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000), // 48h TTL
      });

      // Sync lastStreak on user
      await MobileUser.updateOne({ _id: user._id }, { $set: { lastStreak: 1 } });

      return NextResponse.json({
        streak: 1,
        lastPostDate: now.toISOString(),
        message: "First post, streak started!",
      });
    }

    const lastPost = new Date(streakDoc.lastPostDate);
    const hoursSinceLastPost = (now - lastPost) / (1000 * 60 * 60);

    if (hoursSinceLastPost < 24) {
      return NextResponse.json({
        streak: streakDoc.streak,
        lastPostDate: lastPost.toISOString(),
        message: "Posted too soon, streak not increased",
      });
    }

    // ✅ Increment streak
    streakDoc.streak += 1;
    streakDoc.lastPostDate = now;
    streakDoc.expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    // Save streakDoc AND sync lastStreak on user at once
    await Promise.all([
      streakDoc.save(),
      MobileUser.updateOne({ _id: user._id }, { $set: { lastStreak: streakDoc.streak } }),
    ]);

    return NextResponse.json({
      streak: streakDoc.streak,
      lastPostDate: now.toISOString(),
      message: "Streak increased!",
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
  }
}

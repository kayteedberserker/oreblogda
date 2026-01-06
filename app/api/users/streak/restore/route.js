// app/api/streak/restore/route.js
import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import UserStreak from "@/app/models/UserStreak";

export async function POST(req) {
  try {
    await connectDB();

    const { deviceId } = await req.json();
    if (!deviceId) {
      return NextResponse.json(
        { message: "Device ID required" },
        { status: 400 }
      );
    }

    // 1️⃣ Find user
    const user = await MobileUser.findOne({ deviceId });
    if (!user) {
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    // 2️⃣ If active streak exists → block restore
    const existingStreak = await UserStreak.findOne({ userId: user._id });
    if (existingStreak) {
      return NextResponse.json(
        {
          message: "Active streak already exists",
          streak: existingStreak.streak,
        },
        { status: 409 }
      );
    }

    // 3️⃣ Validate backup streak
    const restoreValue = user.lastStreak || 0;
    if (restoreValue <= 0) {
      return NextResponse.json(
        { message: "No streak available to restore" },
        { status: 400 }
      );
    }

    const now = new Date();

    // 4️⃣ Restore streak
    const restoredStreak = await UserStreak.create({
      userId: user._id,
      streak: restoreValue,
      lastPostDate: now,
      expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000), // 48h TTL
    });

    return NextResponse.json({
      message: "Streak restored successfully",
      streak: restoredStreak.streak,
      lastPostDate: now.toISOString().split("T")[0],
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Server error" },
      { status: 500 }
    );
  }
}

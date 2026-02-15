import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import UserStreak from "@/app/models/UserStreak";

export async function POST(req) {
  try {
    await connectDB();
    const { deviceId } = await req.json();
    const now = new Date();

    const user = await MobileUser.findOne({ deviceId });
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    let streakDoc = await UserStreak.findOne({ userId: user._id });

    // ⚡ Determine Boost Amount
    // If doubleStreakUntil exists and hasn't expired yet
    const isBoosted = user.doubleStreakUntil && new Date(user.doubleStreakUntil) > now;
    const incrementAmount = isBoosted ? 2 : 1;

    if (!streakDoc) {
      // First post ever
      streakDoc = await UserStreak.create({
        userId: user._id,
        streak: incrementAmount,
        lastPostDate: now,
        expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000),
      });

      await MobileUser.updateOne({ _id: user._id }, { $set: { lastStreak: streakDoc.streak } });

      return NextResponse.json({
        streak: streakDoc.streak,
        isBoosted,
        message: isBoosted ? "First post! 2X Referral Boost applied!" : "First post, streak started!",
      });
    }

    const lastPost = new Date(streakDoc.lastPostDate);
    const hoursSinceLastPost = (now - lastPost) / (1000 * 60 * 60);

    if (hoursSinceLastPost < 24) {
      return NextResponse.json({
        streak: streakDoc.streak,
        message: "Neural link cooling down. Try again later.",
      });
    }

    // ✅ Apply increment (either +1 or +2)
    streakDoc.streak += incrementAmount;
    streakDoc.lastPostDate = now;
    streakDoc.expiresAt = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    await Promise.all([
      streakDoc.save(),
      MobileUser.updateOne({ _id: user._id }, { $set: { lastStreak: streakDoc.streak } }),
    ]);

    return NextResponse.json({
      streak: streakDoc.streak,
      isBoosted,
      message: isBoosted ? `Double Streak Active! +${incrementAmount} gained.` : "Streak increased!",
    });

  } catch (err) {
    return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
  }
}

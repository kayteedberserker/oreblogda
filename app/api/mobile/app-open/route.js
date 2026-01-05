import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";

export async function POST(req) {
  try {
    await connectDB();

    const { deviceId } = await req.json();
    if (!deviceId) {
      return NextResponse.json({ error: "Missing deviceId" }, { status: 400 });
    }

    const now = new Date();
    const sixtyDaysAgo = new Date(now);
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // 1️⃣ Log app open + update counters
    await MobileUser.updateOne(
      { deviceId },
      {
        $set: { lastActive: now },
        $inc: { appOpens: 1 },
        $push: { activityLog: now }
      },
      { upsert: true }
    );

    // 2️⃣ Remove activity older than 60 days
    await MobileUser.updateOne(
      { deviceId },
      {
        $pull: { activityLog: { $lt: sixtyDaysAgo } }
      }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

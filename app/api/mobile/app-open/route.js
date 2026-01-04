import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";

export async function POST(req) {
  try {
    await connectDB();
    const { deviceId } = await req.json();

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    await MobileUser.updateOne(
      { deviceId },
      { 
        $set: { lastActive: new Date() },
        $inc: { appOpens: 1 },
        // Add the current time to the history array
        $push: { activityLog: new Date() },
        // Automatically remove logs older than 60 days to save space
        $pull: { activityLog: { $lt: sixtyDaysAgo } }
      }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
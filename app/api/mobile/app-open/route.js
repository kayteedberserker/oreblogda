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
    
    // 1 hour threshold for the log/counter
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // 1️⃣ Always update lastActive (Lightweight operation)
    // We do this first or combine it with the check
    const user = await MobileUser.findOneAndUpdate(
      { deviceId },
      { $set: { lastActive: now } },
      { upsert: true, new: false } // Returns the document BEFORE the update
    );

    // 2️⃣ Check if we should log this opening
    // We update activityLog ONLY if:
    // - User is brand new (user is null)
    // - OR the last log entry was more than an hour ago
    const lastLogEntry = user?.activityLog?.[user.activityLog.length - 1];
    const shouldLog = !user || !lastLogEntry || new Date(lastLogEntry) < oneHourAgo;

    if (shouldLog) {
      await MobileUser.updateOne(
        { deviceId },
        {
          $inc: { appOpens: 1 },
          $push: { activityLog: now }
        }
      );

      // 3️⃣ Remove activity older than 60 days (only run during a log event)
      await MobileUser.updateOne(
        { deviceId },
        {
          $pull: { activityLog: { $lt: sixtyDaysAgo } }
        }
      );
    }

    return NextResponse.json({ 
      success: true, 
      activityRecorded: shouldLog,
      lastActiveUpdated: true 
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}

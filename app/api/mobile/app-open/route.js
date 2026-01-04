import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";

export async function POST(req) {
  try {
    await connectDB();
    const { deviceId } = await req.json();

    await MobileUser.updateOne(
      { deviceId },
      { 
        $set: { lastActive: new Date() },
        $inc: { appOpens: 1 } // Increments the new field by 1
      }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
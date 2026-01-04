import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";

export async function POST(req) {
  try {
    await connectDB();
    const { deviceId } = await req.json();

    // Update the lastActive timestamp every time they open the app
    await MobileUser.updateOne(
      { deviceId },
      { $set: { lastActive: new Date() } }
    );

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
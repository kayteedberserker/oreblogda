import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUserModel from "@/app/models/MobileUserModel";

export async function GET(req) {
  await connectDB();
  const { searchParams } = new URL(req.url);
  const fingerprint = searchParams.get("fingerprint");

  if (!fingerprint) return NextResponse.json({ message: "No ID" }, { status: 400 });

  try {
    // Find or Create the user so the profile always exists
    let user = await MobileUserModel.findOne({ deviceId: fingerprint });
    
    if (!user) {
      // If they don't exist in DB yet, create them now
      user = await MobileUserModel.create({ deviceId: fingerprint, username: "Kaytee" });
    }

    return NextResponse.json(user, { status: 200 });
  } catch (err) {
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}
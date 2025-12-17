// backend: /api/mobile/register.js
import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel"; // new model

export async function POST(req) {
  try {
    await connectDB();
    const { deviceId, username } = await req.json();

    if (!deviceId || !username || username.trim() === "") {
      return NextResponse.json({ message: "Username is required" }, { status: 400 });
    }

    // Check if device already exists
    let user = await MobileUser.findOne({ deviceId });
    if (!user) {
      user = await MobileUser.create({ deviceId, username });
    } else {
      // Optional: update username if needed
      user.username = username;
      await user.save();
    }

    return NextResponse.json({ message: "User registered", user }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
  }
}

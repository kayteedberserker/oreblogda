import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";

export async function POST(req) {
  try {
    await connectDB();
    const { deviceId, username, pushToken } = await req.json();

    if (!deviceId || !username || username.trim() === "") {
      return NextResponse.json({ message: "Username is required" }, { status: 400 });
    }

    // 1. Check if this device already exists in our system
    let user = await MobileUser.findOne({ deviceId });

    if (!user) {
      // 2. NEW USER: Create record with username and push token
      user = await MobileUser.create({ 
        deviceId, 
        username, 
        pushToken // Save the "address" for notifications
      });
    } else {
      // 3. EXISTING USER: Update their info
      // We update the pushToken every time they register/login 
      // because tokens can expire or change.
      user.username = username;
      if (pushToken) {
        user.pushToken = pushToken;
      }
      user.lastActive = new Date(); // Keep track of when they last opened the app
      await user.save();
    }

    return NextResponse.json({ 
      message: "User registered successfully", 
      user 
    }, { status: 201 });

  } catch (err) {
    console.error("Registration Error:", err);
    return NextResponse.json({ 
      message: "Server error", 
      error: err.message 
    }, { status: 500 });
  }
}
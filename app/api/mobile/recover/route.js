import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import geoip from "geoip-lite";

export async function POST(req) {
  try {
    await connectDB();
    const { deviceId, pushToken } = await req.json();

    if (!deviceId) {
      return NextResponse.json({ message: "Device ID is required for recovery" }, { status: 400 });
    }

    // 1. Find the existing user by Device ID
    let user = await MobileUser.findOne({ deviceId });

    if (!user) {
      // If no user found, do NOT create a new one. Return error.
      return NextResponse.json({ 
        message: "No account found with this ID. Please check the ID or create a new identity." 
      }, { status: 404 });
    }

    // 2. Update metadata for the recovered user
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";
    const geo = geoip.lookup(ip);
    const detectedCountry = geo ? geo.country : "Unknown";

    if (pushToken) user.pushToken = pushToken;
    
    // Update country if it was previously unknown or missing
    if (!user.country || user.country === "Unknown") {
      user.country = detectedCountry;
    }

    user.lastActive = new Date();
    await user.save();

    // 3. Return the user data (including their original username)
    return NextResponse.json({ 
      message: "Neural link established. Welcome back.", 
      username: user.username, // This sends the old username back to the app
      user 
    }, { status: 200 });

  } catch (err) {
    console.error("Recovery Error:", err);
    return NextResponse.json({ 
      message: "Server error during synchronization", 
      error: err.message 
    }, { status: 500 });
  }
}


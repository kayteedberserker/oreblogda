import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import geoip from "geoip-lite";

export async function POST(req) {
  try {
    await connectDB();
    const { deviceId, username, pushToken } = await req.json();

    if (!deviceId || !username || username.trim() === "") {
      return NextResponse.json({ message: "Username is required" }, { status: 400 });
    }
    if (username.trim().startsWith("Admin")) {
      return NextResponse.json({ message: "Cannot start username with Admin" }, { status: 400 });
    }

    // 1. Get Client IP Address
    // If you are on Vercel, use 'x-vercel-ip-country' for a free speed boost.
    // Otherwise, we use the standard 'x-forwarded-for'.
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";

    // 2. Detect Country
    const geo = geoip.lookup(ip);
    const detectedCountry = geo ? geo.country : "Unknown"; // e.g., "NG", "US"

    // 3. Find or Update User
    let user = await MobileUser.findOne({ deviceId });

    if (!user) {
      // NEW USER
      user = await MobileUser.create({ 
        deviceId, 
        username, 
        pushToken,
        country: detectedCountry // Save detected country on first signup
      });
    } else {
      // EXISTING USER
      user.username = username;
      if (pushToken) user.pushToken = pushToken;
      
      // Update country if it was previously unknown
      if (!user.country || user.country === "Unknown") {
        user.country = detectedCountry;
      }

      user.lastActive = new Date();
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
import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import geoip from "geoip-lite";
import crypto from "crypto";

// 🆔 Helper: Generate a unique referral ID (Keep it consistent with your link format!)
const generateReferralCode = (username) => {
  // Takes first 3 letters of username + 3 random hex chars
  const prefix = username.substring(0, 3).toUpperCase().replace(/[^A-Z]/g, "Z");
  const random = crypto.randomBytes(2).toString("hex").toUpperCase(); // 4 chars total
  return `ORE-${prefix}-${random}`; // Example: ORE-KAY-A1B2
};

export async function POST(req) {
  try {
    await connectDB();
    // 📩 Catch 'referredBy' from the request body
    const { deviceId, username, pushToken, referredBy } = await req.json();

    if (!deviceId || !username || username.trim() === "") {
      return NextResponse.json({ message: "Username is required" }, { status: 400 });
    }
    
    if (username.trim().toLowerCase().startsWith("admin")) {
      return NextResponse.json({ message: "This callsign is restricted." }, { status: 400 });
    }

    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";
    const geo = geoip.lookup(ip);
    const detectedCountry = geo ? geo.country : "Unknown";

    let user = await MobileUser.findOne({ deviceId });

    if (!user) {
      // 🚀 NEW USER REGISTRATION
      const myNewReferralCode = generateReferralCode(username);
      let finalReferrer = null;

      // Check if they were invited by a valid referral code
      if (referredBy && referredBy.trim() !== "") {
        // Find the person who owns this code
        const referrer = await MobileUser.findOne({ referralCode: referredBy.trim() });
        
        // Validation: Referrer must exist AND not be the same device
        if (referrer && referrer.deviceId !== deviceId) {
          finalReferrer = referredBy.trim();
          
          // 🔥 UPDATE REFERRAL COUNT: Reward the inviter
          referrer.referralCount = (referrer.referralCount || 0) + 1;
          
          // OPTIONAL: Add referral bonus points here if you have a balance field
          // referrer.balance = (referrer.balance || 0) + 100; 

          await referrer.save();
          console.log(`📈 Success: ${referredBy} invited a new operative.`);
        } else {
          console.log(`⚠️ Invalid Referral: Code ${referredBy} not found or self-referral.`);
        }
      }

      user = await MobileUser.create({ 
        deviceId, 
        username, 
        pushToken,
        country: detectedCountry,
        referralCode: myNewReferralCode, 
        referredBy: finalReferrer,      
        referralCount: 0,
        lastActive: new Date()
      });
    } else {
      // 🔄 EXISTING USER UPDATE
      user.username = username;
      if (pushToken) user.pushToken = pushToken;
      
      // Give existing users a code if they don't have one from the old system
      if (!user.referralCode) {
        user.referralCode = generateReferralCode(username);
      }

      if (!user.country || user.country === "Unknown") {
        user.country = detectedCountry;
      }

      user.lastActive = new Date();
      await user.save();
    }

    return NextResponse.json({ 
      message: "Neural Link Established", 
      user 
    }, { status: 201 });

  } catch (err) {
    console.error("Registration Error:", err);
    return NextResponse.json({ 
      message: "Uplink Error", 
      error: err.message 
    }, { status: 500 });
  }
}
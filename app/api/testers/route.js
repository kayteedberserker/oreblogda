// app/api/testers/route.js
import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Tester from "@/app/models/TesterSchema";

export async function POST(req) {
  await connectDB();
  try {
    const { email, number } = await req.json();

    // 1. Basic Validation
    if (!email || !email.includes("@")) {
      return NextResponse.json(
        { message: "INVALID CREDENTIALS. THE SYSTEM REQUIRES A VALID EMAIL." }, 
        { status: 400 }
      );
    }

    // 2. Get IP Address
    // Next.js/Vercel stores the client IP in 'x-forwarded-for'
    const forwarded = req.headers.get("x-forwarded-for");
    const ip = forwarded ? forwarded.split(',')[0] : "127.0.0.1";

    // 3. Get Country
    // If on Vercel, they provide the country code automatically
    let country = req.headers.get("x-vercel-ip-country") || "Unknown";

    // Fallback: If country is unknown and not local, use a free lookup
    
    if (country === "Unknown" && ip !== "127.0.0.1") {
      try {
        const geoRes = await fetch(`https://ipapi.co/${ip}/country_name/`);
        if (geoRes.ok) {
          country = await geoRes.text();
        }
      } catch (e) {
        console.error("GEO_LOCATION_ERROR:", e);
      }
    }

    // 4. Create Entry in THE SYSTEM
    const newTester = await Tester.create({ 
      email, 
      number,
      deviceId :country 
    });

    return NextResponse.json({ 
      message: `ACCESS GRANTED. INTEL RECORDED.` 
    }, { status: 201 });

  } catch (err) {
    if (err.code === 11000) {
      return NextResponse.json(
        { message: "DUPLICATE ENTRY DETECTED. YOU ARE ALREADY IN THE SYSTEM." }, 
        { status: 400 }
      );
    }
    console.error("SYSTEM_FAILURE:", err);
    return NextResponse.json(
      { message: "THE SYSTEM ENCOUNTERED A CRITICAL ERROR." }, 
      { status: 500 }
    );
  }
}
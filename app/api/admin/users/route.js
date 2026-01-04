import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";

export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = 20;
    const country = searchParams.get("country");
    const activeOnly = searchParams.get("activeOnly") === "true"; // Parse the toggle
    const skip = (page - 1) * limit;

    let query = {};
    
    // Country Filter
    if (country && country !== "All") query.country = country;

    // Pulse/Active Filter (Active in the last 10 minutes)
    if (activeOnly) {
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
      query.lastActive = { $gte: tenMinutesAgo };
    }

    const [users, total] = await Promise.all([
      MobileUser.find(query).sort({ lastActive: -1 }).skip(skip).limit(limit),
      MobileUser.countDocuments(query)
    ]);

    return NextResponse.json({ 
      users, 
      total, 
      pages: Math.ceil(total / limit) 
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
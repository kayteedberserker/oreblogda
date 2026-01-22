import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";

export async function GET(req) {
  // 🛡️ SECURITY: Verify this is an actual Vercel Cron request
  // Vercel sends a specific header you can check
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await connectDB();

    const now = new Date();
    const currentYear = now.getFullYear();
    // Simple way to get a week number
    const weekNumber = Math.ceil(now.getDate() / 7); 

    // 1️⃣ Find the Top 10 users with Aura > 0
    const leaders = await MobileUser.find({ weeklyAura: { $gt: 0 } })
      .sort({ weeklyAura: -1 })
      .limit(10);

    if (leaders.length === 0) {
      return NextResponse.json({ message: "No Aura activity this week." });
    }

    // 2️⃣ Reset ALL users' previousRank and current weeklyAura
    // We do this first so only the new winners get the rank
    await MobileUser.updateMany({}, { 
      $set: { previousRank: null, weeklyAura: 0 } 
    });

    // 3️⃣ Award the Top Users and Save History
    const awardPromises = leaders.map(async (user, index) => {
      const rank = index + 1;
      
      return MobileUser.updateOne(
        { _id: user._id },
        { 
          $set: { previousRank: rank <= 3 ? rank : null }, // Only track Top 3 for special UI
          $push: { 
            auraHistory: {
              weekNumber: weekNumber,
              year: currentYear,
              points: user.weeklyAura,
              rank: rank
            }
          }
        }
      );
    });

    await Promise.all(awardPromises);

    return NextResponse.json({ 
      success: true, 
      message: `Weekly Tournament Ended. ${leaders.length} users processed.`,
      winner: leaders[0].username 
    });

  } catch (err) {
    console.error("CRON Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}


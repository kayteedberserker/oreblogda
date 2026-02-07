import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import { sendMultiplePushNotifications } from "@/app/lib/pushNotifications";

export async function GET(req) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  
  // LOGGING: Cron Health Check
  console.log("--- Cron Execution Started ---");

  // Verify Cron Secret
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("❌ Auth Match Failed");
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    // Ensure DB is connected
    await connectDB();

    const now = new Date();
    const currentYear = now.getFullYear();
    
    // Calculate Week Number (Standard ISO-like week calculation)
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    const weekNumber = Math.ceil((dayOfYear + 1) / 7);

    // 1️⃣ Find Top 10 Leaders
    const leaders = await MobileUser.find({ weeklyAura: { $gt: 0 } })
      .sort({ weeklyAura: -1 })
      .limit(10);

    if (leaders.length === 0) {
      console.log("ℹ️ No active Aura users found. Resetting state only.");
      await MobileUser.updateMany({}, { $set: { weeklyAura: 0, previousRank: null } });
      return NextResponse.json({ message: "Reset complete, no leaders found." });
    }

    const winnerName = leaders[0].username || "An Elite User";
    const winnerAura = leaders[0].weeklyAura;

    // 2️⃣ Reset Everyone's Weekly Stats
    // Important: We do this before awarding history so the "previousRank" logic is clean
    await MobileUser.updateMany({}, { $set: { previousRank: null, weeklyAura: 0 } });

    // 3️⃣ Award the Top 10 their new ranks and history
    const awardPromises = leaders.map(async (user, index) => {
      const rank = index + 1;
      return MobileUser.updateOne(
        { _id: user._id },
        { 
          $set: { previousRank: rank }, 
          $push: { 
            auraHistory: { 
                weekNumber, 
                year: currentYear, 
                points: user.weeklyAura, 
                rank 
            }
          }
        }
      );
    });
    
    await Promise.all(awardPromises);
    console.log("✅ Database Ranks Updated.");

    // 4️⃣ Global Broadcast Notification
    try {
      const usersWithTokens = await MobileUser.find({ 
        pushToken: { 
          $nin: [null, ""], 
          $exists: true 
        } 
      }).select('pushToken');
      
      if (usersWithTokens.length > 0) {
        const tokens = usersWithTokens.map(u => u.pushToken);
        
        const title = '🏆 Tournament Concluded!';
        const body = `${winnerName} dominated with ${winnerAura} Aura! ⚡ Points reset. Start farming now!`;
        const data = { screen: 'Leaderboard' };

        // Clean utility function for push
        await sendMultiplePushNotifications(tokens, title, body, data);
        console.log(`📡 Notifications sent to ${tokens.length} users.`);
      } else {
        console.log("⚠️ No push tokens found in database.");
      }
    } catch (notifErr) {
      console.error("❌ Notification Phase Error:", notifErr);
      // We don't return error here so the DB reset still counts as a success
    }

    return NextResponse.json({ 
        success: true, 
        winner: winnerName, 
        aura: winnerAura,
        week: weekNumber
    });

  } catch (err) {
    console.error("❌ CRON Critical Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

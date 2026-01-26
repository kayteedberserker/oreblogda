import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import { sendMultiplePushNotifications } from "@/app/lib/pushNotifications";

export async function GET(req) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  
  // LOGGING: Cron Health Check
  console.log("--- Cron Execution Started ---");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("❌ Auth Match Failed");
    return new Response('Unauthorized', { status: 401 });
  }

  
    // 4️⃣ Global Broadcast Notification
    try {
      const usersWithTokens = await MobileUser.find({ 
        pushToken: { $exists: true, $ne: "" } 
      }).select('pushToken');
       console.log(usersWithTokens.length) 
      if (usersWithTokens.length > 0) {
        const tokens = usersWithTokens.map(u => u.pushToken);
        
        const title = '🏆 Tournament Concluded!';
        const body = `THE SYSTEM dominated with 122 Aura points! ⚡ Points has been reset. Start farming now!`;
        const data = { screen: 'Leaderboard' };

        // Use our clean utility function
        await sendMultiplePushNotifications(tokens, title, body, data);
      } else {
        console.log("⚠️ No push tokens found in database.");
      }
    } catch (notifErr) {
      console.error("❌ Notification Phase Error:", notifErr);
    }

    return NextResponse.json({ 
        success: true, 
        winner: winnerName, 
        aura: winnerAura 
    });

  //} catch (err) {
 //   console.error("❌ CRON Critical Error:", err);
   // return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  //}
}

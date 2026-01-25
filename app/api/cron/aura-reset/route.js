import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import { sendPushNotification } from "@/app/lib/pushNotifications";

export async function GET(req) {
  const authHeader = req.headers.get('authorization');
  
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await connectDB();

    const now = new Date();
    const currentYear = now.getFullYear();
    const weekNumber = Math.ceil((((now - new Date(now.getFullYear(), 0, 1)) / 8.64e7) + 1) / 7);

    // 1️⃣ Find Top 10
    const leaders = await MobileUser.find({ weeklyAura: { $gt: 0 } })
      .sort({ weeklyAura: -1 })
      .limit(10);

    if (leaders.length === 0) {
      await MobileUser.updateMany({}, { $set: { weeklyAura: 0, previousRank: null } });
      return NextResponse.json({ message: "Reset complete." });
    }

    const winnerName = leaders[0].username || "A Mysterious User";
    const winnerAura = leaders[0].weeklyAura;

    // 2️⃣ Reset Everyone
    await MobileUser.updateMany({}, { $set: { previousRank: null, weeklyAura: 0 } });

    // 3️⃣ Award Top 10
    const awardPromises = leaders.map(async (user, index) => {
      const rank = index + 1;
      return MobileUser.updateOne(
        { _id: user._id },
        { 
          $set: { previousRank: rank }, 
          $push: { 
            auraHistory: { weekNumber, year: currentYear, points: user.weeklyAura, rank }
          }
        }
      );
    });
    await Promise.all(awardPromises);

    // 4️⃣ 📣 CHUNKED GLOBAL NOTIFICATION
    try {
      const usersWithTokens = await MobileUser.find({ 
        pushToken: { $exists: true, $ne: "" } 
      }).select('pushToken');

      if (usersWithTokens.length > 0) {
        const tokens = usersWithTokens.map(u => u.pushToken);
        
        // --- CHUNKING LOGIC ---
        const CHUNK_SIZE = 100;
        const chunks = [];
        for (let i = 0; i < tokens.length; i += CHUNK_SIZE) {
          chunks.push(tokens.slice(i, i + CHUNK_SIZE));
        }

        const notificationTitle = '🏆 Tournament Concluded!';
        const notificationBody = `${winnerName} dominated with ${winnerAura} Aura! ⚡ Points reset. Let the AURA farming begin!`;

        // Send each chunk to Expo
        const chunkPromises = chunks.map(async (chunk) => {
          const messages = chunk.map(token => ({
            to: token,
            sound: 'default',
            title: notificationTitle,
            body: notificationBody,
            data: { screen: 'Leaderboard' },
          }));

          return fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
              'Accept': 'application/json',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(messages),
          });
        });

        await Promise.all(chunkPromises);
      }
    } catch (notifErr) {
      console.error("Notification chunking failed:", notifErr);
    }

    return NextResponse.json({ success: true, winner: winnerName });

  } catch (err) {
    console.error("❌ CRON Error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

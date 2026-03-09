import { NextResponse } from 'next/server';
import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import { sendMultiplePushNotifications } from "@/app/lib/pushNotifications";

// --- LOGIC FUNCTIONS ---

async function dailyClanCheck() {
    const clans = await Clan.find({});
    const now = new Date();
    const bulkOps = [];

    for (const clan of clans) {
        let setFields = {};
        let badgesToAdd = [];
        const currentBadges = clan.badges || [];

        const daysSinceActive = Math.floor((now - new Date(clan.lastActive)) / (1000 * 60 * 60 * 24));
        if (daysSinceActive >= 7) {
            setFields.totalPoints = Math.floor((clan.totalPoints || 0) * 0.5);
            setFields.spendablePoints = Math.floor((clan.spendablePoints || 0) * 0.5);
            setFields.lastActive = new Date(); 
        }

        if (clan.members?.length >= 10 && !currentBadges.includes("Gotei 13")) {
            badgesToAdd.push("Gotei 13");
        } else if (clan.members?.length >= 5 && !currentBadges.includes("The 5 Kage")) {
            badgesToAdd.push("The 5 Kage");
        }

        if ((clan.stats?.totalPosts || 0) >= 1000 && !currentBadges.includes("Library of Ohara")) {
            badgesToAdd.push("Library of Ohara");
        }

        if ((clan.stats?.likes || 0) >= 100000 && !currentBadges.includes("King's Haki")) {
            badgesToAdd.push("King's Haki");
        }

        if (!currentBadges.includes("Sage Mode")) {
            const { likes = 0, comments = 0, shares = 0 } = clan.stats || {};
            if ((clan.totalPoints || 0) >= 50000 && likes >= 500 && comments >= 500 && shares >= 500) {
                badgesToAdd.push("Sage Mode");
            }
        }

        if (clan.rank === 6 && !currentBadges.includes("Final Form")) {
            badgesToAdd.push("Final Form");
        }

        const scouterLevels = [
            { threshold: 1000, badge: "Scouter Lvl 1" },
            { threshold: 5000, badge: "Scouter Lvl 2" },
            { threshold: 10000, badge: "Scouter Lvl 3" },
            { threshold: 50000, badge: "Scouter Lvl 4" },
            { threshold: 80000, badge: "Scouter: Broken Scale" },
            { threshold: 100000, badge: "Scouter: It's Over 9000" },
        ];

        for (const level of scouterLevels) {
            if ((clan.followerCount || 0) >= level.threshold && !currentBadges.includes(level.badge)) {
                badgesToAdd.push(level.badge);
            }
        }

        const finalUpdate = {};
        if (Object.keys(setFields).length > 0) finalUpdate.$set = setFields;
        if (badgesToAdd.length > 0) {
            finalUpdate.$addToSet = { badges: { $each: badgesToAdd } };
        }

        // ⚡️ Add to bulk operation array instead of awaiting individual updates
        if (Object.keys(finalUpdate).length > 0) {
            bulkOps.push({
                updateOne: {
                    filter: { _id: clan._id },
                    update: finalUpdate
                }
            });
        }
    }

    if (bulkOps.length > 0) {
        await Clan.bulkWrite(bulkOps);
    }
}

/**
 * ⚡️ UPDATED: Daily distribution of Spendable Points.
 * Base = 20. Top 10 = 30. Verified = 40.
 */
async function dailyAllocation() {
    const clans = await Clan.find({});
    const bulkOps = [];
    const now = new Date();

    for (const clan of clans) {
        let allowance = 20;

        // 1. Check Verification Status (Highest Priority)
        const isVerified = clan.verifiedUntil && new Date(clan.verifiedUntil) > now;

        if (isVerified) {
            allowance = 40;
        } 
        // 2. Check Top 10 Status (Secondary Priority)
        else if (clan.weeklyPointHistory && clan.weeklyPointHistory.length > 0) {
            const lastHistoryEntry = clan.weeklyPointHistory[clan.weeklyPointHistory.length - 1];
            if (lastHistoryEntry.rankAtTime > 0 && lastHistoryEntry.rankAtTime <= 10) {
                allowance = 30;
            }
        }

        bulkOps.push({
            updateOne: {
                filter: { _id: clan._id },
                update: { $inc: { spendablePoints: allowance } }
            }
        });
    }

    if (bulkOps.length > 0) {
        await Clan.bulkWrite(bulkOps);
    }
}

async function auraReset() {
    const now = new Date();
    const currentYear = now.getFullYear();
    
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const diff = now.getTime() - startOfYear.getTime();
    const oneDay = 1000 * 60 * 60 * 24;
    const dayOfYear = Math.floor(diff / oneDay);
    const weekNumber = Math.ceil((dayOfYear + 1) / 7);

    const leaders = await MobileUser.find({ weeklyAura: { $gt: 0 } })
      .sort({ weeklyAura: -1 })
      .limit(10);

    if (leaders.length === 0) {
      await MobileUser.updateMany({}, { $set: { weeklyAura: 0, previousRank: null } });
      return;
    }

    const winnerName = leaders[0].username || "An Elite User";
    const winnerAura = leaders[0].weeklyAura;

    await MobileUser.updateMany({}, { $set: { previousRank: null, weeklyAura: 0 } });

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

    try {
      const usersWithTokens = await MobileUser.find({ 
        pushToken: { $nin: [null, ""], $exists: true } 
      }).select('pushToken');
      
      if (usersWithTokens.length > 0) {
        const tokens = usersWithTokens.map(u => u.pushToken);
        const title = '🏆 Tournament Concluded!';
        const body = `${winnerName} dominated with ${winnerAura} Aura! ⚡ Points reset. Start farming now!`;
        const data = { screen: 'Leaderboard' };
        await sendMultiplePushNotifications(tokens, title, body, data);
      }
    } catch (notifErr) {
      console.error("❌ Notification Phase Error:", notifErr);
    }
}

/**
 * ⚡️ UPDATED: Uses bulkWrite to prevent Vercel Serverless timeouts during decay.
 */
async function weeklyClanReset() {
    const rankThresholds = [0, 5000, 20000, 50000, 100000, 300000];
    const decayAmounts = [200, 500, 1000, 2000, 5000, 30000]; 

    const rankedClans = await Clan.find({}).sort({ currentWeeklyPoints: -1 });
    const mostDiscussedClan = await Clan.findOne({}).sort({ "stats.comments": -1 });
    const weekEnding = new Date();
    const bulkOps = [];

    const weeklyTitleBadges = ["The Pirate King", "The Pillars", "Hunter Association"];
    await Clan.updateMany({}, { $pull: { badges: { $in: weeklyTitleBadges } } });

    for (let i = 0; i < rankedClans.length; i++) {
      const clan = rankedClans[i];
      const position = i + 1; 
      const currentRank = clan.rank || 1; 
      
      let setFields = {};
      let pushFields = {};
      let incFields = {};
      let badgesToAdd = [];

      // --- 📉 DECAY LOGIC ---
      const decayValue = decayAmounts[currentRank - 1] || 0;
      let decayedPoints = Math.max(0, (clan.totalPoints || 0) - decayValue);

      let newRank = 1;
      for (let r = rankThresholds.length - 1; r >= 0; r--) {
        if (decayedPoints >= rankThresholds[r]) {
          newRank = r + 1;
          break;
        }
      }
      
      setFields.totalPoints = decayedPoints;
      setFields.rank = newRank;

      // --- 🛡️ UNLIMITED CHAKRA ---
      const nextRankThreshold = rankThresholds[newRank];
      let hit80PercentLimit = false;

      if (nextRankThreshold) {
        if (decayedPoints >= (nextRankThreshold * 0.8)) hit80PercentLimit = true;
      } else if (newRank === 6) {
        hit80PercentLimit = true;
      }

      if (hit80PercentLimit) {
        incFields.consecutiveWeeksNoDerank = 1;
        if ((clan.consecutiveWeeksNoDerank + 1) >= 4) {
          badgesToAdd.push("Unlimited Chakra");
        }
      } else {
        setFields.consecutiveWeeksNoDerank = 0;
        // Immediate individual pull to prevent bulkWrite conflicts with $addToSet
        await Clan.updateOne({ _id: clan._id }, { $pull: { badges: "Unlimited Chakra" } });
      }

      // --- 📈 GROWTH CHECK ---
      const history = clan.weeklyPointHistory || [];
      const lastWeek = history[history.length - 1];
      if (lastWeek?.points > 0) {
        const growth = clan.currentWeeklyPoints / lastWeek.points;
        if (growth >= 2.0) badgesToAdd.push("Gear 2nd");
        else if (growth >= 1.5) badgesToAdd.push("Zenkai Boost");
      }

      // --- 🏆 WEEKLY TITLES ---
      if (position === 1) badgesToAdd.push("The Pirate King");
      else if (position <= 5) badgesToAdd.push("The Pillars");
      else if (position <= 10) badgesToAdd.push("Hunter Association");

      // --- 💬 LIFETIME BADGE CHECK ---
      if (mostDiscussedClan && clan._id.equals(mostDiscussedClan._id)) {
        badgesToAdd.push("Talk-no-jutsu");
      }

      // --- 🔄 RESET WEEKLY PROGRESS ---
      pushFields.weeklyPointHistory = {
        $each: [{ 
            weekEnding, 
            points: clan.currentWeeklyPoints, 
            rankAtTime: position 
        }],
        $slice: -12
      };
      
      setFields.currentWeeklyPoints = 0; 

      const finalUpdate = { $set: setFields, $push: pushFields };
      if (badgesToAdd.length > 0) finalUpdate.$addToSet = { badges: { $each: badgesToAdd } };
      if (Object.keys(incFields).length > 0) finalUpdate.$inc = incFields;

      // ⚡️ Add to bulk array
      bulkOps.push({
          updateOne: {
              filter: { _id: clan._id },
              update: finalUpdate
          }
      });
    }

    if (bulkOps.length > 0) {
        await Clan.bulkWrite(bulkOps);
    }
}

// --- MAIN HANDLER ---

export async function GET(req) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("❌ Auth Match Failed");
    return new Response('Unauthorized', { status: 401 });
  }

  const now = new Date();
  
  const watDay = new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    timeZone: 'Africa/Lagos',
  }).format(now);

  const isMondayWAT = watDay === "Monday";

  try {
    await connectDB();
    console.log("--- Starting Master Cron Sequence ---");

    // 1. Daily Tasks
    console.log("⏳ Processing Daily Tasks...");
    await dailyClanCheck();
    await dailyAllocation();

    // 2. Weekly Tasks
    if (isMondayWAT) {
      console.log("⏳ Processing Weekly Resets...");
      await auraReset();
      await weeklyClanReset();
    }

    console.log("✅ Master Cron Completed Successfully");
    return NextResponse.json({ 
        success: true, 
        message: `Executed daily tasks${isMondayWAT ? " and weekly tasks" : ""}` 
    });

  } catch (error) {
    console.error("❌ Cron Master Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";

export async function GET(req) {
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");

  // Check for Vercel Cron Secret
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.error("❌ Auth Match Failed");
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    await connectDB();

    const rankThresholds = [0, 5000, 20000, 50000, 100000, 300000];
    const rankedClans = await Clan.find({}).sort({ currentWeeklyPoints: -1 });
    const mostDiscussedClan = await Clan.findOne({}).sort({ "stats.comments": -1 });
    const weekEnding = new Date();

    /**
     * WEEKLY TITLES: Removed every week and re-awarded based on new rankings.
     */
    const weeklyTitleBadges = [
      "The Pirate King", "The Pillars", "Hunter Association", "Talk-no-jutsu"
    ];

    // Reset weekly titles for everyone globally first
    await Clan.updateMany({}, { $pull: { badges: { $in: weeklyTitleBadges } } });

    for (let i = 0; i < rankedClans.length; i++) {
      const clan = rankedClans[i];
      const position = i + 1;
      
      // Initialize atomic update containers
      let setFields = {};
      let pushFields = {};
      let incFields = {};
      let badgesToAdd = [];

      // --- 1. POINT DECAY & WEEKLY RANKING ---
      const decayedPoints = Math.floor((clan.totalPoints || 0) * 0.9);
      let newRank = 1;
      for (let r = rankThresholds.length - 1; r >= 0; r--) {
        if (decayedPoints >= rankThresholds[r]) {
          newRank = r + 1;
          break;
        }
      }
      setFields.totalPoints = decayedPoints;
      setFields.rank = newRank;

      // --- 2. UNLIMITED CHAKRA (Milestone Badge) ---
      const nextRankThreshold = rankThresholds[newRank];
      let hit80PercentLimit = false;

      if (nextRankThreshold) {
        if (decayedPoints >= (nextRankThreshold * 0.8)) hit80PercentLimit = true;
      } else if (newRank === 6) {
        hit80PercentLimit = true;
      }

      if (hit80PercentLimit) {
        incFields.consecutiveWeeksNoDerank = 1;
        // Check if they will hit the 4-week mark this turn
        if ((clan.consecutiveWeeksNoDerank + 1) >= 4 && !clan.badges.includes("Unlimited Chakra")) {
          badgesToAdd.push("Unlimited Chakra");
        }
      } else {
        setFields.consecutiveWeeksNoDerank = 0;
        // Remove badge if they lose consistency
        await Clan.updateOne({ _id: clan._id }, { $pull: { badges: "Unlimited Chakra" } });
      }

      // --- 3. GROWTH BADGES ---
      const lastWeek = clan.weeklyPointHistory?.[clan.weeklyPointHistory.length - 1];
      if (lastWeek?.points > 0) {
        const growth = clan.currentWeeklyPoints / lastWeek.points;
        if (growth >= 2.0 && !clan.badges.includes("Gear 2nd")) {
          badgesToAdd.push("Gear 2nd");
        } else if (growth >= 1.5 && !clan.badges.includes("Zenkai Boost")) {
          badgesToAdd.push("Zenkai Boost");
        }
      }

      // --- 4. LEADERBOARD TITLES (Weekly re-calculated) ---
      if (position === 1) badgesToAdd.push("The Pirate King");
      else if (position <= 5) badgesToAdd.push("The Pillars");
      else if (position <= 10) badgesToAdd.push("Hunter Association");

      if (mostDiscussedClan && clan._id.equals(mostDiscussedClan._id)) {
        badgesToAdd.push("Talk-no-jutsu");
      }

      // --- 5. ARCHIVE & RESET ---
      pushFields.weeklyPointHistory = {
        $each: [{ weekEnding, points: clan.currentWeeklyPoints, rankAtTime: newRank }],
        $slice: -12
      };
      setFields.currentWeeklyPoints = 0;

      // --- BUILD FINAL ATOMIC UPDATE ---
      const finalUpdate = { $set: setFields, $push: pushFields };
      if (badgesToAdd.length > 0) {
        finalUpdate.$addToSet = { badges: { $each: badgesToAdd } };
      }
      if (Object.keys(incFields).length > 0) {
        finalUpdate.$inc = incFields;
      }

      await Clan.updateOne({ _id: clan._id }, finalUpdate);
    }

    return Response.json({ success: true, processed: rankedClans.length });
  } catch (error) {
    console.error("❌ Weekly Reset Error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
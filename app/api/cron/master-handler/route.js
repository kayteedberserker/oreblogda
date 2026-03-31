import { createMessagePill } from '@/app/lib/messagePillService'; // ⚡️ Ensure this is imported
import connectDB from "@/app/lib/mongodb";
import { sendMultiplePushNotifications } from "@/app/lib/pushNotifications";
import Clan from "@/app/models/ClanModel";
import MessagePill from "@/app/models/MessagePillModel"; // ⚡️ ADDED: Import Pill Model
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from 'next/server';

// --- LOGIC FUNCTIONS ---

// ⚡️ NEW: Daily New User Broadcast
async function dailyNewUserBroadcast() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(0, 0, 0, 0);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const newUsersCount = await MobileUser.countDocuments({
    createdAt: { $gte: yesterday, $lt: today }
  });

  if (newUsersCount > 0) {
    await MessagePill.create({
      text: `SYSTEM UPDATE: WELCOME TO THE ${newUsersCount} NEW OPERATORS WHO AWAKENED YESTERDAY.`,
      type: 'system',
      targetAudience: 'global',
      priority: 5, // Medium-high priority
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // ⚡️ Strict 24-hour expiry
    });
    console.log(`[CRON] Broadcasted New User Pill: ${newUsersCount} users.`);
  }
}

async function dailyClanCheck() {
  const clans = await Clan.find({});
  const now = new Date();
  const bulkOps = [];

  for (const clan of clans) {
    let setFields = {};
    let badgesToAdd = [];
    const currentBadges = clan.badges || [];

    // --- Inactivity Decay ---
    const daysSinceActive = Math.floor((now - new Date(clan.lastActive)) / (1000 * 60 * 60 * 24));
    if (daysSinceActive >= 7) {
      setFields.totalPoints = Math.floor((clan.totalPoints || 0) * 0.5);
      setFields.spendablePoints = Math.floor((clan.spendablePoints || 0) * 0.5);
      setFields.lastActive = new Date();

      // ⚡️ OPTIONAL: Add a warning pill for inactive clans
      await createMessagePill({
        text: `⚠️ CLAN DECAY: Points halved due to 7 days of inactivity.`,
        type: 'warning',
        targetAudience: 'clan',
        targetId: clan.tag,
        priority: 1,
        expiresInHours: 48,
        replaceExistingType: true
      });
    }

    // --- Badge Logic ---
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

    // --- Message Pill for New Badges ⚡️ ---
    if (badgesToAdd.length > 0) {
      const latestBadge = badgesToAdd[badgesToAdd.length - 1];
      const extraCount = badgesToAdd.length - 1;
      const pillText = extraCount > 0
        ? `🏆 CLAN ACHIEVEMENT: Earned ${latestBadge} and ${extraCount} other medals!`
        : `🏆 CLAN ACHIEVEMENT: Earned the ${latestBadge} medal!`;

      await createMessagePill({
        text: pillText,
        type: 'achievement', // Use achievement theme (Gold)
        targetAudience: 'clan',
        targetId: clan.tag,
        link: `/clanprofile`, // Direct link to their clan page
        priority: 2,
        expiresInHours: 72, // Keep it visible for 3 days
        replaceExistingType: false // Keep it even if there's a war pill
      });
    }

    const finalUpdate = {};
    if (Object.keys(setFields).length > 0) finalUpdate.$set = setFields;
    if (badgesToAdd.length > 0) {
      finalUpdate.$addToSet = { badges: { $each: badgesToAdd } };
    }

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

async function dailyAllocation() {
  const clans = await Clan.find({});
  const bulkOps = [];
  const now = new Date();

  for (const clan of clans) {
    let allowance = 20;

    const isVerified = clan.verifiedUntil && new Date(clan.verifiedUntil) > now;

    if (isVerified) {
      allowance = 40;
    }
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
    // ⚡️ CREATE GLOBAL MESSAGE PILL FOR THE TOURNAMENT WINNER
    await createMessagePill({
      text: `🏆 ${winnerName} won the weekly tournament with ${winnerAura.toLocaleString()} Aura! Ranks have reset.`,
      type: 'achievement', // Will use the gold trophy theme
      targetAudience: 'global',
      link: '/screens/Leaderboard', // Adjust to match your actual routing
      priority: 3, // High priority so it sits at the front
      expiresInHours: 24, // Let it display for a full day
      replaceExistingType: true
    });

    const usersWithTokens = await MobileUser.find({
      pushToken: { $nin: [null, ""], $exists: true }
    }).select('pushToken');

    if (usersWithTokens.length > 0) {
      const tokens = usersWithTokens.map(u => u.pushToken);
      const title = '🏆 Tournament Concluded!';
      const body = `${winnerName} dominated with ${winnerAura.toLocaleString()} Aura! ⚡ Points reset. Start farming now!`;
      const data = { screen: 'Leaderboard' };
      await sendMultiplePushNotifications(tokens, title, body, data);
    }
  } catch (notifErr) {
    console.error("❌ Notification Phase Error:", notifErr);
  }
}

async function weeklyClanReset() {
  const rankThresholds = [0, 5000, 20000, 50000, 100000, 300000];
  const decayAmounts = [200, 500, 1000, 2000, 5000, 30000];

  const rankedClans = await Clan.find({}).sort({ currentWeeklyPoints: -1 });
  const mostDiscussedClan = await Clan.findOne({}).sort({ "stats.comments": -1 });
  const weekEnding = new Date();

  const bulkOps = [];
  const pillPromises = []; // ⚡️ Array to hold all our pill creations

  // ⚡️ LOGIC FIX: Added "Talk-no-jutsu" so it is properly stripped from everyone before being reassigned
  const weeklyTitleBadges = ["The Pirate King", "The Pillars", "Hunter Association", "Talk-no-jutsu"];
  await Clan.updateMany({}, { $pull: { badges: { $in: weeklyTitleBadges } } });

  for (let i = 0; i < rankedClans.length; i++) {
    const clan = rankedClans[i];
    const position = i + 1;
    const currentRank = clan.rank || 1;

    let setFields = {};
    let pushFields = {};
    let incFields = {};
    let badgesToAdd = [];

    // --- Decay & Rank Logic ---
    const decayValue = decayAmounts[currentRank - 1] || 0;
    let decayedPoints = (clan.totalPoints || 0) - decayValue;
    if (decayedPoints < 0) decayedPoints = 0; // Prevent negative points

    let newRank = 1;
    for (let r = rankThresholds.length - 1; r >= 0; r--) {
      if (decayedPoints >= rankThresholds[r]) {
        newRank = r + 1;
        break;
      }
    }

    setFields.totalPoints = decayedPoints;
    setFields.rank = newRank;

    // ⚡️ PILL TRIGGER: Promotions and Demotions
    if (newRank > currentRank) {
      pillPromises.push(createMessagePill({
        text: `🎖️ PROMOTION: Your clan has ascended to Tier ${newRank}!`,
        type: 'achievement',
        targetAudience: 'clan',
        targetId: clan.tag,
        priority: 2,
        expiresInHours: 72,
        replaceExistingType: false
      }));
    } else if (newRank < currentRank) {
      pillPromises.push(createMessagePill({
        text: `⚠️ DEMOTION: Weekly decay dropped your clan to Tier ${newRank}.`,
        type: 'warning',
        targetAudience: 'clan',
        targetId: clan.tag,
        priority: 1,
        expiresInHours: 48,
        replaceExistingType: false
      }));
    }

    // --- Streak Logic ---
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
      await Clan.updateOne({ _id: clan._id }, { $pull: { badges: "Unlimited Chakra" } });
    }

    // --- Growth Logic ---
    const history = clan.weeklyPointHistory || [];
    const lastWeek = history[history.length - 1];
    if (lastWeek?.points > 0) {
      const growth = clan.currentWeeklyPoints / lastWeek.points;
      if (growth >= 2.0) badgesToAdd.push("Gear 2nd");
      else if (growth >= 1.5) badgesToAdd.push("Zenkai Boost");
    }

    // --- Weekly Titles ---
    if (position === 1) {
      badgesToAdd.push("The Pirate King");
      // ⚡️ PILL TRIGGER: Global announcement for the #1 Clan
      pillPromises.push(createMessagePill({
        text: `👑 ALL HAIL: [${clan.tag}] ${clan.name} is the #1 Clan of the Week!`,
        type: 'event', // Use event theme for global broadcasts (Purple/Gold)
        targetAudience: 'global',
        link: `/clans/${clan.tag}`, // Deep link straight to their clan page
        priority: 3,
        expiresInHours: 72,
        replaceExistingType: true
      }));
    }
    else if (position <= 5) badgesToAdd.push("The Pillars");
    else if (position <= 10) badgesToAdd.push("Hunter Association");

    // Assign the Most Discussed badge safely
    if (mostDiscussedClan && clan._id.equals(mostDiscussedClan._id)) {
      badgesToAdd.push("Talk-no-jutsu");
      // ⚡️ PILL TRIGGER: Let the clan know they are famous
      pillPromises.push(createMessagePill({
        text: `💬 TALK-NO-JUTSU: Your clan was the most discussed in the village this week!`,
        type: 'achievement',
        targetAudience: 'clan',
        targetId: clan.tag,
        priority: 2,
        expiresInHours: 72,
        replaceExistingType: false
      }));
    }

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

    bulkOps.push({
      updateOne: {
        filter: { _id: clan._id },
        update: finalUpdate
      }
    });
  }

  // 1. Execute DB writes for Clan Stats
  if (bulkOps.length > 0) {
    await Clan.bulkWrite(bulkOps);
  }

  // 2. ⚡️ Execute all Message Pills simultaneously
  if (pillPromises.length > 0) {
    await Promise.all(pillPromises).catch(err => console.error("Pill generation error:", err));
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
    await dailyNewUserBroadcast(); // ⚡️ ADDED: Trigger the Pill Generator

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
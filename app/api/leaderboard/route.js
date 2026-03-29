import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import MobileUser from "@/app/models/MobileUserModel";
import Clan from "@/app/models/ClanModel";

export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    
    // category: authors | clans
    const category = searchParams.get("category") || "authors";
    // ⚡️ UPDATED: Default to the new "level" type for Authors instead of "posts"
    const type = searchParams.get("type") || (category === "authors" ? "level" : "points");
    const limit = Math.min(Number(searchParams.get("limit")) || 100, 200);

    if (category === "clans") {
      const clans = await Clan.find({});
      
      const formattedClans = clans.map(clan => ({
        clanId: clan._id,
        name: clan.name,
        tag: clan.tag,
        rank: clan.rank || 1,
        totalPoints: clan.totalPoints || 0,
        followerCount: clan?.followerCount || 0,
        currentWeeklyPoints: clan?.currentWeeklyPoints || 0,
        badgeCount: clan.badges?.length || 0,
        country: clan.country || "Global"
      }));

      // Sort logic for clans
      formattedClans.sort((a, b) => {
        if (type === "followers") return b.followerCount - a.followerCount;
        if (type === "weekly") return b.currentWeeklyPoints - a.currentWeeklyPoints;
        if (type === "badges") return b.badgeCount - a.badgeCount;
        return b.totalPoints - a.totalPoints; // default: points
      });

      return NextResponse.json({
        category,
        type,
        leaderboard: formattedClans.slice(0, limit)
      });
    }

    // --- AUTHOR LOGIC ---
    
    // ⚡️ PERFORMANCE OPTIMIZATION: Count posts instantly using Aggregation instead of fetching all documents
    const postCounts = await Post.aggregate([
      { $match: { authorUserId: { $ne: null }, status: "approved" } },
      { $group: { _id: "$authorUserId", count: { $sum: 1 } } }
    ]);

    const postCountMap = {};
    for (const p of postCounts) {
      postCountMap[p._id.toString()] = p.count;
    }

    const mobileUsers = await MobileUser.find({}).lean(); // .lean() for performance
    const combinedUsers = mobileUsers
      .map((user) => ({
          ...user,
          postCount: postCountMap[user._id.toString()] || 0,
          streak: user.lastStreak || 0,
          peakLevel: user.peakLevel || 0,
          totalPurchasedCoins: user.totalPurchasedCoins || 0,
          // ⚡️ NEW: Inject Lifetime Aura stats
          currentRankLevel: user.currentRankLevel || 1,
          aura: user.aura || 0,
          weeklyAura: user.weeklyAura || 0
      }))
      // Allow users into the leaderboard if they have posts, aura, OR if we are searching by peak
      .filter((u) => u.postCount > 0 || u.aura > 0 || (type === "peak" && u.peakLevel > 0));

    combinedUsers.sort((a, b) => {
      if (type === "streak") return (b.streak || 0) - (a.streak || 0);
      if (type === "aura") return (b.weeklyAura || 0) - (a.weeklyAura || 0); // Weekly Competitive
      if (type === "posts") return (b.postCount || 0) - (a.postCount || 0); // Raw Post Count
      
      // Peak Sorting Logic
      if (type === "peak") {
          // Primary sort: Peak Level
          if (b.peakLevel !== a.peakLevel) return (b.peakLevel || 0) - (a.peakLevel || 0);
          // Tie-breaker: Total Purchased Coins
          return (b.totalPurchasedCoins || 0) - (a.totalPurchasedCoins || 0);
      }
      
      // ⚡️ NEW DEFAULT: "level" (Lifetime RPG Rank & Aura)
      // Primary sort: Rank Level (1 through 8)
      if (b.currentRankLevel !== a.currentRankLevel) {
          return (b.currentRankLevel || 1) - (a.currentRankLevel || 1);
      }
      // Tie-breaker: Exact Lifetime Aura Points
      return (b.aura || 0) - (a.aura || 0); 
    });

    return NextResponse.json({
      category,
      type,
      leaderboard: combinedUsers.slice(0, limit).map((u) => ({
        userId: u._id,
        username: u.username,
        postCount: u.postCount,
        streak: u.streak,
        weeklyAura: u.weeklyAura || 0,
        previousRank: u.previousRank || null,
        peakLevel: u.peakLevel,
        totalPurchasedCoins: u.totalPurchasedCoins,
        // ⚡️ Expose new fields to frontend
        currentRankLevel: u.currentRankLevel,
        aura: u.aura
      })),
    });

  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
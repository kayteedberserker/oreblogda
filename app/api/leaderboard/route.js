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
    // type: posts/streak/aura/peak (for authors) OR points/followers/weekly/badges (for clans)
    const type = searchParams.get("type") || (category === "authors" ? "posts" : "points");
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
    const posts = await Post.find({
      authorUserId: { $ne: null },
      status: "approved"
    }).select("authorUserId");

    const postCountMap = {};
    for (const post of posts) {
      const id = post.authorUserId.toString();
      postCountMap[id] = (postCountMap[id] || 0) + 1;
    }

    const mobileUsers = await MobileUser.find({});
    const combinedUsers = mobileUsers
      .map((user) => ({
          ...user._doc,
          postCount: postCountMap[user._id.toString()] || 0,
          streak: user.lastStreak || 0,
          peakLevel: user.peakLevel || 0,
          totalPurchasedCoins: user.totalPurchasedCoins || 0
      }))
      // Allow users into the leaderboard if they have posts, OR if we are searching by peak and they have a peak.
      .filter((u) => u.postCount > 0 || (type === "peak" && u.peakLevel > 0));

    combinedUsers.sort((a, b) => {
      if (type === "streak") return (b.streak || 0) - (a.streak || 0);
      if (type === "aura") return (b.weeklyAura || 0) - (a.weeklyAura || 0);
      
      // ⚡️ NEW: Peak Sorting Logic
      if (type === "peak") {
          // Primary sort: Peak Level
          if (b.peakLevel !== a.peakLevel) return (b.peakLevel || 0) - (a.peakLevel || 0);
          // Tie-breaker: Total Purchased Coins
          return (b.totalPurchasedCoins || 0) - (a.totalPurchasedCoins || 0);
      }
      
      return b.postCount - a.postCount; // Default: posts
    });
    console.log(combinedUsers[0])
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
        // ⚡️ Expose Peak Data to the frontend
        peakLevel: u.peakLevel,
        totalPurchasedCoins: u.totalPurchasedCoins
      })),
    });

  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
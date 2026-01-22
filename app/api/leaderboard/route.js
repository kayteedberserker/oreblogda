import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import MobileUser from "@/app/models/MobileUserModel";
import AdminUser from "@/app/models/UserModel";

export async function GET(req) {
  try {
    console.log("📊 Leaderboard API hit");
    await connectDB();
    console.log("✅ MongoDB connected");

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "posts"; // posts | streak | aura
    const limit = Math.min(Number(searchParams.get("limit")) || 200, 200);

    console.log("🔧 Query params:", { type, limit });

    // 1️⃣ Fetch all approved posts with valid authorUserId
    const posts = await Post.find({
      authorUserId: { $ne: null },
      status: "approved"
    }).select("authorUserId");

    console.log(`📦 Total approved posts with author: ${posts.length}`);

    // 2️⃣ Count posts per author
    const postCountMap = {};
    for (const post of posts) {
      const id = post.authorUserId.toString();
      postCountMap[id] = (postCountMap[id] || 0) + 1;
    }

    // 3️⃣ Fetch all users
    const mobileUsers = await MobileUser.find({});
    
    // 4️⃣ Combine and attach post counts
    const combinedUsers = [...mobileUsers]
      .map((user) => {
        const postCount = postCountMap[user._id.toString()] || 0;
        return { 
          ...user._doc, 
          postCount, 
          // Keep your streak logic: using lastStreak or consecutiveStreak based on your schema preference
          streak: user.consecutiveStreak || user.lastStreak || 0 
        };
      })
      .filter((u) => u.postCount > 0);

    console.log(`📦 Users with >0 posts: ${combinedUsers.length}`);

    // 5️⃣ Sort Logic updated to include Aura
    combinedUsers.sort((a, b) => {
      if (type === "streak") return (b.streak || 0) - (a.streak || 0);
      if (type === "aura") return (b.weeklyAura || 0) - (a.weeklyAura || 0);
      return b.postCount - a.postCount;
    });

    // 6️⃣ Limit
    const topLeaderboard = combinedUsers.slice(0, limit);

    console.log(`🏆 Returning top ${topLeaderboard.length} sorted by ${type}`);

    return NextResponse.json({
      type,
      count: topLeaderboard.length,
      leaderboard: topLeaderboard.map((u) => ({
        userId: u._id,
        adminId: u.email ? u._id : null,
        username: u.username,
        profilePic: u.profilePic?.url || "",
        country: u.country || "Unknown",
        postCount: u.postCount,
        streak: u.streak,
        weeklyAura: u.weeklyAura || 0, // Fixed: used 'u' instead of 'user'
        previousRank: u.previousRank || null // Required for the Protagonist/Rival labels
      })),
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import MobileUser from "@/app/models/MobileUserModel";

export async function GET(req) {
  try {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "posts"; // posts | streak | aura
    const limit = Math.min(Number(searchParams.get("limit")) || 200, 200);

    // 1️⃣ Fetch approved posts for count logic
    const posts = await Post.find({
      authorUserId: { $ne: null },
      status: "approved"
    }).select("authorUserId");

    const postCountMap = {};
    for (const post of posts) {
      const id = post.authorUserId.toString();
      postCountMap[id] = (postCountMap[id] || 0) + 1;
    }

    // 2️⃣ Fetch all Mobile Users
    const mobileUsers = await MobileUser.find({});

    // 3️⃣ Combine data using the correct Schema fields
    const combinedUsers = mobileUsers.map((user) => {
      const userIdStr = user._id.toString();
      return {
        userId: user._id,
        username: user.username || "Guest Author",
        profilePic: user.profilePic?.url || "",
        country: user.country || "Unknown",
        postCount: postCountMap[userIdStr] || 0,
        // Using fields from your provided Schema:
        streak: user.consecutiveStreak || 0, 
        weeklyAura: user.weeklyAura || 0,
        previousRank: user.previousRank || null
      };
    });

    // 4️⃣ Sorting Logic
    combinedUsers.sort((a, b) => {
      if (type === "streak") return b.streak - a.streak;
      if (type === "aura") return b.weeklyAura - a.weeklyAura;
      return b.postCount - a.postCount;
    });

    // 5️⃣ Filter to keep leaderboard clean (optional: only show active users)
    const finalLeaderboard = combinedUsers.slice(0, limit);

    return NextResponse.json({
      type,
      count: finalLeaderboard.length,
      leaderboard: finalLeaderboard,
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

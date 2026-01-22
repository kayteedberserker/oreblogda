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
    const type = searchParams.get("type") || "posts"; // posts | streak
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
    console.log("🔢 Sample post counts:", Object.entries(postCountMap).slice(0, 5));

    // 3️⃣ Fetch all users from both collections
    const mobileUsers = await MobileUser.find({});
    const adminUsers = await AdminUser.find({});
    console.log(`👤 Mobile users: ${mobileUsers.length}, Admin users: ${adminUsers.length}`);

    // 4️⃣ Combine and attach post counts
    const combinedUsers = [...mobileUsers, ...adminUsers]
      .map((user) => {
        const postCount = postCountMap[user._id.toString()] || 0;
        return { ...user._doc, postCount, streak: user.lastStreak || 0 };
      })
      .filter((u) => u.postCount > 0); // ✅ Only more than 1 post

    console.log(`📦 Users with >1 post: ${combinedUsers.length}`);

    // 5️⃣ Sort
    combinedUsers.sort((a, b) => {
      if (type === "streak") return (b.streak || 0) - (a.streak || 0);
      return b.postCount - a.postCount;
    });

    // 6️⃣ Limit
    const topLeaderboard = combinedUsers.slice(0, limit);

    console.log(`🏆 Returning top ${topLeaderboard.length}`);

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
      })),
    });
  } catch (err) {
    console.error("Leaderboard error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

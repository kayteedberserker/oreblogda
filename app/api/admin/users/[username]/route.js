import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel";

export async function GET(req, { params }) {
  try {
    await connectDB();
    const { username } = params;

    // 1. Find the user
    const user = await MobileUser.findOne({ username });
    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // 2. Find all posts by this user (using their deviceId or username)
    // Adjust 'author' to whatever field links posts to users in your Post schema
    const userPosts = await Post.find({ deviceId: user.deviceId }).sort({ createdAt: -1 });

    return NextResponse.json({
      user,
      posts: userPosts,
      postCount: userPosts.length
    });

  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
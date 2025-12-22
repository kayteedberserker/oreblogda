import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import { NextResponse } from "next/server";

export async function GET() {
  await connectDB();
  try {
    // Only fetch posts with status 'pending'
    const posts = await Post.find({ status: "pending" }).sort({ createdAt: -1 });
    return NextResponse.json({ posts });
  } catch (err) {
    return NextResponse.json({ message: "Server Error" }, { status: 500 });
  }
}
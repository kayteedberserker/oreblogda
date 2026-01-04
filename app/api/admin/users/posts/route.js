import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel"; // Ensure this path is correct

export async function GET(req) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) return NextResponse.json({ count: 0 });

    // Assuming your Post model has an 'authorId' or 'authorUserId' field
    const count = await Post.countDocuments({ 
        $or: [{ authorId: userId }, { authorUserId: userId }] 
    });

    return NextResponse.json({ count });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
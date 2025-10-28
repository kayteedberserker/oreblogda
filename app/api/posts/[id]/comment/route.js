import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";

// ✅ Fetch comments for a post
export async function GET(req, { params }) {
  const resolvedParams = await params;  // ✅ unwrap the Promise
  const { id } = resolvedParams;
  let post
  try {
    await connectDB();
    if (id.includes("-")) {
      post = await Post.findOne({slug: id}).select("comments");
    }else{
      post = await Post.findById(id).select("comments");
    }
    if (!post)
      return NextResponse.json({ message: "Post not found" }, { status: 404 });
    return NextResponse.json({ comments: post.comments });
  } catch (err) {
    console.error("GET comments error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

// ✅ Add new comment
export async function POST(req, { params }) {
  const resolvedParams = await params;  // ✅ unwrap the Promise
  const { id } = resolvedParams;
  try {
    await connectDB();
    const { name, text } = await req.json();
    if (!name || !text)
      return NextResponse.json(
        { message: "Name and comment are required." },
        { status: 400 }
      );

    const comment = { name, text, date: new Date() };
    let post
    if (id.includes("-")) {
      post = await Post.findOneAndUpdate(
        {slug: id},
        { $push: { comments: { $each: [comment], $position: 0 } } },
        { new: true }
      );
    } else {
      post = await Post.findByIdAndUpdate(
        id,
        { $push: { comments: { $each: [comment], $position: 0 } } },
        { new: true }
      );
    }

    if (!post)
      return NextResponse.json({ message: "Post not found" }, { status: 404 });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (err) {
    console.error("POST comment error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}

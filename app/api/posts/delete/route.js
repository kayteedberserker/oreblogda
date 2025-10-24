import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Post from "@/models/PostModel";
import cloudinary from "@/lib/cloudinary";

export async function DELETE(req) {
  await connectDB();

  try {
    const { postId } = await req.json();
    console.log(postId);
    
    if (!postId)
      return NextResponse.json({ message: "Post ID is required" }, { status: 400 });

    const post = await Post.findById(postId);
    if (!post)
      return NextResponse.json({ message: "Post not found" }, { status: 404 });

    // 🧹 If post image exists in Cloudinary, delete it
    if (post.image?.public_id) {
      try {
        await cloudinary.uploader.destroy(post.image.public_id);
      } catch (err) {
        console.warn("Cloudinary deletion error:", err.message);
      }
    }

    // 🗑 Delete post from DB
    await Post.findByIdAndDelete(postId);

    return NextResponse.json({ message: "Post deleted successfully" }, { status: 200 });
  } catch (err) {
    console.error("Delete post error:", err);
    return NextResponse.json(
      { message: "Failed to delete post", error: err.message },
      { status: 500 }
    );
  }
}

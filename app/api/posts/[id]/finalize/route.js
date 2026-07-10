import { finalizeAndPublishPost } from "@/app/api/posts/route"; // Adjust this path!
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
    await connectDB();

    try {
        // 🌟 FIX: Await the dynamic params promise context before reading its properties
        const resolvedParams = await params;
        const postId = resolvedParams.id;

        const body = await req.json();
        const { media, isEdit } = body; // 🌟 PULL isEdit FLAG FROM BODY

        if (!media || !Array.isArray(media)) {
            return NextResponse.json({ message: "Invalid media payload" }, { status: 400 });
        }

        // 1. Fetch the post to ensure it exists
        const post = await Post.findById(postId);
        if (!post) {
            return NextResponse.json({ message: "Post not found" }, { status: 404 });
        }

        // 2. Update the post with the FULL media array (old + new) and set primary pointers
        post.media = media;
        if (media.length > 0) {
            post.mediaUrl = media[0].url;
            post.mediaType = media[0].type;
        } else {
            post.mediaUrl = null;
            post.mediaType = null;
        }

        await post.save();

        // 3. Re-resolve environmental factors preserved on creation
        const isMobile = !!post.authorId;

        // 4. Execute moderation pipeline, passing the isEdit flag as the 5th parameter!
        await finalizeAndPublishPost(
            post._id,
            isMobile,
            post.country || "Global",
            post.authorId,
            isEdit || false // 🌟 PASS FLAG HERE
        );

        console.log(`[R2 Client Ping] Post ${postId} fully resolved and published.`);
        return NextResponse.json({ success: true }, { status: 200 });

    } catch (err) {
        console.error("R2 Finalize Processing Failure:", err);
        return NextResponse.json({ message: "Internal Error Finalizing Post" }, { status: 500 });
    }
}
import { finalizeAndPublishPost } from "@/app/api/posts/route"; // Adjust this path!
import connectDB from "@/app/lib/mongodb";
import PostEvent from "@/app/models/PostEventModel"; // 🌟 NEW IMPORT
import Post from "@/app/models/PostModel";
import { NextResponse } from "next/server";

// 🌟 Local logging helper if needed in this isolated file
async function logEvent(postId, type, message, metadata = {}) {
    try {
        await PostEvent.create({
            postId: postId ? postId.toString() : "SYSTEM",
            type,
            message,
            metadata: { ...metadata, timestamp: new Date() }
        });
    } catch (error) { }
}

export async function POST(req, { params }) {
    await connectDB();

    try {
        const resolvedParams = await params;
        const postId = resolvedParams.id;

        const body = await req.json();
        const { media, isEdit } = body;

        if (!media || !Array.isArray(media)) {
            return NextResponse.json({ message: "Invalid media payload" }, { status: 400 });
        }

        // 1. Fetch the post to ensure it exists
        const post = await Post.findById(postId);
        if (!post) {
            return NextResponse.json({ message: "Post not found" }, { status: 404 });
        }

        await logEvent(postId, "UPLOAD_COMPLETED", "Client requested finalize route execution", { isEdit, mediaCount: media.length });

        // 2. ONLY mutate and save media if this is an Edit.
        // For new posts, the POST route already saved the correct URLs.
        if (isEdit) {
            post.media = media;
            if (media.length > 0) {
                post.mediaUrl = media[0]?.url ?? null;
                post.mediaType = media[0]?.type ?? null;
            } else {
                post.mediaUrl = null;
                post.mediaType = null;
            }
            await post.save();
        }

        // 3. Re-resolve environmental factors preserved on creation
        const isMobile = !!post.authorId;

        // 4. Execute moderation pipeline
        await finalizeAndPublishPost(
            post._id,
            isMobile,
            post.country || "Global",
            post.authorId,
            isEdit || false // 🌟 Safely passes false for new posts, true for edits
        );

        console.log(`[R2 Client Ping] Post ${postId} fully resolved and published.`);
        return NextResponse.json({ success: true }, { status: 200 });

    } catch (err) {
        console.error("R2 Finalize Processing Failure:", err);
        return NextResponse.json({ message: "Internal Error Finalizing Post" }, { status: 500 });
    }
}
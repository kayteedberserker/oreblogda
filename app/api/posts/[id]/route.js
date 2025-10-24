import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";

// PATCH — like, comment, vote, share, etc.
export async function PATCH(req, { params }) {
    await connectDB();
    const resolvedParams = await params;  // ✅ unwrap the Promise
    const { id } = resolvedParams;

    try {
        const { action, payload } = await req.json();
        const post = await Post.findById(id);
        if (!post) {
            return NextResponse.json({ message: "Post not found" }, { status: 404 });
        }

        // ✅ Handle vote
        if (action === "vote") {
            const { selectedOptions, visitorId } = payload;

            if (!post.poll || !Array.isArray(post.poll.options)) {
                return NextResponse.json({ message: "Poll not found" }, { status: 400 });
            }

              if (post.voters?.includes(visitorId)) {
                return NextResponse.json({ message: "Already voted" }, { status: 400 });
              }

            // Create a copy of poll.options and increment selected votes
            const updatedOptions = post.poll.options.map((option, index) => {
                const plainOption = option.toObject ? option.toObject() : option;
                if (selectedOptions.includes(index)) {
                    return { ...plainOption, votes: (plainOption.votes || 0) + 1 };
                }
                return plainOption;
            });


            // Update poll and voters
            post.poll.options = updatedOptions;
            post.voters = [...(post.voters || []), visitorId];

            post.markModified("poll");
            await post.save();

            return NextResponse.json({ message: "Vote added", post }, { status: 200 });
        }




        // ✅ Handle like
        if (action === "like") {
            const { userId } = payload;
            if (!post.likes.includes(userId)) {
                post.likes.push(userId);
            }
            await post.save();
            return NextResponse.json(post, { status: 200 });
        }

        // ✅ Handle comment
        if (action === "comment") {
            const { name, text } = payload;
            post.comments.push({ name, text, createdAt: new Date() });
            await post.save();
            return NextResponse.json(post, { status: 200 });
        }

        // ✅ Handle share
        if (action === "share") {
            post.shares += 1;
            await post.save();
            return NextResponse.json(post, { status: 200 });
        }

        // ✅ Handle view
        if (action === "view") {
            post.views += 1;
            await post.save();
            return NextResponse.json(post, { status: 200 });
        }

        return NextResponse.json({ message: "Invalid action" }, { status: 400 });
    } catch (err) {
        console.error("PATCH /api/posts/[id] error:", err);
        return NextResponse.json(
            { message: "Server error", error: err.message },
            { status: 500 }
        );
    }
}

// GET: fetch single post by ID
export async function GET(req, { params }) {
    try {
        await connectDB();

        const resolvedParams = await params;  // ✅ unwrap the Promise
        const { id } = resolvedParams;
        if (!id) return NextResponse.json({ message: "Post ID is required" }, { status: 400 });

        const post = await Post.findById(id);
        if (!post) return NextResponse.json({ message: "Post not found" }, { status: 404 });

        return NextResponse.json(post);
    } catch (err) {
        console.error(err);
        return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
    }
}



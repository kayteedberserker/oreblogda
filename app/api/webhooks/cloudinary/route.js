import { finalizeAndPublishPost } from "@/app/api/posts/route"; // Adjust path to target your post route file
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import { NextResponse } from "next/server";

export async function POST(req) {
    await connectDB();

    try {
        const body = await req.json();

        // Cloudinary bundles metadata context structures into the context.custom field object
        const contextData = body.context?.custom;
        if (!contextData || !contextData.postId) {
            return NextResponse.json({ message: "Ignored: Request missing post identification mapping context." }, { status: 200 });
        }

        const { postId } = contextData;
        const secureUrl = body.secure_url;
        const resourceType = body.resource_type;
        const publicId = body.public_id;

        // Apply transformations depending on resource class
        let transformedUrl = secureUrl;
        if (resourceType === "video") {
            transformedUrl = secureUrl.replace("/upload/", "/upload/c_limit,w_720,br_1.5m,q_auto,vc_auto/");
        } else {
            transformedUrl = secureUrl.replace("/upload/", "/upload/c_limit,w_1080,f_auto,q_auto/");
        }

        const newMediaAsset = {
            url: transformedUrl,
            type: resourceType,
            public_id: publicId
        };

        // Atomically append asset references to the collection record
        const updatedPost = await Post.findByIdAndUpdate(
            postId,
            {
                $push: { media: newMediaAsset },
                // Set primary pointers if they haven't been configured yet
                $set: { mediaUrl: transformedUrl, mediaType: resourceType }
            },
            { new: true }
        );

        if (!updatedPost) {
            return NextResponse.json({ message: "Post context not found" }, { status: 404 });
        }

        // Evaluate if the background transaction stack is fully settled
        if (updatedPost.media.length >= updatedPost.totalFilesExpected) {
            // Re-resolve environmental factors preserved on creation
            const isMobile = !!updatedPost.authorId;

            // Execute moderation processing pipelines
            await finalizeAndPublishPost(
                updatedPost._id,
                isMobile,
                updatedPost.country || "Global",
                updatedPost.authorId
            );

            console.log(`[Webhook] Post ${postId} fully resolved and published.`);
        }

        return NextResponse.json({ success: true }, { status: 200 });

    } catch (err) {
        console.error("Cloudinary Webhook System Processing Failure:", err);
        return NextResponse.json({ message: "Internal Error Hooking System" }, { status: 500 });
    }
}
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { finalizeAndPublishPost } from "../../route"; // Adjust path to where your main engine is

const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

export async function PATCH(req, { params }) {
    await connectDB();

    try {
        const resolvedParams = await params;
        const postId = resolvedParams.id;

        const body = await req.json();
        const {
            title, message,
            hasPoll, pollMultiple, pollOptions, category, clanId, // 🌟 Pulled clanId from body
            existingMedia, newMediaCount, useR2
        } = body;

        const fingerprint = req.headers.get("x-user-deviceId") || req.headers.get("x-device-id");
        // 1. Resolve User Authentication Context
        try {

        } catch (err) { }
        const userDoc = await MobileUser.findOne({ deviceId: fingerprint });

        if (!userDoc) {
            return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
        }

        // 2. Fetch Post and Verify Ownership
        const post = await Post.findById(postId);
        if (!post) {
            return NextResponse.json({ message: "Post not found" }, { status: 404 });
        }

        if (post.authorUserId.toString() !== userDoc._id.toString()) {
            return NextResponse.json({ message: "Forbidden: You do not own this post." }, { status: 403 });
        }

        // 3. Update Text, Category, Clan, and Poll Data
        post.title = title || post.title;
        post.message = message || post.message;

        // 🌟 Apply category and clanId updates
        if (category) post.category = category;
        if (clanId !== undefined) post.clanId = clanId;

        if (hasPoll !== undefined) {
            post.poll = hasPoll ? {
                pollMultiple: pollMultiple || false,
                options: pollOptions && pollOptions.length >= 2 ? pollOptions.map(opt => ({ text: opt.text, votes: 0 })) : []
            } : null;
        }

        // 4. Handle Media Scenarios
        if (newMediaCount > 0) {
            // SCENARIO A: Client is adding NEW media. 
            // We set status to pending_media and generate signData for the new files.
            post.status = "pending_media";
            post.media = existingMedia || post.media; // Update with whatever existing media they kept
            await post.save();

            const signDataArray = [];
            if (useR2) {
                // Generate upload URLs for the NEW files
                // We use a timestamp to ensure unique keys so we don't overwrite old edits
                const editHash = Math.round(new Date().getTime() / 1000);

                for (let i = 0; i < newMediaCount; i++) {
                    const objectKey = `posts/${post._id}/edit_${editHash}_file_${i}.jpg`; // Adjust ext if needed based on client payload

                    const command = new PutObjectCommand({
                        Bucket: process.env.R2_BUCKET_NAME,
                        Key: objectKey,
                    });

                    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });

                    signDataArray.push({
                        engine: "r2",
                        uploadUrl: presignedUrl,
                        objectKey: objectKey,
                        publicUrl: `https://media.oreblogda.com/${objectKey}`
                    });
                }
            }

            return NextResponse.json({
                message: "Post updated. Awaiting new media assets.",
                post,
                signData: signDataArray
            }, { status: 200 });

        } else {
            // SCENARIO B: No new media added. (They might have deleted some, reordered, or just changed text)
            if (existingMedia) {
                post.media = existingMedia;
                if (existingMedia.length > 0) {
                    post.mediaUrl = existingMedia[0].url;
                    post.mediaType = existingMedia[0].type;
                } else {
                    post.mediaUrl = null;
                    post.mediaType = null;
                }
            }
            await post.save();

            // Run Moderation Engine immediately since we have no files to wait for.
            // Notice we pass `true` for the `isEdit` flag at the end!
            const country = req.headers.get("x-user-country") || post.country || "Global";
            const evaluation = await finalizeAndPublishPost(post._id, true, country, post.authorId, true);

            return NextResponse.json({
                message: "Post updated and re-evaluated.",
                post: evaluation.post
            }, { status: 200 });
        }

    } catch (err) {
        console.error("PATCH error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
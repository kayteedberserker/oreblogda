import { awardAura } from "@/app/lib/auraManager";
import { awardClanPoints } from "@/app/lib/clanService";
import { sendPillParallel } from "@/app/lib/messagePillService";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import Notification from "@/app/models/NotificationModel";
import Post from "@/app/models/PostModel";
import StickerModel from "@/app/models/StickerModel";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

// 🏗️ Initialize Cloudflare R2 Client Platform Config
const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});
// --- Helper: Milestone Check Logic ---
const shouldNotifyMilestone = (count) => {
    if (count <= 5) return true;
    if (count <= 50) return count % 10 === 0;
    return count % 50 === 0;
};

// --- Helper: Find a comment nested anywhere inside the branch trees ---
const findCommentById = (comments, id) => {
    for (let c of comments) {
        if (c._id.toString() === id.toString()) return c;
        if (c.replies && c.replies.length > 0) {
            const found = findCommentById(c.replies, id);
            if (found) return found;
        }
    }
    return null;
};

// --- Helper: Get all user IDs in a specific comment branch ---
const getBranchData = (comment) => {
    let userIds = new Set();
    let count = 0;

    const traverse = (node) => {
        count++;
        if (node.authorUserId) userIds.add(node.authorUserId.toString());
        if (node.replies) node.replies.forEach(traverse);
    };

    traverse(comment);
    return { participants: Array.from(userIds), totalMessages: count - 1 };
};

// --- Helper: Populate and Derive Author Data for UI Components ---
const populateAuthors = async (comments) => {
    if (!comments || comments.length === 0) return [];

    const userIds = new Set();

    const extractIds = (nodes) => {
        nodes.forEach(node => {
            if (node.authorUserId) userIds.add(node.authorUserId.toString());
            if (node.replies) extractIds(node.replies);
        });
    };

    extractIds(comments);

    const users = await MobileUser.find({ _id: { $in: Array.from(userIds) } })
        .select("username peakLevel lastStreak consecutiveStreak inventory previousRank")
        .lean();

    const userMap = users.reduce((acc, user) => {
        const equippedItems = user.inventory ? user.inventory.filter(i => i.isEquipped) : [];
        const equippedGlow = equippedItems.find(i => ['GLOW'].includes(i.category?.toUpperCase())) || null;
        const badges = equippedItems.filter(i => i.category?.toUpperCase() === 'BADGE') || [];

        acc[user._id.toString()] = {
            username: user.username || "Guest",
            name: user.username || "Guest",
            peakLevel: user.peakLevel || 0,
            lastStreak: user.lastStreak || 0,
            streak: user.consecutiveStreak || 0,
            auraRank: user.previousRank || null,
            equippedGlow,
            badges
        };
        return acc;
    }, {});

    const attach = (nodes) => {
        return nodes.map(node => {
            const authorData = node.authorUserId ? userMap[node.authorUserId.toString()] : null;
            return {
                ...node,
                author: authorData || { name: node.name || "Anonymous", peakLevel: 0, lastStreak: 0 },
                replies: node.replies ? attach(node.replies) : []
            };
        });
    };

    return attach(comments);
};

export async function GET(req, { params }) {
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 40;
    const skip = (page - 1) * limit;

    try {
        await connectDB();
        const searchFilter = id.includes("-") ? { slug: id } : { _id: id };

        const post = await Post.findOne(searchFilter)
            .select({
                comments: { $slice: [skip, limit] },
                commentCount: { $size: "$comments" }
            })
            .lean();

        if (!post) return NextResponse.json({ message: "Post not found" }, { status: 404 });

        const populatedComments = await populateAuthors(post.comments);

        return NextResponse.json({
            comments: populatedComments,
            total: post.commentCount,
            hasMore: skip + post.comments.length < post.commentCount
        });
    } catch (err) {
        console.error("GET error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}

const TITLE_THRESHOLDS = {
    totalCommentsReceived: [
        { limit: 10, name: "Signal Starter", tier: "COMMON" },
        { limit: 200, name: "Topic Starter", tier: "RARE" },
        { limit: 2000, name: "Debate Master", tier: "EPIC" },
        { limit: 10000, name: "The Great Orator", tier: "LEGENDARY" }
    ],
    lifetimeCommentsMade: [
        { limit: 1, name: "First Response", tier: "COMMON" },
        { limit: 500, name: "Active Citizen", tier: "RARE" }
    ]
};

async function checkTitleUnlocks(user, field, currentCount) {
    const thresholds = TITLE_THRESHOLDS[field];
    if (!thresholds) return null;

    const earnedTitle = [...thresholds].reverse().find(t => currentCount >= t.limit);

    if (earnedTitle) {
        const alreadyHas = user.unlockedTitles?.some(t => t.name === earnedTitle.name);
        if (!alreadyHas) {
            await MobileUser.findByIdAndUpdate(user._id, {
                $addToSet: { unlockedTitles: earnedTitle }
            });

            if (user.pushToken) {
                const titleMsg = `🏆 NEW TITLE: You have received the "${earnedTitle.name}" TITLE!`;
                await sendPillParallel(
                    [user.pushToken],
                    "Title Earned",
                    titleMsg,
                    { type: "achievement" },
                    {
                        type: 'achievement',
                        targetAudience: 'user',
                        targetId: user._id.toString(),
                        singleUser: true,
                        priority: 3
                    }
                );
            }
            return earnedTitle;
        }
    }
    return null;
}

export async function POST(req, { params }) {
    await connectDB();
    const { id } = await params;

    try {
        const body = await req.json();
        const { name, text, stickerId, imageUrl, parentCommentId, replyToCommentId, fingerprint, candidateSources = [] } = body;

        if (!stickerId && !imageUrl && !text?.trim()) {
            return NextResponse.json({ message: "Comment content required" }, { status: 400 });
        }

        const foundMobileUser = await MobileUser.findOne({ deviceId: fingerprint });
        const mobileUserId = foundMobileUser?._id;

        const searchFilter = id.includes("-") ? { slug: id } : { _id: id };
        const post = await Post.findOne(searchFilter);
        if (!post) return NextResponse.json({ message: "Post not found" }, { status: 404 });

        let resolvedStickerUrl = null;
        if (stickerId) {
            const queryConditions = [{ stickerId: stickerId }];
            if (mongoose.Types.ObjectId.isValid(stickerId)) {
                queryConditions.push({ _id: stickerId });
            }
            const stickerDoc = await StickerModel.findOne({ $or: queryConditions });
            if (stickerDoc && stickerDoc.url) {
                resolvedStickerUrl = stickerDoc.url;
            }
        }

        await processTelemetryAndAffinity(fingerprint, post, candidateSources, 'comment', 15);

        const displayTitle = post.title?.length > 20 ? `${post.title.substring(0, 20)}...` : post.title || "Post";
        const commentType = stickerId ? "sticker" : imageUrl ? "image" : "text";
        const commentText = (stickerId || imageUrl) ? "" : (text || "");

        // Pre-generate unique Comment ID to bind natively to R2 Object Keys safely
        const commentMongoId = new mongoose.Types.ObjectId();
        let uploadedImageUrl = imageUrl || null;

        // 🟢 Stream Upload Sequence to Cloudflare R2 Storage Bucket 
        if (imageUrl) {
            let bodyBuffer;
            let contentType = "image/jpeg";

            if (imageUrl.startsWith("data:image")) {
                // Parse standard incoming Base64 Data-URI Strings smoothly
                const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
                if (matches && matches.length === 3) {
                    contentType = matches[1];
                    bodyBuffer = Buffer.from(matches[2], "base64");
                }
            } else if (imageUrl.startsWith("http")) {
                // Fallback process for pre-resolved temporary server caching targets
                try {
                    const response = await fetch(imageUrl);
                    const arrayBuffer = await response.arrayBuffer();
                    bodyBuffer = Buffer.from(arrayBuffer);
                    contentType = response.headers.get("content-type") || "image/jpeg";
                } catch (fetchErr) {
                    console.error("Error pulling remote media layer stream: ", fetchErr);
                }
            }

            if (bodyBuffer) {
                const ext = contentType.split("/")[1] || "jpeg";
                const r2Key = `comments/${id}/${commentMongoId}.${ext}`;

                await r2Client.send(new PutObjectCommand({
                    Bucket: process.env.R2_BUCKET_NAME,
                    Key: r2Key,
                    Body: bodyBuffer,
                    ContentType: contentType
                }));

                const domain = process.env.NEW_DOMAIN || "https://media.oreblogda.com";
                uploadedImageUrl = `${domain}/${r2Key}`;
            }
        }

        const newComment = {
            _id: commentMongoId,
            authorFingerprint: fingerprint,
            authorUserId: mobileUserId,
            name,
            text: commentText,
            stickerId: stickerId || null,
            imageUrl: uploadedImageUrl, // 🌟 Syncing the updated verified R2 storage link location
            type: commentType,
            date: new Date(),
            isEdited: false,
            replies: []
        };

        // 🌟 NESTED SWIPE METADATA SYNCHRONIZATION
        if (parentCommentId && replyToCommentId) {
            const matchedTarget = findCommentById(post.comments, replyToCommentId);
            if (matchedTarget) {
                newComment.replyToCommentId = replyToCommentId;
                newComment.replyToName = matchedTarget.author?.username || matchedTarget.name || 'Anonymous';
                newComment.replyToText = matchedTarget.type === 'sticker' ? '[Sticker]' : matchedTarget.imageUrl ? '[Image]' : matchedTarget.text;
            }
        }

        let targetRootComment = null;
        let immediateRecipientId = null;

        const findAndReply = (comments, rootComment = null) => {
            for (let comment of comments) {
                const currentRoot = rootComment || comment;
                if (comment._id.toString() === parentCommentId) {
                    comment.replies.push(newComment);
                    targetRootComment = currentRoot;
                    return comment.authorUserId;
                }
                if (comment.replies?.length > 0) {
                    const found = findAndReply(comment.replies, currentRoot);
                    if (found) return found;
                }
            }
        };

        if (!parentCommentId) {
            post.comments.unshift(newComment);
            immediateRecipientId = post.authorUserId;

            if (post.authorUserId && post.authorUserId.toString() !== mobileUserId?.toString()) {
                await awardAura(post.authorUserId, 10);
                await awardClanPoints(post, 20, 'comment');

                const postAuthor = await MobileUser.findByIdAndUpdate(
                    post.authorUserId,
                    { $inc: { receivedCommentsCount: 1 } },
                    { new: true }
                );
                if (postAuthor) {
                    await checkTitleUnlocks(postAuthor, "totalCommentsReceived", postAuthor.receivedCommentsCount);
                }
            }
        } else {
            immediateRecipientId = findAndReply(post.comments);
            if (!immediateRecipientId) return NextResponse.json({ message: "Signal lost" }, { status: 404 });
            post.markModified("comments");

            if (immediateRecipientId.toString() !== mobileUserId?.toString()) {
                await awardAura(immediateRecipientId, 5);
                await awardClanPoints(post, 10, 'comment');

                const parentAuthor = await MobileUser.findByIdAndUpdate(
                    immediateRecipientId,
                    { $inc: { receivedCommentsCount: 1 } },
                    { new: true }
                );
                if (parentAuthor) {
                    await checkTitleUnlocks(parentAuthor, "totalCommentsReceived", parentAuthor.receivedCommentsCount);
                }
            }
        }

        if (mobileUserId) {
            const updatedCommenter = await MobileUser.findByIdAndUpdate(
                mobileUserId,
                { $inc: { lifetimeCommentsCount: 1 } },
                { new: true }
            );
            if (updatedCommenter) {
                await checkTitleUnlocks(updatedCommenter, "lifetimeCommentsMade", updatedCommenter.lifetimeCommentsCount);
            }
        }

        await post.save();
        const notifications = [];

        if (parentCommentId && immediateRecipientId?.toString() !== mobileUserId?.toString()) {
            notifications.push({
                recipientId: immediateRecipientId,
                title: "New Reply 💬",
                message: stickerId ? `${name} sent a sticker on "${displayTitle}"` : uploadedImageUrl ? `${name} shared an image on "${displayTitle}"` : `${name} on "${displayTitle}": "${text?.substring(0, 20)}..."`,
                type: "reply",
                commentId: targetRootComment?._id || parentCommentId,
                isMongoId: true
            });
        }

        if (!parentCommentId && post.authorUserId && post.authorUserId.toString() !== mobileUserId?.toString()) {
            notifications.push({
                recipientId: post.authorUserId,
                title: "New Signal 📝",
                message: stickerId ? `${name} sent a sticker on "${displayTitle}"` : uploadedImageUrl ? `${name} shared an image on "${displayTitle}"` : `${name} commented on "${displayTitle}" (#${post.comments.length})`,
                type: "comment",
                commentId: newComment._id,
                isMongoId: true
            });
        }

        if (parentCommentId && targetRootComment) {
            const { participants, totalMessages } = getBranchData(targetRootComment);

            if (totalMessages > 0 && totalMessages % 5 === 0) {
                const rewardIds = new Set(participants);
                if (post.authorUserId) rewardIds.add(post.authorUserId.toString());
                if (mobileUserId) rewardIds.delete(mobileUserId.toString());

                const idsToReward = Array.from(rewardIds);
                if (idsToReward.length > 0) {
                    await Promise.all(idsToReward.map(id => awardAura(id, 1)));
                    await awardClanPoints(post, 5, 'comment');
                }
            }

            if (typeof shouldNotifyMilestone === 'function' && shouldNotifyMilestone(totalMessages)) {
                const discussionMsg = `[${displayTitle}] Active: ${totalMessages} replies on ${targetRootComment.name}'s signal.`;
                participants.forEach(pId => {
                    if (pId !== mobileUserId?.toString()) {
                        notifications.push({
                            recipientId: pId,
                            title: "Discussion Active 🔥",
                            message: discussionMsg,
                            type: "discussion",
                            commentId: targetRootComment._id,
                            isMongoId: true
                        });
                    }
                });
            }
        }

        await Promise.all(notifications.map(async (n) => {
            const query = n.isMongoId ? { _id: n.recipientId } : { deviceId: n.recipientId };
            const user = await MobileUser.findOne(query);

            if (user) {
                await Notification.create({
                    recipientId: user.deviceId,
                    senderName: name,
                    type: n.type,
                    postId: post._id,
                    message: n.message
                });

                if (user.pushToken) {
                    await sendPillParallel(
                        [user.pushToken],
                        n.title,
                        n.message,
                        {
                            postId: post._id.toString(),
                            type: n.type,
                            commentId: n.commentId?.toString(),
                            mediaUrl: resolvedStickerUrl ? resolvedStickerUrl : uploadedImageUrl ? uploadedImageUrl : post.mediaUrl,
                            authorPfp: foundMobileUser?.profilePic?.url
                        },
                        {
                            type: `post_${n.type}`,
                            targetAudience: 'user',
                            targetId: user._id.toString(),
                            singleUser: true,
                            link: `/post/${post.slug}`,
                            priority: 2
                        }
                    );
                }
            }
        }));

        let enrichedAuthor = { name: newComment.name };
        const latestSender = await MobileUser.findOne({ deviceId: fingerprint });

        if (latestSender) {
            const equippedItems = latestSender.inventory ? latestSender.inventory.filter(i => i.isEquipped) : [];
            enrichedAuthor = {
                username: latestSender.username,
                name: latestSender.username,
                peakLevel: latestSender.peakLevel || 0,
                lastStreak: latestSender.lastStreak || 0,
                streak: latestSender.consecutiveStreak || 0,
                auraRank: latestSender.previousRank || null,
                equippedGlow: equippedItems.find(i => ['GLOW', 'NAME_GLOW', 'TEXT_GLOW', 'EFFECT'].includes(i.category?.toUpperCase())) || null,
                badges: equippedItems.filter(i => i.category?.toUpperCase() === 'BADGE') || []
            };
        }

        // Map parameters to return the accurate state back to the UI context smoothly
        const enrichedNewComment = {
            ...newComment,
            author: enrichedAuthor
        };

        return NextResponse.json({ comment: enrichedNewComment }, { status: 201 });
    } catch (err) {
        console.error("POST error:", err);
        return NextResponse.json({ message: "Error", error: err.message }, { status: 500 });
    }
}

// 🌟 NEW: DELETE Route for Removing Comments (Reads id from URL search parameters)
export async function DELETE(req, { params }) {
    await connectDB();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("id");

    try {
        if (!commentId) {
            return NextResponse.json({ message: "Missing commentId query param" }, { status: 400 });
        }

        // Extract verification details securely out of request headers
        const fingerprint = req.headers.get("x-user-deviceId") || req.headers.get("x-device-id");
        const foundMobileUser = fingerprint ? await MobileUser.findOne({ deviceId: fingerprint }) : null;
        const mobileUserId = foundMobileUser?._id;

        const searchFilter = id.includes("-") ? { slug: id } : { _id: id };
        const post = await Post.findOne(searchFilter);
        if (!post) return NextResponse.json({ message: "Post not found" }, { status: 404 });

        let deleted = false;
        let imageToDeleteUrl = null;

        const deleteComment = (comments) => {
            for (let i = 0; i < comments.length; i++) {
                if (comments[i]._id.toString() === commentId) {
                    const isOwner =
                        (fingerprint && comments[i].authorFingerprint === fingerprint) ||
                        (mobileUserId && comments[i].authorUserId?.toString() === mobileUserId.toString());

                    if (!isOwner) {
                        throw new Error("Unauthorized");
                    }

                    // 📸 Cache the storage reference URL securely right before array splice occurs
                    if (comments[i].imageUrl) {
                        imageToDeleteUrl = comments[i].imageUrl;
                    }

                    comments.splice(i, 1);
                    deleted = true;
                    return;
                }
                if (comments[i].replies && comments[i].replies.length > 0) {
                    deleteComment(comments[i].replies);
                }
            }
        };

        try {
            deleteComment(post.comments);
        } catch (err) {
            if (err.message === "Unauthorized") {
                return NextResponse.json({ message: "Unauthorized: You can only delete your own comments" }, { status: 403 });
            }
        }

        if (!deleted) return NextResponse.json({ message: "Comment not found" }, { status: 404 });

        post.markModified("comments");
        await post.save();

        // 🗑️ Purge asset out from Cloudflare R2 bucket interface targets asynchronously
        if (imageToDeleteUrl) {
            try {
                const domain = process.env.NEW_DOMAIN || "https://media.oreblogda.com";
                if (imageToDeleteUrl.includes(domain)) {
                    const r2Key = imageToDeleteUrl.split(`${domain}/`)[1];
                    if (r2Key) {
                        await r2Client.send(new DeleteObjectCommand({
                            Bucket: process.env.R2_BUCKET_NAME,
                            Key: r2Key
                        }));
                    }
                }
            } catch (r2DelErr) {
                console.error("Failed to drop deleted comment media asset from Cloudflare R2:", r2DelErr);
            }
        }

        return NextResponse.json({ message: "Comment deleted successfully" }, { status: 200 });
    } catch (err) {
        console.error("DELETE error:", err);
        return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
    }
}

// 🌟 NEW: PATCH Route for Editing Comments (Reads id from URL search parameters)
export async function PATCH(req, { params }) {
    await connectDB();
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("id");

    try {
        const body = await req.json();
        const { text } = body;

        if (!commentId || !text?.trim()) {
            return NextResponse.json({ message: "Missing commentId or updated text" }, { status: 400 });
        }

        // Extract credentials securely out of headers since the frontend body only yields { text }
        const fingerprint = req.headers.get("x-user-deviceId") || req.headers.get("x-device-id");
        const foundMobileUser = fingerprint ? await MobileUser.findOne({ deviceId: fingerprint }) : null;
        const mobileUserId = foundMobileUser?._id;

        const searchFilter = id.includes("-") ? { slug: id } : { _id: id };
        const post = await Post.findOne(searchFilter);
        if (!post) return NextResponse.json({ message: "Post not found" }, { status: 404 });

        const targetComment = findCommentById(post.comments, commentId);
        if (!targetComment) return NextResponse.json({ message: "Comment not found" }, { status: 404 });

        // 🛡️ SERVER-SIDE SECURITY CHECK: Validate Ownership
        const isOwner =
            (fingerprint && targetComment.authorFingerprint === fingerprint) ||
            (mobileUserId && targetComment.authorUserId?.toString() === mobileUserId.toString());

        if (!isOwner) {
            return NextResponse.json({ message: "Unauthorized: You can only edit your own comments" }, { status: 403 });
        }

        targetComment.text = text;
        targetComment.isEdited = true;

        post.markModified("comments");
        await post.save();

        return NextResponse.json({ message: "Comment updated successfully", comment: targetComment }, { status: 200 });
    } catch (err) {
        console.error("PATCH error:", err);
        return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
    }
}


// ----------------------
// 🧠 UNIFIED HELPER: Telemetry, Affinity, Decay, & Optimization
// ----------------------
async function processTelemetryAndAffinity(fingerprint, post, candidateSources, action, weight) {
    if (!fingerprint || !post) return;

    try {
        const user = await MobileUser.findOne({ deviceId: fingerprint })
            .select('affinityScores authorAffinity countryAffinity feedLearning');
        if (!user) return;

        // --- A. AFFINITY UPDATES (Dynamic Ranking Signal) ---
        // We still update these dynamically because they govern what the user SEES (Ranking)
        const tagWeight = weight;
        const authorWeight = Math.round(weight * 0.5);
        const countryWeight = Math.round(weight * 0.25);

        let affinityScores = user.affinityScores ? (user.affinityScores instanceof Map ? Object.fromEntries(user.affinityScores) : user.affinityScores) : {};
        let authorAffinity = user.authorAffinity ? (user.authorAffinity instanceof Map ? Object.fromEntries(user.authorAffinity) : user.authorAffinity) : {};
        let countryAffinity = user.countryAffinity ? (user.countryAffinity instanceof Map ? Object.fromEntries(user.countryAffinity) : user.countryAffinity) : {};

        const updateAndTrim = (obj, key, addWeight, limit) => {
            if (!key) return obj;
            const sanitizedKey = key.replace(/\./g, '_').replace(/\$/g, '');
            if (!sanitizedKey) return obj;

            const current = typeof obj[sanitizedKey] === "number" ? obj[sanitizedKey] : 0;
            obj[sanitizedKey] = current + addWeight;

            if (Object.keys(obj).length > limit + 10) {
                const sortedEntries = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit);
                return Object.fromEntries(sortedEntries);
            }
            return obj;
        };

        if (post.interests && Array.isArray(post.interests)) {
            post.interests.forEach(tag => {
                if (tag) affinityScores = updateAndTrim(affinityScores, tag.trim().toLowerCase(), tagWeight, 50);
            });
        }
        const targetAuthor = post.authorUserId ? post.authorUserId.toString() : post.authorId;
        if (targetAuthor && targetAuthor !== fingerprint) {
            authorAffinity = updateAndTrim(authorAffinity, targetAuthor, authorWeight, 30);
        }
        if (post.country && post.country !== "Global" && post.country !== "Unknown") {
            countryAffinity = updateAndTrim(countryAffinity, post.country, countryWeight, 10);
        }

        // --- B. TELEMETRY INCREMENTS (🌟 UPDATED: FIXED POOL CONFIDENCE) ---
        // We use static confidence to govern how the algorithm LEARNS (Attribution)
        const actionMap = {
            'view': 'impressions', 'like': 'likes', 'share': 'shares',
            'vote': 'votes', 'watch_complete': 'watch_complete',
            'skip': 'skips', 'not_interested': 'skips',
            'comment': 'comments',
            'hype': 'votes'
        };
        const metric = actionMap[action];
        const validPools = ['fresh', 'author', 'clan', 'interest', 'trending', 'explore'];
        const incUpdates = {};

        if (metric && Array.isArray(candidateSources) && candidateSources.length > 0) {

            // 1. Extract Unique Pool Types (Prevents double-counting if a post had 2 interest tags)
            const uniqueTypes = [...new Set(candidateSources.map(s => s.type).filter(t => validPools.includes(t)))];

            if (uniqueTypes.length > 0) {
                // 2. Static Pool Confidence Tiers
                const POOL_CONFIDENCE = {
                    explore: 1,
                    fresh: 1,
                    clan: 2,
                    trending: 4,
                    interest: 4,
                    author: 4
                }

                let totalConfidence = 0;

                // 3. Map to confidence scores and sum them up
                const scoredSources = uniqueTypes.map(type => {
                    const conf = POOL_CONFIDENCE[type] || 1;
                    totalConfidence += conf;
                    return { type, conf };
                });

                // 4. Normalize to 1.0 and increment
                scoredSources.forEach(source => {
                    const normalizedFraction = parseFloat((source.conf / totalConfidence).toFixed(3));

                    if (!isNaN(normalizedFraction) && normalizedFraction > 0) {
                        incUpdates[`feedLearning.sourceStats.${source.type}.${metric}`] = normalizedFraction;
                    }
                });
            }
        }

        // --- C. OPTIMIZATION & DECAY CHECK ---
        let setUpdates = { affinityScores, authorAffinity, countryAffinity };

        if (user.feedLearning) {
            const lastOpt = user.feedLearning.lastOptimizedAt || new Date(0);
            const stats = user.feedLearning.sourceStats || {};

            let totalImpressions = 0;
            validPools.forEach(pool => { totalImpressions += (stats[pool]?.impressions || 0); });

            // Exactly 1 impression is distributed, so we increment the total by 1
            if (metric === 'impressions' && Object.keys(incUpdates).length > 0) {
                totalImpressions += 1;
            }

            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (Date.now() - lastOpt.getTime() >= twentyFourHours && totalImpressions >= 100) {
                // 1. DECAY OLD AFFINITIES
                const decayMap = (mapObj, factor = 0.98) => {
                    for (let key in mapObj) {
                        mapObj[key] = Math.max(0.1, Number((mapObj[key] * factor).toFixed(2)));
                        if (mapObj[key] < 1) delete mapObj[key];
                    }
                };
                decayMap(setUpdates.affinityScores);
                decayMap(setUpdates.authorAffinity);
                decayMap(setUpdates.countryAffinity);

                // 2. RATE-BASED POOL SCORING
                let totalScore = 0;
                const rawScores = {};

                validPools.forEach(pool => {
                    const s = stats[pool] || {};
                    const imp = (s.impressions || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.impressions`] || 0);
                    let score = 0;

                    if (imp < 20) {
                        score = 50;
                    } else {
                        const likeRate = ((s.likes || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.likes`] || 0)) / imp;
                        const voteRate = ((s.votes || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.votes`] || 0)) / imp;
                        const watchRate = ((s.watch_complete || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.watch_complete`] || 0)) / imp;
                        const commentRate = ((s.comments || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.comments`] || 0)) / imp;
                        const shareRate = ((s.shares || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.shares`] || 0)) / imp;
                        const skipRate = ((s.skips || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.skips`] || 0)) / imp;

                        score = 10 + (likeRate * 50) + (voteRate * 50) + (watchRate * 80) +
                            (commentRate * 100) + (shareRate * 150) + (skipRate * -60);
                    }

                    rawScores[pool] = Math.max(10, score);
                    totalScore += rawScores[pool];
                });

                // 3. Exact Normalization (Fixing the edge case)
                const newWeights = {};

                // Set initial pure ratio
                validPools.forEach(pool => newWeights[pool] = rawScores[pool] / totalScore);

                // Enforce the clamping boundaries
                let clampedTotal = 0;
                validPools.forEach(pool => {
                    newWeights[pool] = Math.max(0.05, Math.min(0.45, newWeights[pool]));
                    clampedTotal += newWeights[pool];
                });

                // Divide by the new clamped boundary sum to safely guarantee exact 1.0 distribution
                validPools.forEach(pool => {
                    newWeights[pool] = parseFloat((newWeights[pool] / clampedTotal).toFixed(3));
                });

                setUpdates["feedLearning.poolWeights"] = newWeights;
                setUpdates["feedLearning.lastOptimizedAt"] = new Date();

                // 4. RESET STATS
                Object.keys(incUpdates).forEach(key => delete incUpdates[key]);
                validPools.forEach(pool => {
                    setUpdates[`feedLearning.sourceStats.${pool}.impressions`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.likes`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.votes`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.watch_complete`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.comments`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.shares`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.skips`] = 0;
                });
                console.log(`[ML] Epoch closed. Re-optimized pools & decayed affinities for ${fingerprint}:`, newWeights);
            }
        }

        // --- D. EXECUTE SINGLE ATOMIC UPDATE ---
        const updateOperation = { $set: setUpdates };
        if (Object.keys(incUpdates).length > 0) {
            updateOperation.$inc = incUpdates;
        }

        await MobileUser.updateOne({ _id: user._id }, updateOperation);

    } catch (err) {
        console.error("❌ Unified Telemetry Error:", err);
    }
}
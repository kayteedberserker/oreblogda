import { awardClanPoints } from "@/app/lib/clanService";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import Notification from "@/app/models/NotificationModel";
import Post from "@/app/models/PostModel";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
// ⚡️ Add this import at the top of your file
import { awardAura } from "@/app/lib/auraManager";
import { sendPillParallel } from "@/app/lib/messagePillService";
import StickerModel from "@/app/models/StickerModel";

// --- Helper: Milestone Check Logic ---
const shouldNotifyMilestone = (count) => {
    if (count <= 5) return true;
    if (count <= 50) return count % 10 === 0;
    return count % 50 === 0;
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

    // Fetch only the necessary fields to derive our UI requirements
    const users = await MobileUser.find({ _id: { $in: Array.from(userIds) } })
        .select("username peakLevel lastStreak consecutiveStreak inventory previousRank")
        .lean();
    const userMap = users.reduce((acc, user) => {
        // 1. Get all equipped inventory items
        const equippedItems = user.inventory ? user.inventory.filter(i => i.isEquipped) : [];

        // 2. Derive specific items
        // Checking a few common categories for glows, adjust if your specific category name is different
        const equippedGlow = equippedItems.find(i => ['GLOW'].includes(i.category?.toUpperCase())) || null;

        const badges = equippedItems.filter(i => i.category?.toUpperCase() === 'BADGE') || [];

        // 3. Map to the exact structure the frontend expects
        acc[user._id.toString()] = {
            username: user.username || "Guest",
            name: user.username || "Guest",
            peakLevel: user.peakLevel || 0,
            lastStreak: user.lastStreak || 0,
            streak: user.consecutiveStreak || 0,
            auraRank: user.previousRank || null, // Mapping previousRank to auraRank
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

        // Populate and derive authors before sending response
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

// 🏆 Updated Threshold Mapping
const TITLE_THRESHOLDS = {
    totalCommentsReceived: [
        { limit: 10, name: "Signal Starter", tier: "COMMON" },
        { limit: 200, name: "Topic Starter", tier: "RARE" },
        { limit: 2000, name: "Debate Master", tier: "EPIC" },
        { limit: 10000, name: "The Great Orator", tier: "LEGENDARY" }
    ],
    lifetimeCommentsMade: [
        { limit: 1, name: "First Response", tier: "COMMON" }, // Special "First Time" title
        { limit: 500, name: "Active Citizen", tier: "RARE" }
    ]
};

// 🛠 Helper to check and award titles using parallel notification stack
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

            // 🔔 Handle Notifications for Title Unlock
            if (user.pushToken) {
                const titleMsg = `🏆 NEW TITLE: You have received the "${earnedTitle.name}" TITLE!`;

                // Push Notification

                // UI Pill
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
        // 🌟 FIX: Destructure candidateSources from the incoming request body
        const { name, text, stickerId, parentCommentId, replyTo, fingerprint, candidateSources = [] } = body;

        if (!stickerId && !text?.trim()) {
            return NextResponse.json({ message: "Comment text or stickerId required" }, { status: 400 });
        }

        // Identify who is making the comment
        const foundMobileUser = await MobileUser.findOne({ deviceId: fingerprint });
        const mobileUserId = foundMobileUser?._id;

        const searchFilter = id.includes("-") ? { slug: id } : { _id: id };
        const post = await Post.findOne(searchFilter);
        if (!post) return NextResponse.json({ message: "Post not found" }, { status: 404 });

        // 🌟 NEW: Fetch the actual sticker URL from the database if a sticker was used
        let resolvedStickerUrl = null;
        if (stickerId) {
            // Build a dynamic query matching layout structure safely to avoid CastErrors
            const queryConditions = [{ stickerId: stickerId }];

            // 🛡️ Only evaluate _id if the incoming identifier passes standard validation lengths
            if (mongoose.Types.ObjectId.isValid(stickerId)) {
                queryConditions.push({ _id: stickerId });
            }

            const stickerDoc = await StickerModel.findOne({
                $or: queryConditions
            });

            if (stickerDoc && stickerDoc.url) {
                resolvedStickerUrl = stickerDoc.url;
            }
        }

        // 🧠 AFFINITY & TELEMETRY: +15 for Commenting (High effort interaction)
        // 🌟 FIX: Now using the unified helper instead of updateUserAffinityByFingerprint
        await processTelemetryAndAffinity(fingerprint, post, candidateSources, 'comment', 15);

        // Truncate post title for notifications (Max 20 chars)
        const displayTitle = post.title?.length > 20
            ? `${post.title.substring(0, 20)}...`
            : post.title || "Post";

        const commentType = stickerId ? "sticker" : "text";
        const commentText = stickerId ? "" : (text || "");

        const newComment = {
            _id: new mongoose.Types.ObjectId(),
            authorFingerprint: fingerprint,
            authorUserId: mobileUserId,
            name,
            text: commentText,
            stickerId: stickerId || null,
            type: commentType,
            replyTo: replyTo || null,
            date: new Date(),
            replies: []
        };

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

        // ⚡️ RULE 1: TOP-LEVEL COMMENT AURA & STATS
        if (!parentCommentId) {
            post.comments.unshift(newComment);
            immediateRecipientId = post.authorUserId;

            if (post.authorUserId && post.authorUserId.toString() !== mobileUserId?.toString()) {
                await awardAura(post.authorUserId, 10);
                await awardClanPoints(post, 20, 'comment');

                // 🏆 TITLE LOGIC: Increment Recipient's stats and check unlock
                const postAuthor = await MobileUser.findByIdAndUpdate(
                    post.authorUserId,
                    { $inc: { receivedCommentsCount: 1 } },
                    { new: true }
                );

                if (postAuthor) {
                    await checkTitleUnlocks(postAuthor, "totalCommentsReceived", postAuthor.receivedCommentsCount);
                }
            }
        }
        // ⚡️ RULE 2: REPLY AURA & STATS
        else {
            immediateRecipientId = findAndReply(post.comments);
            if (!immediateRecipientId) return NextResponse.json({ message: "Signal lost" }, { status: 404 });
            post.markModified("comments");

            if (immediateRecipientId.toString() !== mobileUserId?.toString()) {
                await awardAura(immediateRecipientId, 5);
                await awardClanPoints(post, 10, 'comment');

                // 🏆 TITLE LOGIC: Increment Parent Author's stats and check unlock
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

        // 🏆 TITLE LOGIC: Increment Commenter's lifetime stats and check unlock
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

        // --- NOTIFICATION LOGIC ---
        if (parentCommentId && immediateRecipientId?.toString() !== mobileUserId?.toString()) {
            notifications.push({
                recipientId: immediateRecipientId,
                title: "New Reply 💬",
                message: stickerId
                    ? `${name} sent a sticker on "${displayTitle}"`
                    : `${name} on "${displayTitle}": "${text?.substring(0, 20)}..."`,
                type: "reply",
                commentId: targetRootComment?._id || parentCommentId,
                isMongoId: true
            });
        }

        if (!parentCommentId && post.authorUserId && post.authorUserId.toString() !== mobileUserId?.toString()) {
            notifications.push({
                recipientId: post.authorUserId,
                title: "New Signal 📝",
                message: stickerId
                    ? `${name} sent a sticker on "${displayTitle}"`
                    : `${name} commented on "${displayTitle}" (#${post.comments.length})`,
                type: "comment",
                commentId: newComment._id,
                isMongoId: true
            });
        }

        // ⚡️ RULE 3: THE DISCUSSION MULTIPLIER (Every 5 Replies)
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
                // Create the record in your database
                await Notification.create({
                    recipientId: user.deviceId,
                    senderName: name,
                    type: n.type,
                    postId: post._id,
                    message: n.message
                });

                // Send the Rich Notification
                if (user.pushToken) {
                    const tokens = [user.pushToken];
                    const groupId = `${n.type}_${post._id}`;

                    await sendPillParallel(
                        tokens,
                        n.title,
                        n.message,
                        {
                            postId: post._id.toString(),
                            type: n.type,
                            commentId: n.commentId?.toString(),
                            // 🌟 FIXED: We inject the successfully queried Sticker URL here, falling back to the post image if no sticker exists
                            mediaUrl: resolvedStickerUrl ? resolvedStickerUrl : post.mediaUrl,
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

        // Prepare response data with enriched profile info
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
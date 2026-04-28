import { awardClanPoints } from "@/app/lib/clanService";
import connectDB from "@/app/lib/mongodb";
import { sendPushNotification } from "@/app/lib/pushNotifications";
import MobileUser from "@/app/models/MobileUserModel";
import Notification from "@/app/models/NotificationModel";
import Post from "@/app/models/PostModel";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
// ⚡️ Add this import at the top of your file
import { awardAura } from "@/app/lib/auraManager";
import { sendPillParallel } from "@/app/lib/messagePillService";
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
  console.log(user, field, currentCount);

  if (!thresholds) return null;

  const earnedTitle = [...thresholds].reverse().find(t => currentCount >= t.limit);
  console.log(earnedTitle);

  if (earnedTitle) {
    const alreadyHas = user.unlockedTitles?.some(t => t.name === earnedTitle.name);
    if (!alreadyHas) {
      await MobileUser.findByIdAndUpdate(user._id, {
        $addToSet: { unlockedTitles: earnedTitle }
      });

      // 🔔 Handle Notifications for Title Unlock
      if (user.pushToken) {
        const titleMsg = `🏆 NEW TITLE: You are now a "${earnedTitle.name}"!`;

        // Push Notification
        await sendPushNotification(
          user.pushToken,
          "Achievement Unlocked! 🎖",
          titleMsg,
          { type: "achievement" }
        );

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
    const { name, text, stickerId, parentCommentId, replyTo, fingerprint } = body;

    if (!stickerId && !text?.trim()) {
      return NextResponse.json({ message: "Comment text or stickerId required" }, { status: 400 });
    }

    // Identify who is making the comment
    const foundMobileUser = await MobileUser.findOne({ deviceId: fingerprint });
    const mobileUserId = foundMobileUser?._id;

    const searchFilter = id.includes("-") ? { slug: id } : { _id: id };
    const post = await Post.findOne(searchFilter);
    if (!post) return NextResponse.json({ message: "Post not found" }, { status: 404 });

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
          ? `${name} sent a sticker`
          : `${name} replied: "${text?.substring(0, 20)}..."`,
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
          ? `${name} started a new signal with a sticker`
          : `${name} started a new signal (#${post.comments.length})`,
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
        const discussionMsg = `Discussion Ongoing: ${totalMessages} replies on ${targetRootComment.name}'s signal.`;
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

        if (user.pushToken && typeof sendPushNotification === 'function') {
          const tokens = [user.pushToken];
          const groupId = `${n.type}_${post._id}`;
          await sendPillParallel(
            tokens,
            n.title,
            n.message,
            {
              postId: post._id.toString(),
              type: n.type,
              commentId: n.commentId?.toString()
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
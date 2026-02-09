import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import Notification from "@/app/models/NotificationModel";
import MobileUser from "@/app/models/MobileUserModel";
import { sendPushNotification } from "@/app/lib/pushNotifications";
import mongoose from "mongoose";
import { awardClanPoints } from "@/app/lib/clanService";

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
      });

    if (!post) return NextResponse.json({ message: "Post not found" }, { status: 404 });

    return NextResponse.json({
      comments: post.comments,
      total: post.commentCount,
      hasMore: skip + post.comments.length < post.commentCount
    });
  } catch (err) {
    console.error("GET error:", err);
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
// ... (keep all imports and helpers)

export async function POST(req, { params }) {
  await connectDB();
  const { id } = await params;

  try {
    const body = await req.json();
    const { name, text, parentCommentId, replyTo, fingerprint } = body;

    const foundMobileUser = await MobileUser.findOne({ deviceId: fingerprint });
    const mobileUserId = foundMobileUser?._id;

    const searchFilter = id.includes("-") ? { slug: id } : { _id: id };
    const post = await Post.findOne(searchFilter);
    if (!post) return NextResponse.json({ message: "Post not found" }, { status: 404 });

    const newComment = {
      _id: new mongoose.Types.ObjectId(),
      authorFingerprint: fingerprint,
      authorUserId: mobileUserId,
      name,
      text,
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

    if (mobileUserId) {
      await MobileUser.updateOne({ _id: mobileUserId }, { $inc: { weeklyAura: 1 } });
      await awardClanPoints(post, 1, 'comment');
    }

    if (!parentCommentId) {
      post.comments.unshift(newComment);
      immediateRecipientId = post.authorUserId;
      if (post.authorUserId && post.authorUserId.toString() !== mobileUserId?.toString()) {
        await MobileUser.updateOne({ _id: post.authorUserId }, { $inc: { weeklyAura: 3 } });
        await awardClanPoints(post, 3, 'comment');
      }
    } else {
      immediateRecipientId = findAndReply(post.comments);
      if (!immediateRecipientId) return NextResponse.json({ message: "Signal lost" }, { status: 404 });
      post.markModified("comments");

      if (immediateRecipientId.toString() !== mobileUserId?.toString()) {
        await MobileUser.updateOne({ _id: immediateRecipientId }, { $inc: { weeklyAura: 3 } });
        await awardClanPoints(post, 2, 'comment');
      }
    }

    await post.save();

    const notifications = [];

    // --- NOTIFICATION LOGIC UPDATED TO INCLUDE commentId ---
    if (parentCommentId && immediateRecipientId?.toString() !== mobileUserId?.toString()) {
      notifications.push({
        recipientId: immediateRecipientId,
        title: "New Reply 💬",
        message: `${name} replied: "${text.substring(0, 20)}..."`,
        type: "reply",
        commentId: targetRootComment?._id || parentCommentId, // 👈 KEY ADDITION
        isMongoId: true
      });
    }

    if (!parentCommentId && post.authorUserId && post.authorUserId.toString() !== mobileUserId?.toString()) {
      notifications.push({
        recipientId: post.authorUserId,
        title: "New Signal 📝",
        message: `${name} started a new signal (#${post.comments.length})`,
        type: "comment",
        commentId: newComment._id, // 👈 KEY ADDITION
        isMongoId: true
      });
    }

    if (parentCommentId && targetRootComment) {
      const { participants, totalMessages } = getBranchData(targetRootComment);

      if (totalMessages > 0 && totalMessages % 5 === 0) {
        if (targetRootComment.authorUserId && targetRootComment.authorUserId.toString() !== mobileUserId?.toString()) {
          await MobileUser.updateOne({ _id: targetRootComment.authorUserId }, { $inc: { weeklyAura: 1 } });
          await awardClanPoints(post, 2, 'comment');
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
              commentId: targetRootComment._id, // 👈 KEY ADDITION
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
          const groupId = `${n.type}_${post._id}`;
          await sendPushNotification(
            user.pushToken,
            n.title,
            n.message,
            { 
              postId: post._id.toString(), 
              type: n.type, 
              commentId: n.commentId?.toString() // 👈 PASSING TO PUSH
            },
            groupId
          );
        }
      }
    }));

    return NextResponse.json({ comment: newComment }, { status: 201 });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ message: "Error", error: err.message }, { status: 500 });
  }
}

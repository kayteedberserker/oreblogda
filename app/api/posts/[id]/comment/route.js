import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import Notification from "@/app/models/NotificationModel";
import MobileUser from "@/app/models/MobileUserModel";
import { sendPushNotification } from "@/app/lib/pushNotifications";
import mongoose from "mongoose";

// --- Helper: Milestone Check Logic ---
const shouldNotifyMilestone = (count) => {
  if (count <= 5) return true; // 1, 2, 3, 4, 5
  if (count <= 50) return count % 10 === 0; // 10, 20, 30, 40, 50
  return count % 50 === 0; // 100, 150, 200, 250...
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
  
  // Pagination Defaults
  const page = parseInt(searchParams.get("page")) || 1;
  const limit = parseInt(searchParams.get("limit")) || 40;
  const skip = (page - 1) * limit;

  try {
    await connectDB();
    const searchFilter = id.includes("-") ? { slug: id } : { _id: id };

    // We fetch the total count and the sliced comments
    const post = await Post.findOne(searchFilter)
      .select({ 
        comments: { $slice: [skip, limit] },
        // Also get total length of comments array for pagination logic
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

export async function POST(req, { params }) {
  await connectDB();
  const { id } = await params;

  try {
    const { name, text, parentCommentId, replyTo, fingerprint, userId } = await req.json();

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

    if (!parentCommentId) {
      post.comments.unshift(newComment);
      const totalTopLevel = post.comments.length;
      if (shouldNotifyMilestone(totalTopLevel)) {
        immediateRecipientId = post.authorUserId;
      }
    } else {
      immediateRecipientId = findAndReply(post.comments);
      if (!immediateRecipientId) {
        return NextResponse.json({ message: "Signal lost" }, { status: 404 });
      }
      post.markModified("comments");
    }

    await post.save();

    const notifications = [];

    if (parentCommentId && immediateRecipientId?.toString() !== mobileUserId?.toString()) {
      notifications.push({
        recipientId: immediateRecipientId,
        title: "New Reply 💬",
        message: `${name} replied: "${text.substring(0, 20)}..."`,
        type: "reply"
      });
    }

    if (!parentCommentId && immediateRecipientId?.toString() !== mobileUserId?.toString()) {
      notifications.push({
        recipientId: immediateRecipientId,
        title: "New Signal 📝",
        message: `${name} started a new signal (#${post.comments.length})`,
        type: "comment"
      });
    }

    if (parentCommentId && targetRootComment) {
      const { participants, totalMessages } = getBranchData(targetRootComment);
      if (shouldNotifyMilestone(totalMessages)) {
        const discussionMsg = `Discussion Ongoing: ${totalMessages} replies on ${targetRootComment.name}'s signal.`;
        participants.forEach(pId => {
          if (pId !== mobileUserId?.toString()) {
            notifications.push({
              recipientId: pId,
              title: "Discussion Active 🔥",
              message: discussionMsg,
              type: "discussion"
            });
          }
        });
        if (!participants.includes(post.authorUserId?.toString())) {
            notifications.push({
                recipientId: post.authorUserId,
                title: "Trending Discussion 📈",
                message: discussionMsg,
                type: "discussion"
            });
        }
      }
    }

    await Promise.all(notifications.map(async (n) => {
      await Notification.create({
        recipientId: n.recipientId,
        senderName: name,
        type: n.type,
        postId: post._id,
        message: n.message
      });
      const user = await MobileUser.findById(n.recipientId);
      if (user?.pushToken) {
        await sendPushNotification(user.pushToken, n.title, n.message, { 
          postId: post._id.toString(), 
          type: n.type 
        });
      }
    }));

    return NextResponse.json({ comment: newComment }, { status: 201 });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}

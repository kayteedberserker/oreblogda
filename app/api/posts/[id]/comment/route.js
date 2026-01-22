import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import Notification from "@/app/models/NotificationModel";
import MobileUser from "@/app/models/MobileUserModel";
import { sendPushNotification } from "@/app/lib/pushNotifications";
import mongoose from "mongoose";

export async function GET(req, { params }) {
  const { id } = await params;
  try {
    await connectDB();
    const searchFilter = id.includes("-") ? { slug: id } : { _id: id };
    const post = await Post.findOne(searchFilter).select("comments");
    if (!post) return NextResponse.json({ message: "Post not found" }, { status: 404 });
    return NextResponse.json({ comments: post.comments });
  } catch (err) {
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
      replyTo: replyTo || null, // Persist who is being replied to
      date: new Date(),
      replies: []
    };

    let recipientUserId = null;
    let type = "comment";

    if (!parentCommentId) {
      post.comments.unshift(newComment);
      recipientUserId = post.authorUserId; // Post owner
    } else {
      type = "reply";
      const insertReply = (comments) => {
        for (const c of comments) {
          if (c._id.toString() === parentCommentId) {
            recipientUserId = c.authorUserId; // The person you are replying to
            c.replies.push(newComment);
            return true;
          }
          if (c.replies?.length && insertReply(c.replies)) return true;
        }
        return false;
      };
      insertReply(post.comments);
      post.markModified("comments");
    }

    await post.save();

    // 🔔 NOTIFICATION LOGIC
    if (recipientUserId && recipientUserId.toString() !== mobileUserId?.toString()) {
      const msg = type === "reply" 
        ? `${name} replied to your signal.` 
        : `${name} started a new signal on your post.`;

      await Notification.create({
        recipientId: recipientUserId,
        senderName: name,
        type,
        postId: post._id,
        message: msg
      });

      const user = await MobileUser.findById(recipientUserId);
      if (user?.pushToken) {
        await sendPushNotification(user.pushToken, type === "reply" ? "New Reply 💬" : "New Comment 📝", msg, { postId: post._id.toString(), type });
      }
    }

    // 📢 Discussion Ongoing Notification (Every 10 replies)
    if (parentCommentId) {
      const parent = post.comments.find(c => c._id.toString() === parentCommentId);
      if (parent && parent.replies.length % 10 === 0 && post.authorUserId) {
        const ownerMsg = `A heated discussion is ongoing on your post "${post.title.slice(0, 15)}..."`;
        await sendPushNotification(post.authorUserId, "Discussion Alert 🔥", ownerMsg, { postId: post._id.toString() });
      }
    }

    return NextResponse.json({ comment: newComment }, { status: 201 });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}

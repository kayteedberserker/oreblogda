import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import Notification from "@/app/models/NotificationModel"; // 👈 New Import
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
import MobileUser from "@/app/models/MobileUserModel"; // 👈 Added
import { sendPushNotification } from "@/app/lib/pushNotifications"; // 👈 Added

export async function POST(req, { params }) {
  await connectDB();
  const resolvedParams = await params;
  const { id } = resolvedParams;

  try {
    const { name, text, parentCommentId, fingerprint, userId } = await req.json();

    const deviceId = fingerprint;
    const mobileUserId =
      userId && mongoose.Types.ObjectId.isValid(userId)
        ? new mongoose.Types.ObjectId(userId)
        : null;

    const searchFilter = id.includes("-") ? { slug: id } : { _id: id };
    const post = await Post.findOne(searchFilter);
    if (!post) {
      return NextResponse.json({ message: "Post not found" }, { status: 404 });
    }

    const newComment = {
      _id: new mongoose.Types.ObjectId(),
      authorFingerprint: deviceId,
      authorId: deviceId, // backward support
      authorUserId: mobileUserId || null,
      name,
      text,
      date: new Date(),
      replies: []
    };

    let recipientUserId = post.authorUserId;
    let type = "comment";

    if (!parentCommentId) {
      post.comments.unshift(newComment);
    } else {
      type = "reply";

      const insertReply = comments => {
        for (const c of comments) {
          if (c._id.toString() === parentCommentId) {
            recipientUserId = c.authorUserId;
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

    // 🔔 Notify only MobileUsers
    if (recipientUserId && recipientUserId.toString() !== mobileUserId?.toString()) {
      const msg =
        type === "reply"
          ? `${name} replied to your comment.`
          : `${name} commented on your post: "${post.title.slice(0, 20)}..."`;

      await Notification.create({
        recipientId: recipientUserId,
        senderName: name,
        type,
        postId: post._id,
        message: msg
      });

      const user = await MobileUser.findById(recipientUserId);
      if (user?.pushToken) {
        await sendPushNotification(
          user.pushToken,
          type === "reply" ? "New Reply 💬" : "New Comment 📝",
          msg,
          { postId: post._id.toString(), type }
        );
      }
    }

    return NextResponse.json({ comment: newComment }, { status: 201 });
  } catch (err) {
    console.error("POST comment error:", err);
    return NextResponse.json({ message: "Error adding comment" }, { status: 500 });
  }
}
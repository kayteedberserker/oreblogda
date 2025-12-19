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
  const { id } = await params;
  try {
    await connectDB();
    const { name, text, parentCommentId, fingerprint } = await req.json();

    

    const searchFilter = id.includes("-") ? { slug: id } : { _id: id };
    const post = await Post.findOne(searchFilter);

    if (!post) return NextResponse.json({ message: "Post not found" }, { status: 404 });

    let recipientId = post.authorId;
    let notificationType = "comment";
    const newComment = {
      _id: new mongoose.Types.ObjectId(),
      authorId: recipientId,
      name,
      text,
      date: new Date(),
      replies: []
    };
    if (!parentCommentId) {
      post.comments.unshift(newComment);
    } else {
      notificationType = "reply";
      const findAndPush = (comments) => {
        for (let c of comments) {
          if (c._id.toString() === parentCommentId) {
            recipientId = c.authorId;
            if (!c.replies) c.replies = [];
            c.replies.push(newComment);
            return true;
          }
          if (c.replies && c.replies.length > 0) {
            if (findAndPush(c.replies)) return true;
          }
        }
        return false;
      };
      findAndPush(post.comments);
      post.markModified("comments");
    }

    await post.save();

    // --- 🔔 TRIGGER NOTIFICATION & PUSH ---
    if (recipientId !== fingerprint) {
      const pushMsg = notificationType === "reply" 
          ? `${name} replied to your comment.` 
          : `${name} commented on your post: "${post.title.substring(0, 20)}..."`;

      await Notification.create({
        recipientId,
        senderName: name,
        type: notificationType,
        postId: post._id,
        message: pushMsg
      });

      // Find recipient to get pushToken
      const userToNotify = await MobileUser.findOne({ _id: recipientId });
      
      if (userToNotify?.pushToken) {
          const pushTitle = notificationType === "reply" ? "New Reply! 💬" : "New Comment! 📝";
          await sendPushNotification(userToNotify.pushToken, pushTitle, pushMsg);
      }
    }

    return NextResponse.json({ comment: newComment }, { status: 201 });
  } catch (err) {
    console.error("POST comment error:", err);
    return NextResponse.json({ message: "Error adding reply" }, { status: 500 });
  }
}
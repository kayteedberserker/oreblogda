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
      replyTo: replyTo || null, // Stores { name, text, id } for the UI "Quote Box"
      date: new Date(),
      replies: []
    };

    let recipientUserId = null;
    let notificationType = "comment";
    let notificationMsg = "";

    // --- RECURSIVE FUNCTION TO FIND TARGET AND INSERT ---
    // This traverses the tree to find the comment with _id === parentCommentId
    const findAndReply = (comments) => {
      for (let comment of comments) {
        if (comment._id.toString() === parentCommentId) {
          comment.replies.push(newComment);
          return comment.authorUserId; // Return the ID of the person we just replied to
        }
        if (comment.replies && comment.replies.length > 0) {
          const found = findAndReply(comment.replies);
          if (found !== undefined) return found; // If found deep down, propagate return up
        }
      }
      return undefined;
    };

    if (!parentCommentId) {
      // Top Level Comment
      post.comments.unshift(newComment);
      recipientUserId = post.authorUserId;
      notificationMsg = `${name} started a new signal on your post.`;
    } else {
      // Nested Reply (Deep Search)
      notificationType = "reply";
      recipientUserId = findAndReply(post.comments);
      
      if (recipientUserId === undefined) {
         return NextResponse.json({ message: "Target signal not found" }, { status: 404 });
      }
      
      notificationMsg = `${name} replied to your signal: "${text.substring(0, 20)}..."`;
      post.markModified("comments");
    }

    await post.save();

    // 🔔 NOTIFICATION LOGIC
    if (recipientUserId && recipientUserId.toString() !== mobileUserId?.toString()) {
      await Notification.create({
        recipientId: recipientUserId,
        senderName: name,
        type: notificationType,
        postId: post._id,
        message: notificationMsg
      });

      const user = await MobileUser.findById(recipientUserId);
      if (user?.pushToken) {
        await sendPushNotification(
            user.pushToken, 
            notificationType === "reply" ? "New Reply 💬" : "New Signal 📝", 
            notificationMsg, 
            { postId: post._id.toString(), type: notificationType }
        );
      }
    }

    return NextResponse.json({ comment: newComment }, { status: 201 });
  } catch (err) {
    console.error("POST error:", err);
    return NextResponse.json({ message: "Error" }, { status: 500 });
  }
}

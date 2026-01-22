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
    // replyTo contains { name, text, id } of the specific message being replied to
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

    let recipientUserId = null;
    let notificationType = "comment";
    let notificationMsg = "";

    if (!parentCommentId) {
      // --- TOP LEVEL COMMENT ---
      post.comments.unshift(newComment);
      recipientUserId = post.authorUserId;
      notificationMsg = `${name} started a new signal on your post.`;
    } else {
      // --- REPLY TO A DISCUSSION ---
      notificationType = "reply";
      
      // 1. Find the Anchor Comment (The container for this discussion)
      const anchorComment = post.comments.find(c => c._id.toString() === parentCommentId);

      if (anchorComment) {
        // 2. Add the reply to the anchor's list
        anchorComment.replies.push(newComment);
        post.markModified("comments");

        // 3. DETERMINE RECIPIENT: Who are we replying to?
        if (replyTo && replyTo.id) {
            // Case A: Replying to a specific message inside the thread
            if (replyTo.id === anchorComment._id.toString()) {
                // Replying to the Anchor Author
                recipientUserId = anchorComment.authorUserId;
            } else {
                // Replying to a specific Reply Author
                const targetReply = anchorComment.replies.find(r => r._id.toString() === replyTo.id);
                recipientUserId = targetReply?.authorUserId;
            }
        } else {
            // Fallback: Default to Anchor Author if no specific target
            recipientUserId = anchorComment.authorUserId;
        }

        notificationMsg = `${name} replied to your signal: "${text.substring(0, 20)}..."`;

      } else {
        return NextResponse.json({ message: "Parent signal not found" }, { status: 404 });
      }
    }

    await post.save();

    // 🔔 SEND NOTIFICATION (To the specific person replied to)
    // We explicitly check that the user isn't replying to themselves
    if (recipientUserId && recipientUserId.toString() !== mobileUserId?.toString()) {
      
      await Notification.create({
        recipientId: recipientUserId,
        senderName: name,
        type: notificationType,
        postId: post._id,
        message: notificationMsg
      });

      const recipientUser = await MobileUser.findById(recipientUserId);
      if (recipientUser?.pushToken) {
        await sendPushNotification(
            recipientUser.pushToken, 
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

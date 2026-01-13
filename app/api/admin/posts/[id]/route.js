import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import Notification from "@/app/models/NotificationModel"; 
import MobileUser from "@/app/models/MobileUserModel"; 
import { sendPushNotification } from "@/app/lib/pushNotifications"; 
import { NextResponse } from "next/server";

export async function PATCH(req, { params }) {
    await connectDB();
    const resolvedParams = await params;
    const { id } = resolvedParams;
    const { status } = await req.json();

    if (!["approved", "rejected"].includes(status)) {
        return NextResponse.json({ message: "Invalid Status" }, { status: 400 });
    }

    try {
        // 1. Prepare Update Data
        // We manually set statusChangedAt because findByIdAndUpdate bypasses middleware
        const now = new Date();
        const updateData = { 
            status: status,
            statusChangedAt: now 
        };
        
        const unsetData = {};

        if (status === "rejected") {
            // Rejection cooldown: 12 hours
            updateData.expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); 
        } else if (status === "approved") {
            // Important: If it's approved, we remove expiresAt so it stays live
            unsetData.expiresAt = ""; 
        }

        // 2. Update the post
        // Using $set for data and $unset to remove expiration if approved
        const updatedPost = await Post.findByIdAndUpdate(
            id,
            { $set: updateData, ...(status === "approved" && { $unset: unsetData }) },
            { new: true }
        );

        if (!updatedPost) {
            return NextResponse.json({ message: "Post not found" }, { status: 404 });
        }

        // 3. 🔔 Notify the author
        const recipientUserId = updatedPost.authorUserId;

        if (recipientUserId) {
            const isApproved = status === "approved";
            const title = isApproved ? "Post Approved! 🎉" : "Post Rejected ⚠️";
            
            const msg = isApproved
                ? `Great news! Your post "${updatedPost.title.slice(0, 25)}..." has been approved and is now live.`
                : `Your post "${updatedPost.title.slice(0, 25)}..." was not approved. You can try again in 12 hours.`;

            // Create in-app notification record
            await Notification.create({
                recipientId: recipientUserId,
                senderName: "System",
                type: "like", 
                postId: updatedPost._id,
                message: msg
            });

            // Determine the navigation action
            let action = isApproved
                ? {
                    postId: updatedPost._id.toString(),
                    status: status,
                    type: "post_detail"
                }
                : {
                    type: "open_diary",
                    status: status
                };

            const user = await MobileUser.findById(recipientUserId);
            if (user?.pushToken) {
                await sendPushNotification(
                    user.pushToken,
                    title,
                    msg,
                    action
                );
            }
        }

        return NextResponse.json({
            message: `Post ${status}`,
            success: true,
            post: updatedPost
        });

    } catch (err) {
        console.error("Admin PATCH error:", err);
        return NextResponse.json({ message: "Update failed" }, { status: 500 });
    }
}

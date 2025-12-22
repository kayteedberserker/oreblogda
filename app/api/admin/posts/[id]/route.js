import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import Notification from "@/app/models/NotificationModel"; // 👈 Following your pattern
import MobileUser from "@/app/models/MobileUserModel"; // 👈 Following your pattern
import { sendPushNotification } from "@/app/lib/pushNotifications"; // 👈 Following your pattern
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
        // If rejected, set expiresAt to 12 hours from now. 
        // If approved, ensure expiresAt is removed ($unset) so it stays forever.
        const updateData = { status: status };
        
        if (status === "rejected") {
            updateData.expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 Hours
        } else {
            updateData.$unset = { expiresAt: "" }; 
        }

        // 2. Update the post
        const updatedPost = await Post.findByIdAndUpdate(
            id,
            updateData,
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
                : `Your post "${updatedPost.title.slice(0, 25)}..." was not approved. It will be removed from your diary in 12 hours.`;

            // Create in-app notification record
            await Notification.create({
                recipientId: recipientUserId,
                senderName: "System",
                type: "like", // Updated types for better tracking
                postId: updatedPost._id,
                message: msg
            });

            // Determine the navigation action
            // Approved -> Open the Post | Rejected -> Open the Diary
            let action = isApproved
                ? {
                    postId: updatedPost._id.toString(),
                    status: status,
                    type: "post_review"
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
            success: true
        });

    } catch (err) {
        console.error("Admin PATCH error:", err);
        return NextResponse.json({ message: "Update failed" }, { status: 500 });
    }
}
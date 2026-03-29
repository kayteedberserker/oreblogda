import { NextResponse } from 'next/server';
import connectDB from '@/app/lib/mongodb';
import MobileUser from '@/app/models/MobileUserModel';
import Post from '@/app/models/PostModel';
// ⚡️ IMPORT BOTH MULTI AND SINGLE PUSH HELPERS
import { sendMultiplePushNotifications, sendPushNotification } from "@/app/lib/pushNotifications"; 
import MessagePill from "@/app/models/MessagePillModel";
// ==========================================
// ⚡️ GET HANDLER: FETCH ALL POSTS FOR ADMIN
// ==========================================
export async function GET(req) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page")) || 1;
        const limit = 20; // 20 posts per page
        const skip = (page - 1) * limit;

        const [posts, total] = await Promise.all([
            Post.find()
                .sort({ createdAt: -1 }) // Newest first
                .skip(skip)
                .limit(limit)
                .lean(),
            Post.countDocuments()
        ]);

        return NextResponse.json({
            success: true,
            posts,
            pages: Math.ceil(total / limit),
            total
        });
    } catch (error) {
        console.error("Failed to fetch admin posts:", error);
        return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
    }
}

// ==========================================
// ⚡️ POST HANDLER: UNIFIED ADMIN ACTIONS
// ==========================================
export async function POST(req) {
    try {
        await connectDB();
        const { task, payload } = await req.json();

        switch (task) {
            
            // ⚡️ NEW: SEND PILL LOGIC
            case 'SEND_PILL':
                if (!payload.text || !payload.type || !payload.targetAudience) {
                    return NextResponse.json({ success: false, message: 'Missing pill parameters' }, { status: 400 });
                }
                
                let expiresAt = null;
                // If the admin sets an expiry duration (in hours), calculate the exact future date
                if (payload.expiresInHours) {
                    expiresAt = new Date(Date.now() + payload.expiresInHours * 60 * 60 * 1000);
                }

                const newPill = await MessagePill.create({
                    text: payload.text,
                    type: payload.type,
                    targetAudience: payload.targetAudience,
                    targetId: payload.targetId || null,
                    priority: payload.priority || 0,
                    expiresAt: expiresAt
                });

                return NextResponse.json({ success: true, message: 'Message Pill deployed to the Network.' });

            case 'BROADCAST_ALL':
                if (!payload.title || !payload.message) {
                    return NextResponse.json({ success: false, message: 'Missing title or message' }, { status: 400 });
                }

                const allUsersWithTokens = await MobileUser.find({
                    pushToken: { $exists: true, $ne: "" }
                }).select("pushToken");

                if (allUsersWithTokens.length === 0) {
                    return NextResponse.json({ success: false, message: 'No users with active push tokens found.' });
                }

                const tokensArray = allUsersWithTokens.map(u => u.pushToken);
                await sendMultiplePushNotifications(tokensArray, payload.title, payload.message);
                
                console.log(`BROADCAST TO ALL: [${payload.title}] ${payload.message}. Sent to ${tokensArray.length} users.`);
                return NextResponse.json({ 
                    success: true, 
                    message: `Broadcast initiated successfully to ${tokensArray.length} operatives.` 
                });

            case 'GIVE_OC':
                if (!payload.userId || !payload.amount) {
                    return NextResponse.json({ success: false, message: 'Missing user ID or amount' }, { status: 400 });
                }
                const user = await MobileUser.findByIdAndUpdate(
                    payload.userId,
                    { $inc: { coins: payload.amount } },
                    { new: true }
                );
                if (!user) return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
                
                if (user.pushToken) {
                    await sendPushNotification(
                        user.pushToken, 
                        "Energy Received 🪙", 
                        `THE SYSTEM has granted you ${payload.amount} OC.`,
                        { type: 'WALLET_UPDATE' }
                    );
                }
                
                return NextResponse.json({ success: true, message: `Granted ${payload.amount} OC to ${user.username}` });

            case 'UPDATE_POST_STATUS':
                if (!payload.postId || !payload.status) {
                    return NextResponse.json({ success: false, message: 'Missing post ID or status' }, { status: 400 });
                }

                const postToUpdate = await Post.findById(payload.postId);
                if (!postToUpdate) return NextResponse.json({ success: false, message: 'Post not found' }, { status: 404 });

                let updateData = { status: payload.status };
                let unsetData = {};

                const baseReason = payload.reason ? payload.reason + " | " : (postToUpdate.rejectionReason ? postToUpdate.rejectionReason + " | " : "");

                if (payload.status === 'approved') {
                    updateData.rejectionReason = baseReason + "Approved by THE SYSTEM!!";
                    unsetData.expiresAt = 1; 
                } else if (payload.status === 'rejected') {
                    updateData.rejectionReason = baseReason + "Rejected by THE SYSTEM!!";
                    updateData.expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); 
                }

                let mongoUpdateQuery = { $set: updateData };
                if (Object.keys(unsetData).length > 0) {
                    mongoUpdateQuery.$unset = unsetData;
                }

                const updatedPost = await Post.findByIdAndUpdate(
                    payload.postId,
                    mongoUpdateQuery,
                    { new: true }
                );

                if (updatedPost.authorUserId) {
                    const author = await MobileUser.findById(updatedPost.authorUserId);
                    if (author && author.pushToken) {
                        const title = payload.status === 'approved' ? "Scroll Approved! ✅" : "Scroll Rejected ❌";
                        const body = payload.status === 'approved' 
                            ? `Your log "${updatedPost.title}" has been approved by THE SYSTEM after validation.` 
                            : `Your log "${updatedPost.title}" was rejected and will be burned in 12 hours.`;
                        
                        await sendPushNotification(author.pushToken, title, body, { type: 'POST_STATUS', postId: updatedPost._id });
                    }
                }

                return NextResponse.json({ success: true, message: `Post marked as ${payload.status}` });

            case 'DELETE_POST':
                if (!payload.postId) {
                    return NextResponse.json({ success: false, message: 'Missing post ID' }, { status: 400 });
                }
                const deletedPost = await Post.findByIdAndDelete(payload.postId);
                if (!deletedPost) return NextResponse.json({ success: false, message: 'Post not found' }, { status: 404 });
                
                if (deletedPost) {
                    const author = await MobileUser.findById(deletedPost.authorUserId);
                    if (author && author.pushToken) {
                        const title = "Scroll Deleted ❌";
                        const body = `Your log "${deletedPost.title}" was deleted due to not following platform rules.`;
                        
                        // Fix: Replaced updatedPost with deletedPost
                        await sendPushNotification(author.pushToken, title, body, { type: 'POST_STATUS', postId: deletedPost._id });
                    }
                }
                return NextResponse.json({ success: true, message: 'Post permanently deleted' });

            case 'EDIT_POST':
                if (!payload.postId || !payload.title || !payload.message) {
                    return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
                }
                const editedPost = await Post.findByIdAndUpdate(
                    payload.postId,
                    { 
                        title: payload.title, 
                        message: payload.message, 
                        category: payload.category || 'News'
                    },
                    { new: true }
                );
                if (!editedPost) return NextResponse.json({ success: false, message: 'Post not found' }, { status: 404 });

                if (editedPost.authorUserId) {
                    const author = await MobileUser.findById(editedPost.authorUserId);
                    if (author && author.pushToken) {
                        await sendPushNotification(
                            author.pushToken, 
                            "Scroll Edited 📝", 
                            `Your log "${editedPost.title}" was updated by THE SYSTEM.`, 
                            { type: 'POST_EDIT', postId: editedPost._id }
                        );
                    }
                }

                return NextResponse.json({ success: true, message: 'Post updated successfully' });

            default:
                return NextResponse.json({ success: false, message: 'Unknown task type' }, { status: 400 });
        }

    } catch (error) {
        console.error(`Task Execution Error [${req.body?.task}]:`, error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
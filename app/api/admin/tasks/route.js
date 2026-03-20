import { NextResponse } from 'next/server';
import connectDB from '@/app/lib/mongodb';
import MobileUser from '@/app/models/MobileUserModel';
import Post from '@/app/models/PostModel';
// ⚡️ IMPORT THE MULTI PUSH HELPER INSTEAD
import { sendMultiplePushNotifications } from "@/app/lib/pushNotifications"; 

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
            case 'BROADCAST_ALL':
                // ⚡️ IMPLEMENTED GLOBAL PUSH NOTIFICATION
                if (!payload.title || !payload.message) {
                    return NextResponse.json({ success: false, message: 'Missing title or message' }, { status: 400 });
                }

                // Fetch all users who have an active push token
                const allUsersWithTokens = await MobileUser.find({
                    pushToken: { $exists: true, $ne: "" }
                }).select("pushToken");

                if (allUsersWithTokens.length === 0) {
                    return NextResponse.json({ success: false, message: 'No users with active push tokens found.' });
                }

                // ⚡️ Extract tokens and use the chunked multi-push helper
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
                return NextResponse.json({ success: true, message: `Granted ${payload.amount} OC to ${user.username}` });

            case 'UPDATE_POST_STATUS':
                if (!payload.postId || !payload.status) {
                    return NextResponse.json({ success: false, message: 'Missing post ID or status' }, { status: 400 });
                }
                const updatedPost = await Post.findByIdAndUpdate(
                    payload.postId,
                    { status: payload.status },
                    { new: true }
                );
                if (!updatedPost) return NextResponse.json({ success: false, message: 'Post not found' }, { status: 404 });
                return NextResponse.json({ success: true, message: `Post marked as ${payload.status}` });

            case 'DELETE_POST':
                if (!payload.postId) {
                    return NextResponse.json({ success: false, message: 'Missing post ID' }, { status: 400 });
                }
                const deletedPost = await Post.findByIdAndDelete(payload.postId);
                if (!deletedPost) return NextResponse.json({ success: false, message: 'Post not found' }, { status: 404 });
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
                return NextResponse.json({ success: true, message: 'Post updated successfully' });

            default:
                return NextResponse.json({ success: false, message: 'Unknown task type' }, { status: 400 });
        }

    } catch (error) {
        console.error(`Task Execution Error [${req.body?.task}]:`, error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
import { NextResponse } from 'next/server';
import connectDB from '@/app/lib/mongodb';
import MobileUser from '@/app/models/MobileUserModel';
import Post from '@/app/models/PostModel';

export async function POST(req) {
    try {
        await connectDB();
        const { task, payload } = await req.json();

        switch (task) {
            case 'BROADCAST_ALL':
                // Note: Implement your actual push notification logic here
                // e.g., using Expo Push API or Firebase
                console.log(`BROADCAST TO ALL: [${payload.title}] ${payload.message}`);
                return NextResponse.json({ success: true, message: 'Broadcast initiated' });

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
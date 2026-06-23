import { sendPillParallel } from "@/app/lib/messagePillService"; // Assumed import path for your new utility
import connectDB from '@/app/lib/mongodb';
import { sendMultiplePushNotifications } from "@/app/lib/pushNotifications";
import ClanFollower from '@/app/models/ClanFollowerModel'; // Needed for Clan pings
import Clan from '@/app/models/ClanModel'; // Needed for Clan updates
import MessagePill from "@/app/models/MessagePillModel";
import MobileUser from '@/app/models/MobileUserModel';
import Newsletter from '@/app/models/NewsletterModel'; // Needed for Emails
import Post from '@/app/models/PostModel';
import nodemailer from 'nodemailer'; // Needed for Emails
// import { awardAura, checkTitleUnlocks, awardClanPoints, notifyAllMobileUsersAboutPost } from '@/app/lib/gamification'; // Adjust based on your paths
import { NextResponse } from 'next/server';

export async function GET(req) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page")) || 1;
        const limit = 20;
        const skip = (page - 1) * limit;

        const [posts, total] = await Promise.all([
            Post.find()
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean(), // ⚡️ Lean already guarantees FULL payload hits the frontend (including media and rejectionReason)
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

export async function POST(req) {
    try {
        await connectDB();
        const { task, payload } = await req.json();

        switch (task) {

            case 'SEND_PILL':
                if (!payload.text || !payload.type || !payload.targetAudience) {
                    return NextResponse.json({ success: false, message: 'Missing pill parameters' }, { status: 400 });
                }

                let expiresAt = null;
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
                    message: `Broadcast initiated successfully to ${tokensArray.length} players.`
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
                    await sendPillParallel(
                        [user.pushToken],
                        "Energy Received 🪙",
                        `THE SYSTEM has sent you ${payload.amount} OC.`,
                        { type: 'WALLET_UPDATE', mediaUrl: user.profilePic?.url, screen: '/vault' },
                        { type: 'system', targetAudience: 'user', targetId: user._id.toString(), singleUser: true, priority: 8, link: '/vault' }
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

                    if (payload.status === "approved" && author) {
                        // 🌟 Gamification & Aura Engine 
                        let isFirstPost = false;
                        if (author.totalPosts === undefined || author.totalPosts === null) {
                            author.totalPosts = await Post.countDocuments({ authorUserId: author._id, status: "approved" });
                        } else {
                            author.totalPosts += 1;
                        }

                        if (author.totalPosts === 1) isFirstPost = true;

                        // Check & Inject "Night Owl"
                        const hour = new Date().getHours();
                        if (hour >= 1 && hour <= 4) {
                            const alreadyHasOwl = author.unlockedTitles?.some(t => t.name === "Night Owl");
                            if (!alreadyHasOwl) {
                                author.unlockedTitles.push({ name: "Night Owl", tier: "COMMON" });
                            }
                        }
                        await author.save();

                        // Execute Gamification Utilities (Ensure these are imported at the top)
                        try {
                            const auraReward = isFirstPost ? 50 : 15;
                            if (typeof awardAura !== 'undefined') {
                                await awardAura(author._id, auraReward);
                            } else {
                                author.aura = (author.aura || 0) + auraReward;
                                await author.save();
                            }
                            if (typeof checkTitleUnlocks !== 'undefined') {
                                await checkTitleUnlocks(author, "totalPosts", author.totalPosts);
                            }
                        } catch (e) { console.error("Aura execution fault:", e); }

                        // 🌟 Clan Stat Updates
                        if (updatedPost.clanId || updatedPost.category?.startsWith("Clan:")) {
                            try {
                                await Clan.findOneAndUpdate({ tag: updatedPost.clanId }, { $inc: { 'stats.totalPosts': 1 } });
                                if (typeof awardClanPoints !== 'undefined') {
                                    await awardClanPoints(updatedPost, 50, 'create');
                                }
                            } catch (err) { console.error("Clan processing fault:", err); }
                        }

                        // 🌟 Newsletter & Broadcast Network
                        try {
                            const subscribers = await Newsletter.find({}, "email");
                            if (subscribers.length > 0) {
                                const transporter = nodemailer.createTransport({
                                    service: "gmail",
                                    auth: { user: process.env.MAILEREMAIL, pass: process.env.MAILERPASS },
                                });
                                await transporter.sendMail({
                                    from: `"Oreblogda" <${process.env.MAILEREMAIL}>`,
                                    to: "Subscribers",
                                    bcc: subscribers.map(s => s.email),
                                    subject: `📰 New Post from ${author.username}`,
                                    html: `<h2>${updatedPost.title}</h2><p>${updatedPost.message.substring(0, 200)}...</p><a href="${process.env.SITE_URL}/post/${updatedPost.slug || updatedPost._id}">Read More</a>`
                                });
                            }
                        } catch (err) { console.error("Newsletter fault:", err); }

                        // Trigger Global Global Notifications (if active in your architecture)
                        try {
                            if (typeof notifyAllMobileUsersAboutPost !== 'undefined') {
                                await notifyAllMobileUsersAboutPost(updatedPost, author.username);
                            }
                        } catch (err) { }

                        // 🌟 Clan Members Push Broadcast
                        if (updatedPost.clanId) {
                            try {
                                const clan = await Clan.findOne({ tag: updatedPost.clanId }).select("name");
                                const followers = await ClanFollower.find({ clanTag: updatedPost.clanId }).populate({ path: 'userId', select: 'pushToken' });
                                const tokens = followers.flatMap(f => f.userId?.pushToken ? [f.userId.pushToken] : []);

                                if (tokens.length > 0) {
                                    await sendPillParallel(
                                        tokens,
                                        `${clan?.name || updatedPost.clanId} Transmission 🚩`,
                                        `${author.username || 'Someone'} posted: ${updatedPost.title}`,
                                        {
                                            type: "open_post",
                                            postId: updatedPost._id.toString(),
                                            clanTag: updatedPost.clanId,
                                            screen: `/post/${updatedPost._id.toString()}`,
                                            mediaUrl: updatedPost.mediaUrl,
                                            authorPfp: author.profilePic?.url
                                        },
                                        {
                                            type: 'clan_post',
                                            targetAudience: 'clan',
                                            targetId: updatedPost.clanId,
                                            priority: 3,
                                            link: `/post/${updatedPost._id.toString()}`,
                                            expiresInHours: 6
                                        }
                                    );
                                }
                            } catch (err) { console.error("Clan alert fault:", err); }
                        }

                        // Send Approved Message Pill & Push directly to the Author
                        if (author.pushToken) {
                            await sendPillParallel(
                                [author.pushToken],
                                "Scroll Approved! ✅",
                                `Your log "${updatedPost.title}" has been approved by THE SYSTEM.`,
                                {
                                    type: 'POST_STATUS',
                                    postId: updatedPost._id.toString(),
                                    mediaUrl: updatedPost.mediaUrl,
                                    authorPfp: author.profilePic?.url,
                                    screen: `/post/${updatedPost._id.toString()}`
                                },
                                {
                                    type: 'system',
                                    targetAudience: 'user',
                                    targetId: author._id.toString(),
                                    singleUser: true,
                                    priority: 5,
                                    link: `/post/${updatedPost._id.toString()}`
                                }
                            );
                        }

                    } else if (payload.status === "rejected" && author) {
                        // Send Rejection Message Pill & Push directly to the Author
                        if (author.pushToken) {
                            await sendPillParallel(
                                [author.pushToken],
                                "Post Rejected ⚠️",
                                `Your post "${updatedPost.title.slice(0, 20)}..." was not approved. Reason: ${updateData.rejectionReason}`,
                                {
                                    type: "open_diary",
                                    status: "rejected",
                                    reason: updateData.rejectionReason,
                                    postId: updatedPost._id.toString(),
                                    screen: "/authordiary",
                                    mediaUrl: updatedPost.mediaUrl,
                                    authorPfp: author.profilePic?.url
                                },
                                {
                                    type: 'post_rejection',
                                    targetAudience: 'user',
                                    targetId: author._id.toString(),
                                    singleUser: true,
                                    priority: 10,
                                    link: "/authordiary",
                                    expiresInHours: 12
                                }
                            );
                        }
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
                        await sendPillParallel(
                            [author.pushToken],
                            "Scroll Deleted ❌",
                            `Your log "${deletedPost.title}" was deleted due to not following platform rules.`,
                            { type: 'POST_STATUS', postId: deletedPost._id, mediaUrl: deletedPost.mediaUrl, authorPfp: author.profilePic?.url },
                            { type: 'warning', targetAudience: 'user', targetId: author._id.toString(), singleUser: true, priority: 10 }
                        );
                    }
                }
                return NextResponse.json({ success: true, message: 'Post permanently deleted' });

            case 'EDIT_POST':
                // ⚡️ UPGRADED: God-Mode Post Overrides
                if (!payload.postId || !payload.title || !payload.message) {
                    return NextResponse.json({ success: false, message: 'Missing required fields' }, { status: 400 });
                }

                // Build a dynamic update object based on what the frontend sends
                const updateFields = {
                    title: payload.title,
                    message: payload.message,
                    category: payload.category || 'News',
                };

                // If God-Mode triggers an admin takeover or overrides
                if (payload.isAdminPost !== undefined) updateFields.isAdminPost = payload.isAdminPost;
                if (payload.rejectionReason !== undefined) updateFields.rejectionReason = payload.rejectionReason;
                if (payload.status !== undefined) updateFields.status = payload.status;

                // Full control over the media array for sorting/deleting assets
                if (payload.media && Array.isArray(payload.media)) {
                    updateFields.media = payload.media;
                }

                const editedPost = await Post.findByIdAndUpdate(
                    payload.postId,
                    updateFields,
                    { new: true } // Return updated document
                );

                if (!editedPost) return NextResponse.json({ success: false, message: 'Post not found' }, { status: 404 });

                // Optional: Notify author their post was modified by the admin
                if (editedPost.authorUserId && payload.notifyAuthor) {
                    const author = await MobileUser.findById(editedPost.authorUserId);
                    if (author && author.pushToken) {
                        await sendPillParallel(
                            [author.pushToken],
                            "Scroll Edited 📝",
                            `Your log "${editedPost.title}" was updated by THE SYSTEM.`,
                            { type: 'POST_EDIT', postId: editedPost._id, mediaUrl: editedPost.mediaUrl, authorPfp: author.profilePic?.url, screen: `/post/${editedPost._id.toString()}` },
                            { type: 'system', targetAudience: 'user', targetId: author._id.toString(), singleUser: true, priority: 5, link: `/post/${editedPost._id.toString()}` }
                        );
                    }
                }

                return NextResponse.json({ success: true, message: 'System Override: Post updated successfully' });

            default:
                return NextResponse.json({ success: false, message: 'Unknown task type' }, { status: 400 });
        }

    } catch (error) {
        console.error(`Task Execution Error [${req.body?.task}]:`, error);
        return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
    }
}
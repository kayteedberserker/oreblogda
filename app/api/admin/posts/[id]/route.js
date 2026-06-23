import { awardAura } from "@/app/lib/auraManager";
import { awardClanPoints } from "@/app/lib/clanService";
import connectDB from "@/app/lib/mongodb";
import { sendPushNotification } from "@/app/lib/pushNotifications";
import ClanFollower from "@/app/models/ClanFollower";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import Notification from "@/app/models/NotificationModel";
import Post from "@/app/models/PostModel";
import { NextResponse } from "next/server";

export async function PATCH(req, { params }) {
    await connectDB();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    // Extract rejectionReason from the request body
    const { status, rejectionReason } = await req.json();

    if (!["approved", "rejected"].includes(status)) {
        return NextResponse.json({ message: "Invalid Status" }, { status: 400 });
    }

    try {
        // 1. Prepare Update Data
        const now = new Date();
        const updateData = {
            status: status,
            statusChangedAt: now
        };

        const unsetData = {};

        if (status === "rejected") {
            // Rejection cooldown: 12 hours
            updateData.expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000);
            // Store the reason in the database
            updateData.rejectionReason = rejectionReason || "No specific reason provided.";
        } else if (status === "approved") {
            // Remove expiration and any old rejection reasons if approved
            unsetData.expiresAt = "";
            unsetData.rejectionReason = "";
        }

        // 2. Update the post
        const updatedPost = await Post.findByIdAndUpdate(
            id,
            {
                $set: updateData,
                ...(status === "approved" && { $unset: unsetData })
            },
            { new: true }
        );
        let userDoc = await MobileUser.findOne({ deviceId: updatedPost?.authorId })
        // Gamification & Aura Engine Processing
        if (status === "approved" && userDoc) {
            try {
                if (userDoc.totalPosts === undefined || userDoc.totalPosts === null) {
                    userDoc.totalPosts = await Post.countDocuments({ authorUserId: userDoc._id, status: "approved" });
                } else {
                    userDoc.totalPosts += 1;
                }

                if (userDoc.totalPosts === 1) isFirstPost = true;
                await checkTitleUnlocks(userDoc, "totalPosts", userDoc.totalPosts);

                const hour = new Date().getHours();
                if (hour >= 1 && hour <= 4) {
                    const alreadyHasOwl = userDoc.unlockedTitles?.some(t => t.name === "Night Owl");
                    if (!alreadyHasOwl) {
                        await MobileUser.findByIdAndUpdate(userDoc._id, {
                            $addToSet: { unlockedTitles: { name: "Night Owl", tier: "COMMON" } }
                        });
                    }
                }
                await userDoc.save();

                const auraReward = isFirstPost ? 50 : 15;
                const auraResult = await awardAura(userDoc._id, auraReward);
                if (auraResult && auraResult.newRank) {
                    auraStats = {
                        earned: auraReward,
                        currentAura: auraResult.user.aura,
                        pointsNeeded: Math.max(0, (auraResult.newRank.nextRankReq || 12000) - auraResult.user.aura)
                    };
                }
            } catch (auraErr) {
                console.error("Aura execution fault:", auraErr);
            }
        }
        // Clan Statistics Updates
        if (status === "approved" && (updatedPost.clanId || updatedPost.category?.startsWith("Clan:"))) {
            try {
                await Clan.findOneAndUpdate({ tag: updatedPost.clanId }, { $inc: { 'stats.totalPosts': 1 } });
                await awardClanPoints(updatedPost, 50, 'create');
            } catch (err) { console.error("Clan processing fault:", err); }
        }

        if (updatedPost.clanId) {
            try {
                const clan = await Clan.findOne({ tag: updatedPost.clanId }).select("name");
                const followers = await ClanFollower.find({ clanTag: updatedPost.clanId }).populate({ path: 'userId', select: 'pushToken' });
                const tokens = followers.flatMap(f => {
                    const token = f.userId?.pushToken;
                    return token != null ? [token] : [];
                });


                if (tokens.length > 0) {
                    await sendPillParallel(
                        tokens,
                        `${clan?.name || updatedPost.clanId} Transmission 🚩`,
                        `${userDoc?.username || 'Someone'} posted: ${updatedPost.title}`,
                        {
                            type: "open_post",
                            postId: updatedPost._id.toString(),
                            clanTag: updatedPost.clanId,
                            screen: `/post/${updatedPost._id.toString()}`,
                            mediaUrl: updatedPost.mediaUrl, // 🌟 INJECTED MEDIA URL FOR CLAN PUSH
                            authorPfp: userDoc?.profilePic?.url // 🌟 INJECTED AUTHOR PFP
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

        if (!updatedPost) {
            return NextResponse.json({ message: "Post not found" }, { status: 404 });
        }

        // 3. 🔔 Notify the author
        const recipientUserId = updatedPost.authorUserId;

        if (recipientUserId) {
            const isApproved = status === "approved";
            const title = isApproved ? "Post Approved! 🎉" : "Post Rejected ⚠️";

            // Build the message. If rejected, include the reason clearly.
            let msg = isApproved
                ? `Great news! Your post "${updatedPost.title.slice(0, 25)}..." has been approved and is now live.`
                : `Your post "${updatedPost.title.slice(0, 25)}..." was not approved. Reason: ${rejectionReason}. You can try again in 12 hours.`;

            // Create in-app notification record
            await Notification.create({
                recipientId: recipientUserId,
                senderName: "System",
                type: "like", // You might want a 'system' type for rejections
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
                    status: status,
                    reason: rejectionReason // Sending reason in data payload too
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

// 🏆 Enhanced Title Thresholds
const TITLE_THRESHOLDS = {
    // ✍️ Creator Path Thresholds
    totalPosts: [
        { limit: 1, name: "Origin Point", tier: "COMMON" },
        { limit: 5, name: "Quiet Scribe", tier: "COMMON" },
        { limit: 50, name: "Active Voice", tier: "RARE" },
        { limit: 250, name: "The Chronicler", tier: "EPIC" },
        { limit: 1000, name: "Architect of Lore", tier: "LEGENDARY" }
    ]
};

// 🛠 Helper to check and award titles
async function checkTitleUnlocks(user, field, currentCount) {
    const thresholds = TITLE_THRESHOLDS[field];
    if (!thresholds) return null;

    const earnedTitle = [...thresholds].reverse().find(t => currentCount >= t.limit);

    if (earnedTitle) {
        const alreadyHas = user.unlockedTitles?.some(t => t.name === earnedTitle.name);
        if (!alreadyHas) {
            await MobileUser.findByIdAndUpdate(user._id, {
                $addToSet: { unlockedTitles: earnedTitle }
            });

            if (user.pushToken) {
                const titleMsg = `🏆 NEW TITLE: You have received the "${earnedTitle.name}" TITLE!`;
                await sendPillParallel([user.pushToken], "Title Earned", titleMsg, { type: "achievement" }, {
                    type: 'achievement',
                    targetAudience: 'user',
                    targetId: user._id.toString(),
                    singleUser: true,
                    priority: 3
                });
            }
            return earnedTitle;
        }
    }
    return null;
}
import { awardAura } from "@/app/lib/auraManager";
import { awardClanPoints } from "@/app/lib/clanService";
import { sendPillParallel } from "@/app/lib/messagePillService";
import connectDB from "@/app/lib/mongodb.js";
import Clan from "@/app/models/ClanModel"; // ⚔️ IMPORTED FOR BADGE PROGRESSION
import HypeLog from "@/app/models/HypeLogModel";
import MobileUser from "@/app/models/MobileUserModel";
import MonthlyHypeStat from "@/app/models/MonthlyHypeStat";
import Post from "@/app/models/PostModel";
import { NextResponse } from "next/server";

// 🏆 1. GIVER PROGRESSION (THE HYPERS)
const HYPER_TIERS = [
    { minPoints: 500000, name: 'Peak Hyper', tier: 'Unique' },
    { minPoints: 100000, name: 'Hype Overlord', tier: 'Legendary' },
    { minPoints: 25000, name: 'Hype Master', tier: 'Epic' },
    { minPoints: 5000, name: 'Hype Ignition', tier: 'Rare' }
];

// 🎭 2. RECEIVER PROGRESSION (THE AUTHORS)
const AUTHOR_TIERS = [
    { minPoints: 500000, name: 'Living Idol', tier: 'Unique' },
    { minPoints: 100000, name: 'Megastar', tier: 'Legendary' },
    { minPoints: 25000, name: 'Trendsetter', tier: 'Epic' },
    { minPoints: 5000, name: 'Rising Star', tier: 'Rare' }
];

// ⚔️ 3. CLAN PROGRESSION (BADGES AS PLAIN STRINGS)
const CLAN_TIERS = [
    { minPoints: 2000000, badge: 'HYPE EMPIRE' },
    { minPoints: 500000, badge: 'HYPE DYNASTY' },
    { minPoints: 100000, badge: 'HYPE SYNDICATE' },
    { minPoints: 10000, badge: 'HYPE VANGUARD' }
];

export async function POST(req) {
    try {
        await connectDB();
        const { deviceId, postId, hypeType } = await req.json();

        const user = await MobileUser.findOne({ deviceId });
        const post = await Post.findById(postId);
        if (!user || !post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // 🛡️ ANTI-SELF-HYPE GUARD CLAUSE
        // Compares the hyping user's ID with the author's stringified ID attached to the post.
        if (post.authorUserId && post.authorUserId.toString() === user._id.toString()) {
            return NextResponse.json({ error: 'You cannot hype your own post!' }, { status: 400 });
        }

        // ⚡️ FINE-TUNED MULTI-TRACK METRICS SYSTEM
        const PRODUCTS = {
            FREE: { cost: 0, points: 10, tokens: 0, giverAura: 0, receiverAura: 5, clanPoints: 5 },
            STANDARD: { cost: 50, points: 50, tokens: 0, giverAura: 5, receiverAura: 15, clanPoints: 25 },
            SUPER: { cost: 200, points: 250, tokens: 0, giverAura: 10, receiverAura: 50, clanPoints: 70 },
            MEGA: { cost: 500, points: 700, tokens: 0, giverAura: 40, receiverAura: 150, clanPoints: 200 }
        };

        const item = PRODUCTS[hypeType];
        if (!item) return NextResponse.json({ error: 'Invalid hype type' }, { status: 400 });

        let source = 'PURCHASE';

        // 1. Inventory Check & Count Reduction Protocol
        const inventoryItemIndex = user.inventory.findIndex(i => i.hypeType === hypeType);

        if (inventoryItemIndex !== -1) {
            const targetVaultItem = user.inventory[inventoryItemIndex];

            // 🔄 If the stack size is greater than 1, decrement it cleanly. Otherwise, drop the row completely.
            if (targetVaultItem.itemCount && targetVaultItem.itemCount > 1) {
                targetVaultItem.itemCount -= 1;
            } else {
                user.inventory.splice(inventoryItemIndex, 1);
            }
            source = 'INVENTORY';
        } else {
            if (hypeType === 'FREE') {
                return NextResponse.json({ error: 'No free hype items available in vault' }, { status: 400 });
            }
            if (user.coins < item.cost) return NextResponse.json({ error: 'Not enough OC' }, { status: 400 });
            user.coins -= item.cost;
        }

        // 2. Apply Post updates
        post.hypePoints += item.points;
        post.hypeCount += 1;

        // 📈 TRACK PROGRESS FOR THE GIVER (USER)
        user.totalHypePointsGiven = (user.totalHypePointsGiven || 0) + item.points;
        if (!user.unlockedTitles) user.unlockedTitles = [];

        let newGiverTitle = null;
        for (const milestone of HYPER_TIERS) {
            if (user.totalHypePointsGiven >= milestone.minPoints) {
                const alreadyUnlocked = user.unlockedTitles.some(t => t.name === milestone.name && t.tier === milestone.tier);
                if (!alreadyUnlocked) {
                    const newTitlePayload = { name: milestone.name, tier: milestone.tier };
                    user.unlockedTitles.push(newTitlePayload);
                    user.equippedTitle = newTitlePayload; // Auto-equip highest tier unlocked
                    newGiverTitle = milestone;
                }
                break;
            }
        }

        // Fetch Author & Clan Docs for updates
        const author = await MobileUser.findOne({ deviceId: post.authorId });
        const clanTag = post.clanId || (post.category?.startsWith("Clan:") ? post.category.split(":")[2] : null);
        const clanDoc = clanTag ? await Clan.findOne({ tag: clanTag }) : null;

        let newAuthorTitle = null;
        if (author) {
            author.tokens += item.tokens;

            // 📈 TRACK PROGRESS FOR THE RECEIVER (AUTHOR)
            author.totalHypePointsReceived = (author.totalHypePointsReceived || 0) + item.points;
            if (!author.unlockedTitles) author.unlockedTitles = [];

            for (const milestone of AUTHOR_TIERS) {
                if (author.totalHypePointsReceived >= milestone.minPoints) {
                    const alreadyUnlocked = author.unlockedTitles.some(t => t.name === milestone.name && t.tier === milestone.tier);
                    if (!alreadyUnlocked) {
                        const newTitlePayload = { name: milestone.name, tier: milestone.tier };
                        author.unlockedTitles.push(newTitlePayload);
                        author.equippedTitle = newTitlePayload;
                        newAuthorTitle = milestone;
                    }
                    break;
                }
            }

            // 🌟 Fire push notification alert safely WITH RICH MEDIA AND DEEP LINK
            if (author.pushToken) {
                await sendPillParallel(
                    [author.pushToken],
                    `New Hype on Post: ${post?.title?.slice(0, 20)}`,
                    `${user.username || 'Someone'} just hyped your post with a ${hypeType} hype!`,
                    {
                        type: "open_post",
                        postId: post._id.toString(),
                        screen: `/post/${post._id.toString()}`,
                        mediaUrl: post.mediaUrl, // 🌟 INJECTED POST IMAGE THUMBNAIL
                        authorPfp: user.profilePic?.url // 🌟 INJECTED SENDER PFP
                    },
                    {
                        type: 'achievement',
                        targetId: author._id.toString(),
                        singleUser: true,
                        priority: 3,
                        link: `/post/${post._id.toString()}` // 🌟 Ensures the in-app marquee also links to the post
                    }
                );
            }
        }

        // 📈 TRACK PROGRESS FOR THE CLAN
        let newClanBadge = null;
        if (clanDoc) {
            clanDoc.totalHypePointsReceived = (clanDoc.totalHypePointsReceived || 0) + item.points;
            if (!clanDoc.badges) clanDoc.badges = [];

            for (const milestone of CLAN_TIERS) {
                if (clanDoc.totalHypePointsReceived >= milestone.minPoints) {
                    if (!clanDoc.badges.includes(milestone.badge)) {
                        clanDoc.badges.push(milestone.badge);
                        newClanBadge = milestone.badge;
                    }
                    break;
                }
            }
        }

        // Send Title unlock alerts if milestones were reached
        if (newGiverTitle && user.pushToken) {
            await sendPillParallel(
                [user.pushToken],
                `🏆 New Title Unlocked!`,
                `You earned the ${newGiverTitle.tier} title: "${newGiverTitle.name}"!`,
                { type: "achievement" },
                { type: 'achievement', targetId: user._id.toString(), singleUser: true, priority: 3 }
            );
        }

        if (newAuthorTitle && author?.pushToken) {
            await sendPillParallel(
                [author.pushToken],
                `✨ Content Creator Milestone!`,
                `Your content has earned you the ${newAuthorTitle.tier} title: "${newAuthorTitle.name}"!`,
                { type: "achievement" },
                { type: 'achievement', targetId: author._id.toString(), singleUser: true, priority: 3 }
            );
        }

        await HypeLog.create({ userId: user._id, postId: post._id, hypeType, points: item.points, source });

        // 🛡️ CLAN SCORE BOOSTER
        await awardClanPoints(post, item.clanPoints, 'hype');

        // ====================================================================
        // ⚡️ ANTI-EXPLOIT AURA VERIFICATION ENGINE
        // ====================================================================
        // Standard scenario: Both profiles are distinct entities (Self-Hype blocked above)
        const giverAuraResult = await awardAura(user._id, item.giverAura, 'hyper');
        if (giverAuraResult) {
            user.aura = giverAuraResult.user.aura;
            user.weeklyAura = giverAuraResult.user.weeklyAura;
            user.currentRankLevel = giverAuraResult.user.currentRankLevel;
        }

        if (author) {
            const receiverAuraResult = await awardAura(author._id, item.receiverAura, 'hyped');
            if (receiverAuraResult) {
                author.aura = receiverAuraResult.user.aura;
                author.weeklyAura = receiverAuraResult.user.weeklyAura;
                author.currentRankLevel = receiverAuraResult.user.currentRankLevel;
            }
        }

        // ====================================================================
        // ⚡️ REAL-TIME MONTHLY MULTI-TRACK LEADERBOARD UPDATES
        // ====================================================================
        const currentMonth = new Date().toISOString().slice(0, 7);
        const leaderboardUpdates = [
            MonthlyHypeStat.updateOne(
                { month: currentMonth, entityType: 'USER_GIVEN', entityId: user._id.toString() },
                {
                    $setOnInsert: { name: user.username || 'Anonymous', avatar: user.profileImage || '' },
                    $set: { secondaryContext: user.equippedTitle?.name || '' },
                    $inc: { score: item.points, count: 1 }
                },
                { upsert: true }
            )
        ];

        if (author) {
            leaderboardUpdates.push(
                MonthlyHypeStat.updateOne(
                    { month: currentMonth, entityType: 'USER_RECEIVED', entityId: author._id.toString() },
                    {
                        $setOnInsert: {
                            name: author.username || 'Anonymous',
                            avatar: author.profileImage || '',
                        },
                        $set: { secondaryContext: author.equippedTitle?.name || author.clanTag || '' },
                        $inc: { score: item.points, count: 1 }
                    },
                    { upsert: true }
                )
            );
        }

        if (clanTag) {
            leaderboardUpdates.push(
                MonthlyHypeStat.updateOne(
                    { month: currentMonth, entityType: 'CLAN_RECEIVED', entityId: clanTag },
                    {
                        $setOnInsert: { name: `Clan ${clanTag}`, avatar: '' },
                        $inc: { score: item.points, count: 1 }
                    },
                    { upsert: true }
                )
            );
        }

        // Fire all mutations together safely
        await Promise.all([
            user.save(),
            author ? author.save() : Promise.resolve(),
            clanDoc ? clanDoc.save() : Promise.resolve(),
            post.save(),
            ...leaderboardUpdates
        ]);

        return NextResponse.json({
            success: true,
            newBalance: user.coins,
            source,
            giverTitle: user.equippedTitle || null,
            clanBadgeUnlocked: newClanBadge || null
        });
    } catch (e) {
        console.error(e);
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}
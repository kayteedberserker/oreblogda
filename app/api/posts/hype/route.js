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
        // 🌟 FIX 1: Destructure candidateSources from the frontend payload
        const { deviceId, postId, hypeType, candidateSources = [] } = await req.json();
        console.log(candidateSources)
        const user = await MobileUser.findOne({ deviceId });
        const post = await Post.findById(postId);
        if (!user || !post) return NextResponse.json({ error: 'Not found' }, { status: 404 });

        // 🛡️ ANTI-SELF-HYPE GUARD CLAUSE
        // Compares the hyping user's ID with the author's stringified ID attached to the post.
        if (post.authorUserId && post.authorUserId.toString() === user._id.toString()) {
            return NextResponse.json({ error: 'You cannot hype your own post!' }, { status: 400 });
        }

        // 🧠 🌟 FIX 2: FIRE MASSIVE AFFINITY & TELEMETRY (Weight: 25) for spending currency
        await processTelemetryAndAffinity(deviceId, post, candidateSources, 'hype', 25);

        // ⚡️ FINE-TUNED MULTI-TRACK METRICS SYSTEM
        const PRODUCTS = {
            FREE: { cost: 0, points: 10, tokens: 0, giverAura: 0, receiverAura: 5, clanPoints: 5 },
            STANDARD: { cost: 50, points: 50, tokens: 0, giverAura: 0, receiverAura: 10, clanPoints: 20 },
            SUPER: { cost: 200, points: 250, tokens: 0, giverAura: 10, receiverAura: 20, clanPoints: 30 },
            MEGA: { cost: 500, points: 700, tokens: 0, giverAura: 20, receiverAura: 30, clanPoints: 50 }
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


// ----------------------
// 🧠 UNIFIED HELPER: Telemetry, Affinity, Decay, & Optimization
// ----------------------
async function processTelemetryAndAffinity(fingerprint, post, candidateSources, action, weight) {
    if (!fingerprint || !post) return;

    try {
        const user = await MobileUser.findOne({ deviceId: fingerprint })
            .select('affinityScores authorAffinity countryAffinity feedLearning');
        if (!user) return;

        // --- A. AFFINITY UPDATES (Dynamic Ranking Signal) ---
        // We still update these dynamically because they govern what the user SEES (Ranking)
        const tagWeight = weight;
        const authorWeight = Math.round(weight * 0.5);
        const countryWeight = Math.round(weight * 0.25);

        let affinityScores = user.affinityScores ? (user.affinityScores instanceof Map ? Object.fromEntries(user.affinityScores) : user.affinityScores) : {};
        let authorAffinity = user.authorAffinity ? (user.authorAffinity instanceof Map ? Object.fromEntries(user.authorAffinity) : user.authorAffinity) : {};
        let countryAffinity = user.countryAffinity ? (user.countryAffinity instanceof Map ? Object.fromEntries(user.countryAffinity) : user.countryAffinity) : {};

        const updateAndTrim = (obj, key, addWeight, limit) => {
            if (!key) return obj;
            const sanitizedKey = key.replace(/\./g, '_').replace(/\$/g, '');
            if (!sanitizedKey) return obj;

            const current = typeof obj[sanitizedKey] === "number" ? obj[sanitizedKey] : 0;
            obj[sanitizedKey] = current + addWeight;

            if (Object.keys(obj).length > limit + 10) {
                const sortedEntries = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit);
                return Object.fromEntries(sortedEntries);
            }
            return obj;
        };

        if (post.interests && Array.isArray(post.interests)) {
            post.interests.forEach(tag => {
                if (tag) affinityScores = updateAndTrim(affinityScores, tag.trim().toLowerCase(), tagWeight, 50);
            });
        }
        const targetAuthor = post.authorUserId ? post.authorUserId.toString() : post.authorId;
        if (targetAuthor && targetAuthor !== fingerprint) {
            authorAffinity = updateAndTrim(authorAffinity, targetAuthor, authorWeight, 30);
        }
        if (post.country && post.country !== "Global" && post.country !== "Unknown") {
            countryAffinity = updateAndTrim(countryAffinity, post.country, countryWeight, 10);
        }

        // --- B. TELEMETRY INCREMENTS (🌟 UPDATED: FIXED POOL CONFIDENCE) ---
        // We use static confidence to govern how the algorithm LEARNS (Attribution)
        const actionMap = {
            'view': 'impressions', 'like': 'likes', 'share': 'shares',
            'vote': 'votes', 'watch_complete': 'watch_complete',
            'skip': 'skips', 'not_interested': 'skips',
            'comment': 'comments',
            'hype': 'votes'
        };
        const metric = actionMap[action];
        const validPools = ['fresh', 'author', 'clan', 'interest', 'trending', 'explore'];
        const incUpdates = {};

        if (metric && Array.isArray(candidateSources) && candidateSources.length > 0) {

            // 1. Extract Unique Pool Types (Prevents double-counting if a post had 2 interest tags)
            const uniqueTypes = [...new Set(candidateSources.map(s => s.type).filter(t => validPools.includes(t)))];

            if (uniqueTypes.length > 0) {
                // 2. Static Pool Confidence Tiers
                const POOL_CONFIDENCE = {
                    explore: 1,
                    fresh: 1,
                    clan: 2,
                    trending: 4,
                    interest: 4,
                    author: 4
                }

                let totalConfidence = 0;

                // 3. Map to confidence scores and sum them up
                const scoredSources = uniqueTypes.map(type => {
                    const conf = POOL_CONFIDENCE[type] || 1;
                    totalConfidence += conf;
                    return { type, conf };
                });

                // 4. Normalize to 1.0 and increment
                scoredSources.forEach(source => {
                    const normalizedFraction = parseFloat((source.conf / totalConfidence).toFixed(3));

                    if (!isNaN(normalizedFraction) && normalizedFraction > 0) {
                        incUpdates[`feedLearning.sourceStats.${source.type}.${metric}`] = normalizedFraction;
                    }
                });
            }
        }

        // --- C. OPTIMIZATION & DECAY CHECK ---
        let setUpdates = { affinityScores, authorAffinity, countryAffinity };

        if (user.feedLearning) {
            const lastOpt = user.feedLearning.lastOptimizedAt || new Date(0);
            const stats = user.feedLearning.sourceStats || {};

            let totalImpressions = 0;
            validPools.forEach(pool => { totalImpressions += (stats[pool]?.impressions || 0); });

            // Exactly 1 impression is distributed, so we increment the total by 1
            if (metric === 'impressions' && Object.keys(incUpdates).length > 0) {
                totalImpressions += 1;
            }

            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (Date.now() - lastOpt.getTime() >= twentyFourHours && totalImpressions >= 100) {
                // 1. DECAY OLD AFFINITIES
                const decayMap = (mapObj, factor = 0.98) => {
                    for (let key in mapObj) {
                        mapObj[key] = Math.max(0.1, Number((mapObj[key] * factor).toFixed(2)));
                        if (mapObj[key] < 1) delete mapObj[key];
                    }
                };
                decayMap(setUpdates.affinityScores);
                decayMap(setUpdates.authorAffinity);
                decayMap(setUpdates.countryAffinity);

                // 2. RATE-BASED POOL SCORING
                let totalScore = 0;
                const rawScores = {};

                validPools.forEach(pool => {
                    const s = stats[pool] || {};
                    const imp = (s.impressions || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.impressions`] || 0);
                    let score = 0;

                    if (imp < 20) {
                        score = 50;
                    } else {
                        const likeRate = ((s.likes || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.likes`] || 0)) / imp;
                        const voteRate = ((s.votes || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.votes`] || 0)) / imp;
                        const watchRate = ((s.watch_complete || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.watch_complete`] || 0)) / imp;
                        const commentRate = ((s.comments || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.comments`] || 0)) / imp;
                        const shareRate = ((s.shares || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.shares`] || 0)) / imp;
                        const skipRate = ((s.skips || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.skips`] || 0)) / imp;

                        score = 10 + (likeRate * 50) + (voteRate * 50) + (watchRate * 80) +
                            (commentRate * 100) + (shareRate * 150) + (skipRate * -60);
                    }

                    rawScores[pool] = Math.max(10, score);
                    totalScore += rawScores[pool];
                });

                // 3. Exact Normalization (Fixing the edge case)
                const newWeights = {};

                // Set initial pure ratio
                validPools.forEach(pool => newWeights[pool] = rawScores[pool] / totalScore);

                // Enforce the clamping boundaries
                let clampedTotal = 0;
                validPools.forEach(pool => {
                    newWeights[pool] = Math.max(0.05, Math.min(0.45, newWeights[pool]));
                    clampedTotal += newWeights[pool];
                });

                // Divide by the new clamped boundary sum to safely guarantee exact 1.0 distribution
                validPools.forEach(pool => {
                    newWeights[pool] = parseFloat((newWeights[pool] / clampedTotal).toFixed(3));
                });

                setUpdates["feedLearning.poolWeights"] = newWeights;
                setUpdates["feedLearning.lastOptimizedAt"] = new Date();

                // 4. RESET STATS
                Object.keys(incUpdates).forEach(key => delete incUpdates[key]);
                validPools.forEach(pool => {
                    setUpdates[`feedLearning.sourceStats.${pool}.impressions`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.likes`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.votes`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.watch_complete`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.comments`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.shares`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.skips`] = 0;
                });
                console.log(`[ML] Epoch closed. Re-optimized pools & decayed affinities for ${fingerprint}:`, newWeights);
            }
        }

        // --- D. EXECUTE SINGLE ATOMIC UPDATE ---
        const updateOperation = { $set: setUpdates };
        if (Object.keys(incUpdates).length > 0) {
            updateOperation.$inc = incUpdates;
        }

        await MobileUser.updateOne({ _id: user._id }, updateOperation);

    } catch (err) {
        console.error("❌ Unified Telemetry Error:", err);
    }
}
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

        const {
            deviceId,
            postId,
            hypeType,
            candidateSources = []
        } = await req.json();

        if (!deviceId || !postId || !hypeType) {
            return NextResponse.json(
                { error: "Missing hype request details" },
                { status: 400 }
            );
        }

        const PRODUCTS = {
            FREE: {
                cost: 0,
                points: 10,
                tokens: 0,
                giverAura: 0,
                receiverAura: 5,
                clanPoints: 5
            },
            STANDARD: {
                cost: 50,
                points: 50,
                tokens: 0,
                giverAura: 0,
                receiverAura: 10,
                clanPoints: 20
            },
            SUPER: {
                cost: 200,
                points: 250,
                tokens: 0,
                giverAura: 10,
                receiverAura: 20,
                clanPoints: 30
            },
            MEGA: {
                cost: 500,
                points: 700,
                tokens: 0,
                giverAura: 20,
                receiverAura: 30,
                clanPoints: 50
            }
        };

        const item = PRODUCTS[hypeType];

        if (!item) {
            return NextResponse.json(
                { error: "Invalid hype type" },
                { status: 400 }
            );
        }

        const [user, post] = await Promise.all([
            MobileUser.findOne({ deviceId }),
            Post.findById(postId)
        ]);

        if (!user || !post) {
            return NextResponse.json(
                { error: "Not found" },
                { status: 404 }
            );
        }

        const isOwnPost =
            post.authorUserId?.toString()
                === user._id.toString()
            || post.authorId?.toString() === deviceId;

        if (isOwnPost) {
            return NextResponse.json(
                { error: "You cannot hype your own post!" },
                { status: 400 }
            );
        }

        let source = "PURCHASE";

        const inventoryItemIndex = Array.isArray(user.inventory)
            ? user.inventory.findIndex(
                inventoryItem =>
                    inventoryItem.hypeType === hypeType
            )
            : -1;

        if (inventoryItemIndex !== -1) {
            const targetVaultItem =
                user.inventory[inventoryItemIndex];

            if (
                targetVaultItem.itemCount
                && targetVaultItem.itemCount > 1
            ) {
                targetVaultItem.itemCount -= 1;
            } else {
                user.inventory.splice(
                    inventoryItemIndex,
                    1
                );
            }

            user.markModified("inventory");
            source = "INVENTORY";
        } else {
            if (hypeType === "FREE") {
                return NextResponse.json(
                    {
                        error:
                            "No free hype items available "
                            + "in vault"
                    },
                    { status: 400 }
                );
            }

            const currentCoins = Number(user.coins || 0);

            if (currentCoins < item.cost) {
                return NextResponse.json(
                    { error: "Not enough OC" },
                    { status: 400 }
                );
            }

            user.coins = currentCoins - item.cost;
        }

        post.hypePoints =
            Number(post.hypePoints || 0)
            + item.points;

        post.hypeCount =
            Number(post.hypeCount || 0)
            + 1;

        user.totalHypePointsGiven =
            Number(user.totalHypePointsGiven || 0)
            + item.points;

        if (!Array.isArray(user.unlockedTitles)) {
            user.unlockedTitles = [];
        }

        let newGiverTitle = null;

        for (const milestone of HYPER_TIERS) {
            if (
                user.totalHypePointsGiven
                >= milestone.minPoints
            ) {
                const alreadyUnlocked =
                    user.unlockedTitles.some(
                        title =>
                            title.name === milestone.name
                            && title.tier === milestone.tier
                    );

                if (!alreadyUnlocked) {
                    const newTitlePayload = {
                        name: milestone.name,
                        tier: milestone.tier
                    };

                    user.unlockedTitles.push(
                        newTitlePayload
                    );
                    user.equippedTitle =
                        newTitlePayload;
                    newGiverTitle = milestone;
                }

                break;
            }
        }

        const authorQuery = post.authorUserId
            ? { _id: post.authorUserId }
            : post.authorId
                ? { deviceId: post.authorId }
                : null;

        const categoryParts =
            typeof post.category === "string"
                ? post.category.split(":")
                : [];

        const clanTag =
            post.clanId
            || (
                post.category?.startsWith("Clan:")
                    ? categoryParts[
                        categoryParts.length - 1
                    ]?.trim()
                    : null
            );

        const [author, clanDoc] = await Promise.all([
            authorQuery
                ? MobileUser.findOne(authorQuery)
                : Promise.resolve(null),
            clanTag
                ? Clan.findOne({ tag: clanTag })
                : Promise.resolve(null)
        ]);

        let newAuthorTitle = null;

        if (author) {
            author.tokens =
                Number(author.tokens || 0)
                + item.tokens;

            author.totalHypePointsReceived =
                Number(
                    author.totalHypePointsReceived || 0
                )
                + item.points;

            if (!Array.isArray(author.unlockedTitles)) {
                author.unlockedTitles = [];
            }

            for (const milestone of AUTHOR_TIERS) {
                if (
                    author.totalHypePointsReceived
                    >= milestone.minPoints
                ) {
                    const alreadyUnlocked =
                        author.unlockedTitles.some(
                            title =>
                                title.name
                                    === milestone.name
                                && title.tier
                                    === milestone.tier
                        );

                    if (!alreadyUnlocked) {
                        const newTitlePayload = {
                            name: milestone.name,
                            tier: milestone.tier
                        };

                        author.unlockedTitles.push(
                            newTitlePayload
                        );
                        author.equippedTitle =
                            newTitlePayload;
                        newAuthorTitle = milestone;
                    }

                    break;
                }
            }
        }

        let newClanBadge = null;

        if (clanDoc) {
            clanDoc.totalHypePointsReceived =
                Number(
                    clanDoc.totalHypePointsReceived || 0
                )
                + item.points;

            if (!Array.isArray(clanDoc.badges)) {
                clanDoc.badges = [];
            }

            for (const milestone of CLAN_TIERS) {
                if (
                    clanDoc.totalHypePointsReceived
                    >= milestone.minPoints
                ) {
                    if (
                        !clanDoc.badges.includes(
                            milestone.badge
                        )
                    ) {
                        clanDoc.badges.push(
                            milestone.badge
                        );
                        newClanBadge =
                            milestone.badge;
                    }

                    break;
                }
            }
        }

        // Commit the currency/inventory deduction and the hype itself before
        // training the feed or sending any success-side notifications.
        await Promise.all([
            user.save(),
            post.save(),
            author
                ? author.save()
                : Promise.resolve(),
            clanDoc
                ? clanDoc.save()
                : Promise.resolve()
        ]);

        const currentMonth =
            new Date().toISOString().slice(0, 7);

        const leaderboardUpdates = [
            MonthlyHypeStat.updateOne(
                {
                    month: currentMonth,
                    entityType: "USER_GIVEN",
                    entityId: user._id.toString()
                },
                {
                    $setOnInsert: {
                        name:
                            user.username
                            || "Anonymous",
                        avatar:
                            user.profilePic?.url
                            || user.profileImage
                            || ""
                    },
                    $set: {
                        secondaryContext:
                            user.equippedTitle?.name
                            || ""
                    },
                    $inc: {
                        score: item.points,
                        count: 1
                    }
                },
                { upsert: true }
            )
        ];

        if (author) {
            leaderboardUpdates.push(
                MonthlyHypeStat.updateOne(
                    {
                        month: currentMonth,
                        entityType: "USER_RECEIVED",
                        entityId:
                            author._id.toString()
                    },
                    {
                        $setOnInsert: {
                            name:
                                author.username
                                || "Anonymous",
                            avatar:
                                author.profilePic?.url
                                || author.profileImage
                                || ""
                        },
                        $set: {
                            secondaryContext:
                                author.equippedTitle?.name
                                || author.clanTag
                                || ""
                        },
                        $inc: {
                            score: item.points,
                            count: 1
                        }
                    },
                    { upsert: true }
                )
            );
        }

        if (clanTag) {
            leaderboardUpdates.push(
                MonthlyHypeStat.updateOne(
                    {
                        month: currentMonth,
                        entityType: "CLAN_RECEIVED",
                        entityId: clanTag
                    },
                    {
                        $setOnInsert: {
                            name:
                                clanDoc?.name
                                || `Clan ${clanTag}`,
                            avatar:
                                clanDoc?.image?.url
                                || clanDoc?.logo
                                || ""
                        },
                        $inc: {
                            score: item.points,
                            count: 1
                        }
                    },
                    { upsert: true }
                )
            );
        }

        // These are secondary systems. A temporary push/leaderboard failure
        // must not make the client retry a hype whose coins were already spent.
        const secondaryResults =
            await Promise.allSettled([
                HypeLog.create({
                    userId: user._id,
                    postId: post._id,
                    hypeType,
                    points: item.points,
                    source
                }),
                awardClanPoints(
                    post,
                    item.clanPoints,
                    "hype"
                ),
                processTelemetryAndAffinity(
                    deviceId,
                    post,
                    Array.isArray(candidateSources)
                        ? candidateSources.slice(0, 20)
                        : [],
                    "hype",
                    25
                ),
                ...leaderboardUpdates
            ]);

        secondaryResults.forEach(result => {
            if (result.status === "rejected") {
                console.error(
                    "Hype secondary update failed:",
                    result.reason
                );
            }
        });

        const giverAuraResult = await awardAura(
            user._id,
            item.giverAura,
            "hyper"
        ).catch(error => {
            console.error(
                "Giver hype aura failed:",
                error
            );
            return null;
        });

        if (giverAuraResult) {
            user.aura =
                giverAuraResult.user.aura;
            user.weeklyAura =
                giverAuraResult.user.weeklyAura;
            user.currentRankLevel =
                giverAuraResult.user.currentRankLevel;
        }

        if (author) {
            const receiverAuraResult = await awardAura(
                author._id,
                item.receiverAura,
                "hyped"
            ).catch(error => {
                console.error(
                    "Receiver hype aura failed:",
                    error
                );
                return null;
            });

            if (receiverAuraResult) {
                author.aura =
                    receiverAuraResult.user.aura;
                author.weeklyAura =
                    receiverAuraResult.user.weeklyAura;
                author.currentRankLevel =
                    receiverAuraResult
                        .user.currentRankLevel;
            }
        }

        const notificationTasks = [];

        if (author?.pushToken) {
            notificationTasks.push(
                sendPillParallel(
                    [author.pushToken],
                    `New Hype on Post: ${
                        post.title?.slice(0, 20)
                        || "Your post"
                    }`,
                    `${
                        user.username || "Someone"
                    } just hyped your post with a `
                    + `${hypeType} hype!`,
                    {
                        type: "open_post",
                        postId:
                            post._id.toString(),
                        screen:
                            `/post/${post._id}`,
                        mediaUrl: post.mediaUrl,
                        authorPfp:
                            user.profilePic?.url
                    },
                    {
                        type: "achievement",
                        targetId:
                            author._id.toString(),
                        singleUser: true,
                        priority: 3,
                        link:
                            `/post/${post._id}`
                    }
                )
            );
        }

        if (newGiverTitle && user.pushToken) {
            notificationTasks.push(
                sendPillParallel(
                    [user.pushToken],
                    "🏆 New Title Unlocked!",
                    `You earned the ${
                        newGiverTitle.tier
                    } title: "${
                        newGiverTitle.name
                    }"!`,
                    { type: "achievement" },
                    {
                        type: "achievement",
                        targetId:
                            user._id.toString(),
                        singleUser: true,
                        priority: 3
                    }
                )
            );
        }

        if (
            newAuthorTitle
            && author?.pushToken
        ) {
            notificationTasks.push(
                sendPillParallel(
                    [author.pushToken],
                    "✨ Content Creator Milestone!",
                    `Your content earned the ${
                        newAuthorTitle.tier
                    } title: "${
                        newAuthorTitle.name
                    }"!`,
                    { type: "achievement" },
                    {
                        type: "achievement",
                        targetId:
                            author._id.toString(),
                        singleUser: true,
                        priority: 3
                    }
                )
            );
        }

        const notificationResults =
            await Promise.allSettled(
                notificationTasks
            );

        notificationResults.forEach(result => {
            if (result.status === "rejected") {
                console.error(
                    "Hype notification failed:",
                    result.reason
                );
            }
        });

        return NextResponse.json({
            success: true,
            newBalance: user.coins,
            source,
            hypePoints: post.hypePoints,
            hypeCount: post.hypeCount,
            giverTitle:
                user.equippedTitle || null,
            authorTitleUnlocked:
                newAuthorTitle || null,
            clanBadgeUnlocked:
                newClanBadge || null
        });
    } catch (error) {
        console.error("Hype route error:", error);

        return NextResponse.json(
            {
                error: "Server error",
                message: error.message
            },
            { status: 500 }
        );
    }
}

// ----------------------
// 🧠 UNIFIED HELPER: Telemetry, Affinity, Decay, & Optimization
// ----------------------
async function processTelemetryAndAffinity(
    fingerprint,
    post,
    candidateSources,
    action,
    weight
) {
    if (!fingerprint || !post) return;

    try {
        const user = await MobileUser.findOne({ deviceId: fingerprint })
            .select("_id affinityScores authorAffinity countryAffinity feedLearning")
            .lean();

        if (!user) return;

        const tagWeight = Number(weight) || 0;
        const authorWeight = Math.round(tagWeight * 0.5);
        const countryWeight = Math.round(tagWeight * 0.25);

        let affinityScores = user.affinityScores
            ? (
                user.affinityScores instanceof Map
                    ? Object.fromEntries(user.affinityScores)
                    : { ...user.affinityScores }
            )
            : {};

        let authorAffinity = user.authorAffinity
            ? (
                user.authorAffinity instanceof Map
                    ? Object.fromEntries(user.authorAffinity)
                    : { ...user.authorAffinity }
            )
            : {};

        let countryAffinity = user.countryAffinity
            ? (
                user.countryAffinity instanceof Map
                    ? Object.fromEntries(user.countryAffinity)
                    : { ...user.countryAffinity }
            )
            : {};

        const updateAndTrim = (obj, key, addWeight, limit) => {
            if (!key || !Number.isFinite(addWeight) || addWeight === 0) {
                return obj;
            }

            const sanitizedKey = String(key)
                .replace(/\./g, "_")
                .replace(/\$/g, "");

            if (!sanitizedKey) return obj;

            const current = typeof obj[sanitizedKey] === "number"
                ? obj[sanitizedKey]
                : 0;

            const nextValue = current + addWeight;

            // Negative feedback removes learned affinity rather than leaving a
            // negative value that the GET ranker currently treats as a fallback.
            if (nextValue <= 0) {
                delete obj[sanitizedKey];
            } else {
                obj[sanitizedKey] = Math.min(5000, nextValue);
            }

            if (Object.keys(obj).length > limit + 10) {
                return Object.fromEntries(
                    Object.entries(obj)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, limit)
                );
            }

            return obj;
        };

        if (Array.isArray(post.interests)) {
            post.interests.forEach(tag => {
                if (tag) {
                    affinityScores = updateAndTrim(
                        affinityScores,
                        tag.trim().toLowerCase(),
                        tagWeight,
                        50
                    );
                }
            });
        }

        const postAuthorUserId = post.authorUserId?.toString();
        const postAuthorDeviceId = post.authorId?.toString();
        const isOwnPost =
            postAuthorDeviceId === fingerprint
            || postAuthorUserId === user._id?.toString();

        const targetAuthor = postAuthorUserId || postAuthorDeviceId;
        if (targetAuthor && !isOwnPost) {
            authorAffinity = updateAndTrim(
                authorAffinity,
                targetAuthor,
                authorWeight,
                30
            );
        }

        if (
            post.country
            && post.country !== "Global"
            && post.country !== "Unknown"
        ) {
            countryAffinity = updateAndTrim(
                countryAffinity,
                post.country,
                countryWeight,
                10
            );
        }

        const actionMap = {
            view: "impressions",
            like: "likes",
            share: "shares",
            vote: "votes",
            watch_complete: "watch_complete",
            skip: "skips",
            not_interested: "skips",
            comment: "comments",
            hype: "votes"
        };

        const metric = actionMap[action];
        const validPools = [
            "fresh",
            "author",
            "clan",
            "interest",
            "trending",
            "explore"
        ];
        const incUpdates = {};

        if (
            metric
            && Array.isArray(candidateSources)
            && candidateSources.length > 0
        ) {
            const uniqueTypes = [
                ...new Set(
                    candidateSources
                        .slice(0, 20)
                        .map(source => source?.type)
                        .filter(type => validPools.includes(type))
                )
            ];

            if (uniqueTypes.length > 0) {
                const POOL_CONFIDENCE = {
                    explore: 1,
                    fresh: 1,
                    clan: 2,
                    trending: 4,
                    interest: 4,
                    author: 4
                };

                const scoredSources = uniqueTypes.map(type => ({
                    type,
                    confidence: POOL_CONFIDENCE[type] || 1
                }));

                const totalConfidence = scoredSources.reduce(
                    (sum, source) => sum + source.confidence,
                    0
                );

                let assignedFraction = 0;

                scoredSources.forEach((source, index) => {
                    const isLast = index === scoredSources.length - 1;
                    const normalizedFraction = isLast
                        ? Number((1 - assignedFraction).toFixed(3))
                        : Number(
                            (
                                source.confidence / totalConfidence
                            ).toFixed(3)
                        );

                    assignedFraction += normalizedFraction;

                    if (
                        Number.isFinite(normalizedFraction)
                        && normalizedFraction > 0
                    ) {
                        incUpdates[
                            `feedLearning.sourceStats.${source.type}.${metric}`
                        ] = normalizedFraction;
                    }
                });
            }
        }

        const setUpdates = {
            affinityScores,
            authorAffinity,
            countryAffinity
        };

        if (user.feedLearning) {
            const lastOptimizedAt = new Date(
                user.feedLearning.lastOptimizedAt || 0
            );
            const stats = user.feedLearning.sourceStats || {};

            let totalImpressions = 0;
            validPools.forEach(pool => {
                totalImpressions += stats[pool]?.impressions || 0;
            });

            if (
                metric === "impressions"
                && Object.keys(incUpdates).length > 0
            ) {
                totalImpressions += 1;
            }

            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (
                Date.now() - lastOptimizedAt.getTime() >= twentyFourHours
                && totalImpressions >= 100
            ) {
                const decayMap = (mapObject, factor = 0.98) => {
                    for (const key of Object.keys(mapObject)) {
                        mapObject[key] = Number(
                            (mapObject[key] * factor).toFixed(2)
                        );

                        if (mapObject[key] < 1) {
                            delete mapObject[key];
                        }
                    }
                };

                decayMap(setUpdates.affinityScores);
                decayMap(setUpdates.authorAffinity);
                decayMap(setUpdates.countryAffinity);

                let totalScore = 0;
                const rawScores = {};

                validPools.forEach(pool => {
                    const sourceStats = stats[pool] || {};
                    const impressions =
                        (sourceStats.impressions || 0)
                        + (
                            incUpdates[
                                `feedLearning.sourceStats.${pool}.impressions`
                            ] || 0
                        );

                    let score;

                    if (impressions < 20) {
                        score = 50;
                    } else {
                        const rate = metricName =>
                            (
                                (sourceStats[metricName] || 0)
                                + (
                                    incUpdates[
                                        `feedLearning.sourceStats.${pool}.${metricName}`
                                    ] || 0
                                )
                            ) / impressions;

                        score =
                            10
                            + rate("likes") * 50
                            + rate("votes") * 50
                            + rate("watch_complete") * 80
                            + rate("comments") * 100
                            + rate("shares") * 150
                            - rate("skips") * 60;
                    }

                    rawScores[pool] = Math.max(10, score);
                    totalScore += rawScores[pool];
                });

                const newWeights = {};
                validPools.forEach(pool => {
                    newWeights[pool] = rawScores[pool] / totalScore;
                });

                let clampedTotal = 0;
                validPools.forEach(pool => {
                    newWeights[pool] = Math.max(
                        0.05,
                        Math.min(0.45, newWeights[pool])
                    );
                    clampedTotal += newWeights[pool];
                });

                let assignedWeight = 0;
                validPools.forEach((pool, index) => {
                    const isLast = index === validPools.length - 1;
                    const normalizedWeight = isLast
                        ? Number((1 - assignedWeight).toFixed(3))
                        : Number(
                            (
                                newWeights[pool] / clampedTotal
                            ).toFixed(3)
                        );

                    newWeights[pool] = normalizedWeight;
                    assignedWeight += normalizedWeight;
                });

                setUpdates["feedLearning.poolWeights"] = newWeights;
                setUpdates["feedLearning.lastOptimizedAt"] = new Date();

                Object.keys(incUpdates).forEach(key => {
                    delete incUpdates[key];
                });

                validPools.forEach(pool => {
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.impressions`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.likes`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.votes`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.watch_complete`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.comments`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.shares`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.skips`
                    ] = 0;
                });

                console.log(
                    `[ML] Epoch closed for ${fingerprint}:`,
                    newWeights
                );
            }
        }

        const updateOperation = { $set: setUpdates };

        if (Object.keys(incUpdates).length > 0) {
            updateOperation.$inc = incUpdates;
        }

        await MobileUser.updateOne(
            { _id: user._id },
            updateOperation
        );
    } catch (err) {
        console.error("❌ Unified Telemetry Error:", err);
    }
}
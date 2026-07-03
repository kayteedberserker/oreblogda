import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollower";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

// ⚡️ HELPER: Escapes special characters for safe regex injection
const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// ⚡️ HELPER: Diversity Pass
const applyDiversityPass = (posts, maxConsecutive = 2) => {
    const result = [];
    const heldBack = [];

    for (const post of posts) {
        const authorId = (post.authorUserId || post.authorId)?.toString();
        const clanId = (post.clanTag || post.clanId)?.toString();
        const category = post.category?.toLowerCase();

        const recent = result.slice(-maxConsecutive);

        const isAuthorSpam = authorId && recent.filter(p => (p.authorUserId || p.authorId)?.toString() === authorId).length >= maxConsecutive;
        const isClanSpam = clanId && recent.filter(p => (p.clanTag || p.clanId)?.toString() === clanId).length >= maxConsecutive;
        const isCategorySpam = category && recent.filter(p => p.category?.toLowerCase() === category).length >= maxConsecutive;

        if (isAuthorSpam || isClanSpam || isCategorySpam) {
            heldBack.push(post);
        } else {
            result.push(post);

            if (heldBack.length > 0) {
                const safeIndex = heldBack.findIndex(hp => {
                    const hpAuthorId = (hp.authorUserId || hp.authorId)?.toString();
                    const hpClanId = (hp.clanTag || hp.clanId)?.toString();
                    const hpCategory = hp.category?.toLowerCase();
                    const hpRecent = result.slice(-maxConsecutive);

                    const hpAuthSpam = hpAuthorId && hpRecent.filter(p => (p.authorUserId || p.authorId)?.toString() === hpAuthorId).length >= maxConsecutive;
                    const hpClanSpam = hpClanId && hpRecent.filter(p => (p.clanTag || p.clanId)?.toString() === hpClanId).length >= maxConsecutive;
                    const hpCatSpam = hpCategory && hpRecent.filter(p => p.category?.toLowerCase() === hpCategory).length >= maxConsecutive;

                    return !hpAuthSpam && !hpClanSpam && !hpCatSpam;
                });

                if (safeIndex !== -1) {
                    result.push(heldBack.splice(safeIndex, 1)[0]);
                }
            }
        }
    }
    return result.concat(heldBack);
};

export async function GET(req) {
    await connectDB();
    try {
        const { searchParams } = new URL(req.url);
        const page = parseInt(searchParams.get("page")) || 1;
        const limit = parseInt(searchParams.get("limit")) || 10;

        // ⚡️ 1. Grab all the contextual params
        const startingId = searchParams.get("startingId");
        const viewerId = searchParams.get("viewerId");
        const authorFilter = searchParams.get("author");
        const clanFilter = searchParams.get("clan");
        const categoryFilter = searchParams.get("category");

        const deviceId = req.headers.get("x-user-deviceId") || "";
        const userCountry = req.headers.get("x-user-country") || "Global";

        // ⚡️ Force all incoming static preferences to lowercase immediately
        const favAnimes = req.headers.get("x-user-animes")?.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) || [];
        const favGenres = req.headers.get("x-user-genres")?.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) || [];
        const favCharacter = req.headers.get("x-user-character")?.trim().toLowerCase() || "";

        const userInterests = [...favAnimes, ...favGenres];
        if (favCharacter) userInterests.push(favCharacter);

        const skip = (page - 1) * limit;
        const now = new Date();
        const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));

        // 🧠 FETCH DYNAMIC USER AFFINITY & FEED LEARNING PROFILE
        let safeAffinity = {};
        let safeAuthorAffinity = {};
        let safeCountryAffinity = {};

        let dynamicWeights = {
            fresh: 0.35,
            author: 0.20,
            clan: 0.15,
            interest: 0.15,
            trending: 0.10,
            explore: 0.05
        };

        if (deviceId && !authorFilter && !clanFilter) {
            const userProfile = await MobileUser.findOne({ deviceId })
                .select("affinityScores authorAffinity countryAffinity feedLearning")
                .lean();

            if (userProfile) {
                safeAffinity = userProfile.affinityScores || {};
                safeAuthorAffinity = userProfile.authorAffinity || {};
                safeCountryAffinity = userProfile.countryAffinity || {};

                if (userProfile.feedLearning?.poolWeights) {
                    dynamicWeights = { ...dynamicWeights, ...userProfile.feedLearning.poolWeights };
                }
            }
        }

        let followedClanTags = [];
        let viewerClanTags = [];

        if (viewerId) {
            const follows = await ClanFollower.find({ userId: viewerId }).select("clanTag").lean();
            followedClanTags = follows.map(f => f.clanTag);

            const memberships = await Clan.find({
                $or: [
                    { leader: viewerId },
                    { viceLeader: viewerId },
                    { members: viewerId }
                ]
            }).select("tag _id").lean();
            viewerClanTags = memberships.map(c => c.tag).concat(memberships.map(c => c._id.toString()));
        }

        let query = {};
        let basePoolQuery = { status: "approved", "media.type": "video" };

        // ⚡️ 2. Fetch "Seed" Interests and apply Hard Filters to basePoolQuery
        let seedInterests = [];
        let regexInterests = [];
        if (startingId && mongoose.Types.ObjectId.isValid(startingId)) {
            const seedVideo = await Post.findById(startingId).select("interests").lean();
            if (seedVideo && seedVideo.interests?.length > 0) {
                seedInterests = seedVideo.interests.map(t => t.trim().toLowerCase());
                regexInterests = seedInterests.map(tag => new RegExp(`^${escapeRegex(tag)}$`, 'i'));

                basePoolQuery._id = { $ne: new mongoose.Types.ObjectId(startingId) };
                basePoolQuery.interests = { $in: regexInterests };
            }
        }

        if (categoryFilter) {
            basePoolQuery.category = categoryFilter;
        }

        // 🌟 TELEMETRY: IN-MEMORY CANDIDATE TRACKING WITH WEIGHTS
        const candidateMap = new Map();
        const addCandidate = (postId, type, reason = null, weight = 1) => {
            const id = postId.toString();
            if (!candidateMap.has(id)) {
                candidateMap.set(id, { _id: id, sources: [] });
            }

            const sources = candidateMap.get(id).sources;
            if (!sources.some(s => s.type === type && s.reason === reason)) {
                sources.push({ type, reason, weight });
            }
        };

        // ============================================================================
        // ⚡️ ML PHASE 1: CANDIDATE POOL ARCHITECTURE
        // ============================================================================
        if (authorFilter) {
            const isObjId = mongoose.Types.ObjectId.isValid(authorFilter);
            query = {
                ...basePoolQuery, $or: [
                    { authorUserId: isObjId ? new mongoose.Types.ObjectId(authorFilter) : authorFilter },
                    { authorId: authorFilter }
                ]
            };

        } else if (clanFilter) {
            query = { ...basePoolQuery, clanId: clanFilter };

        } else {
            // 🌐 GLOBAL VIDEO FEED: PARALLEL CANDIDATE POOLING
            const poolBudget = 700;
            const POOL_CONFIG = {
                freshPool: Math.floor(poolBudget * dynamicWeights.fresh),
                authorPool: Math.floor(poolBudget * dynamicWeights.author),
                clanPool: Math.floor(poolBudget * dynamicWeights.clan),
                interestPool: Math.floor(poolBudget * dynamicWeights.interest),
                trendingPool: Math.floor(poolBudget * dynamicWeights.trending),
                explorePool: Math.floor(poolBudget * dynamicWeights.explore)
            };

            const topAuthors = Object.entries(safeAuthorAffinity)
                .filter(([, score]) => score >= 10)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 15)
                .map(([id]) => id);

            const activeClanTags = [...new Set([...followedClanTags, ...viewerClanTags])];
            const personalInterestRegexes = userInterests.map(i => new RegExp(`^${escapeRegex(i)}$`, "i"));

            const [
                freshPool,
                authorPool,
                clanPool,
                trendingPool,
                interestPool,
                explorePool
            ] = await Promise.all([
                Post.find(basePoolQuery).sort({ createdAt: -1 }).limit(POOL_CONFIG.freshPool).select("_id").lean(),

                topAuthors.length > 0
                    ? Post.find({
                        ...basePoolQuery,
                        $or: [
                            { authorUserId: { $in: topAuthors.map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id) } },
                            { authorId: { $in: topAuthors } }
                        ]
                    }).sort({ createdAt: -1 }).limit(POOL_CONFIG.authorPool).select("_id authorUserId authorId").lean()
                    : Promise.resolve([]),

                activeClanTags.length > 0
                    ? Post.find({
                        ...basePoolQuery,
                        $or: [{ clanId: { $in: activeClanTags } }, { clanTag: { $in: activeClanTags } }]
                    }).sort({ createdAt: -1 }).limit(POOL_CONFIG.clanPool).select("_id clanId clanTag").lean()
                    : Promise.resolve([]),

                Post.find({
                    ...basePoolQuery,
                    $or: [
                        { boostedUntil: { $gt: now } },
                        { resurrectedAt: { $gte: fortyEightHoursAgo } },
                        {
                            createdAt: { $gte: fortyEightHoursAgo },
                            $expr: {
                                $or: [
                                    { $gte: [{ $size: { $ifNull: ["$likes", []] } }, 50] },
                                    { $gte: [{ $size: { $ifNull: ["$comments", []] } }, 20] },
                                    { $gte: [{ $ifNull: ["$hypeCount", "$hypePoints", 0] }, 100] }
                                ]
                            }
                        }
                    ]
                }).sort({ createdAt: -1 }).limit(POOL_CONFIG.trendingPool).select("_id").lean(),

                personalInterestRegexes.length > 0
                    ? Post.find({
                        ...basePoolQuery,
                        interests: { $in: personalInterestRegexes }
                    }).sort({ createdAt: -1 }).limit(POOL_CONFIG.interestPool).select("_id interests").lean()
                    : Promise.resolve([]),

                Post.aggregate([
                    { $match: basePoolQuery },
                    { $sample: { size: POOL_CONFIG.explorePool } },
                    { $project: { _id: 1 } }
                ])
            ]);

            freshPool.forEach(p => addCandidate(p._id, "fresh", "recent", 1));
            authorPool.forEach(p => {
                const aId = (p.authorUserId || p.authorId)?.toString();
                const weight = safeAuthorAffinity[aId] || 10;
                addCandidate(p._id, "author", aId, weight);
            });
            clanPool.forEach(p => {
                const cId = (p.clanTag || p.clanId)?.toString();
                addCandidate(p._id, "clan", cId, 20);
            });
            trendingPool.forEach(p => addCandidate(p._id, "trending", "viral_or_boosted", 50));
            interestPool.forEach(p => {
                const rawTags = p.interests || [];
                const matchedTag = rawTags.find(tag => userInterests.includes(tag.toLowerCase().trim()));
                const cleanTag = matchedTag ? matchedTag.toLowerCase().trim() : null;
                const weight = (cleanTag && safeAffinity[cleanTag]) ? safeAffinity[cleanTag] : 5;
                addCandidate(p._id, "interest", matchedTag || "general_match", weight);
            });
            explorePool.forEach(p => addCandidate(p._id, "explore", "discovery", 1));

            const mergedIds = [
                ...freshPool, ...authorPool, ...clanPool, ...trendingPool, ...interestPool, ...explorePool
            ].map(p => p._id.toString());

            const uniqueCandidateIds = [...new Set(mergedIds)].map(id => new mongoose.Types.ObjectId(id));

            query = { _id: { $in: uniqueCandidateIds } };
        }

        // ============================================================================
        // ⚡️ AGGREGATION & SCORING PIPELINE
        // ============================================================================
        let posts;

        const CONFIG = {
            likeWeight: 2.0, commentWeight: 4.0, hypeBaseWeight: 10.0, hypeDecayRate: 0.15,
            freshnessBoost: 20, freshnessWindow: 3, gravityPower: 1.2, staticPrefBonus: 3,
            staticLocalBonus: 4, clanBonus: 15, affinityMultiplier: 1.5, tierBasicWeight: 4,
            tierEpicWeight: 7, tierLegendaryWeight: 10, tierFollowerMultiplier: 1.5,
            partnerClanBonus: 20, postBoostMultiplier: 3.0, boostIgnitionScore: 15,
            trendingThreshold: 1000, seedMatchBonus: 500
        };

        const pipeline = [
            { $match: query },

            // ⚡️ Video-Specific Unwinding
            { $unwind: { path: "$media", includeArrayIndex: "mediaIndex" } },
            { $match: { "media.type": "video" } },

            { $addFields: { effectiveDate: { $max: ["$createdAt", { $ifNull: ["$resurrectedAt", "$createdAt"] }] } } },
            {
                $lookup: {
                    from: "clans",
                    let: { postClanId: "$clanId" },
                    pipeline: [
                        { $match: { $expr: { $or: [{ $eq: ["$tag", "$$postClanId"] }, { $eq: [{ $toString: "$_id" }, "$$postClanId"] }] } } },
                        { $project: { verifiedClan: 1, "activeCustomizations.verifiedTier": 1, verifiedUntil: 1 } }
                    ],
                    as: "clanInfo"
                }
            },
            { $unwind: { path: "$clanInfo", preserveNullAndEmptyArrays: true } },
            {
                $addFields: {
                    ageInHours: { $max: [0.5, { $divide: [{ $subtract: [now, "$effectiveDate"] }, 3600000] }] },
                    commentsCount: { $size: { $ifNull: ["$comments", []] } },
                    likesCount: { $size: { $ifNull: ["$likes", []] } },
                    hypePointsCount: { $ifNull: ["$hypeCount", "$hypePoints", 0] },
                    isActiveBoost: { $cond: [{ $and: [{ $ne: ["$boostedUntil", null] }, { $gt: ["$boostedUntil", now] }] }, true, false] },
                    matchCount: {
                        $size: {
                            $setIntersection: [
                                { $map: { input: { $ifNull: ["$interests", []] }, as: "t", in: { $toLower: { $trim: { input: "$$t" } } } } },
                                userInterests
                            ]
                        }
                    },
                    isViewerFollowingClan: { $or: [{ $in: ["$clanId", followedClanTags] }, { $in: ["$clanTag", followedClanTags] }] },
                    hasValidBadge: { $and: [{ $ne: ["$clanInfo.verifiedUntil", null] }, { $gt: ["$clanInfo.verifiedUntil", now] }] }
                }
            },
            {
                $addFields: {
                    tagAffinityTotal: {
                        $sum: {
                            $map: {
                                input: { $ifNull: ["$interests", []] },
                                as: "rawTag",
                                in: {
                                    $let: {
                                        vars: { cleanTag: { $toLower: { $trim: { input: "$$rawTag" } } } },
                                        in: {
                                            $let: {
                                                vars: {
                                                    dynamicScore: { $ifNull: [{ $getField: { field: "$$cleanTag", input: { $literal: safeAffinity } } }, 0] },
                                                    isStaticMatch: { $in: ["$$cleanTag", userInterests] }
                                                },
                                                in: { $cond: [{ $gt: ["$$dynamicScore", 0] }, "$$dynamicScore", { $cond: ["$$isStaticMatch", CONFIG.staticPrefBonus, 0] }] }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    authorAffinityScore: { $ifNull: [{ $getField: { field: { $toString: { $ifNull: ["$authorUserId", "$authorId"] } }, input: { $literal: safeAuthorAffinity } } }, 0] },
                    countryAffinityScore: {
                        $let: {
                            vars: {
                                dynCountry: { $ifNull: [{ $getField: { field: { $ifNull: ["$country", "Global"] }, input: { $literal: safeCountryAffinity } } }, 0] },
                                isStaticCountry: { $eq: ["$country", userCountry] }
                            },
                            in: { $cond: [{ $gt: ["$$dynCountry", 0] }, "$$dynCountry", { $cond: ["$$isStaticCountry", CONFIG.staticLocalBonus, 0] }] }
                        }
                    },
                    decayedHypeWeight: { $divide: [CONFIG.hypeBaseWeight, { $max: [1, { $multiply: ["$ageInHours", CONFIG.hypeDecayRate] }] }] },
                    clanTierBonus: {
                        $cond: [
                            "$hasValidBadge",
                            {
                                $switch: {
                                    branches: [
                                        { case: { $eq: ["$clanInfo.activeCustomizations.verifiedTier", "legendary"] }, then: CONFIG.tierLegendaryWeight },
                                        { case: { $eq: ["$clanInfo.activeCustomizations.verifiedTier", "epic"] }, then: CONFIG.tierEpicWeight },
                                        { case: { $eq: ["$clanInfo.activeCustomizations.verifiedTier", "basic"] }, then: CONFIG.tierBasicWeight }
                                    ], default: 0
                                }
                            }, 0
                        ]
                    },
                    partnerClanBonusVal: { $cond: [{ $and: ["$isViewerFollowingClan", { $eq: ["$clanInfo.verifiedClan", true] }] }, CONFIG.partnerClanBonus, 0] },
                    seedMatchBonusVal: {
                        $let: {
                            vars: {
                                overlapCount: {
                                    $size: {
                                        $setIntersection: [
                                            { $map: { input: { $ifNull: ["$interests", []] }, as: "t", in: { $toLower: { $trim: { input: "$$t" } } } } },
                                            seedInterests
                                        ]
                                    }
                                }
                            },
                            in: { $multiply: ["$$overlapCount", CONFIG.seedMatchBonus] }
                        }
                    }
                }
            },
            {
                $addFields: {
                    engagementScore: {
                        $multiply: [
                            {
                                $add: [
                                    { $cond: ["$isActiveBoost", CONFIG.boostIgnitionScore, 0] },
                                    { $multiply: [{ $ifNull: ["$likesCount", 0] }, CONFIG.likeWeight] },
                                    { $multiply: ["$commentsCount", CONFIG.commentWeight] },
                                    { $multiply: [{ $sqrt: { $ifNull: ["$hypePointsCount", 0] } }, "$decayedHypeWeight"] }
                                ]
                            },
                            { $cond: ["$isActiveBoost", CONFIG.postBoostMultiplier, 1] }
                        ]
                    },
                    relevanceBonus: {
                        $add: [
                            { $multiply: ["$tagAffinityTotal", CONFIG.affinityMultiplier] },
                            { $multiply: ["$authorAffinityScore", CONFIG.affinityMultiplier] },
                            { $multiply: ["$countryAffinityScore", CONFIG.affinityMultiplier] },
                            { $cond: ["$isViewerFollowingClan", CONFIG.clanBonus, 0] },
                            { $cond: ["$isViewerFollowingClan", { $multiply: ["$clanTierBonus", CONFIG.tierFollowerMultiplier] }, "$clanTierBonus"] },
                            "$partnerClanBonusVal",
                            "$seedMatchBonusVal" // 🌟 The video feed specific bonus
                        ]
                    },
                    noveltyScore: { $cond: [{ $lt: ["$ageInHours", CONFIG.freshnessWindow] }, CONFIG.freshnessBoost, 0] }
                }
            },
            { $addFields: { finalScore: { $divide: [{ $add: ["$engagementScore", "$relevanceBonus", "$noveltyScore"] }, { $pow: ["$ageInHours", CONFIG.gravityPower] }] } } },
            { $sort: { isAdminPost: -1, finalScore: -1, effectiveDate: -1 } }
        ];

        posts = await Post.aggregate(pipeline);

        if (posts.length > 0 && !authorFilter && !clanFilter) {
            posts = applyDiversityPass(posts, 2);
        }

        posts = posts.slice(skip, skip + limit);

        // ============================================================================
        // 📦 POPULATION & SERIALIZATION
        // ============================================================================
        let userMap = {};
        let clanMap = {};

        try {
            const uniqueAuthorIds = [...new Set(posts.map(p => (p.authorUserId || p.authorId)?.toString()).filter(Boolean))];
            const uniqueClanTags = [...new Set(posts.map(p => (p.clanTag || p.clanId)?.toString()).filter(Boolean))];

            if (uniqueAuthorIds.length > 0) {
                const users = await MobileUser.find({ _id: { $in: uniqueAuthorIds } }).lean();

                users.forEach(u => {
                    const userIdStr = u._id.toString();
                    const rankInfo = typeof resolveUserRankServer === 'function' ? resolveUserRankServer(u.currentRankLevel || 1) : { rankName: "Rookie" };
                    const auraInfo = typeof getAuraVisualsServer === 'function' ? getAuraVisualsServer(u.previousRank || 0) : null;
                    const inv = Array.isArray(u.inventory) ? u.inventory : (Array.isArray(u.specialInventory) ? u.specialInventory : []);

                    userMap[userIdStr] = {
                        name: u.username, image: u.profilePic?.url || null, streak: u.lastStreak || 0,
                        rank: u.previousRank || 0, peakLevel: u.peakLevel || 0, inventory: inv,
                        rankLevel: u.currentRankLevel || 1, aura: u.aura || 0, displayRank: rankInfo.rankName,
                        auraVisuals: auraInfo,
                        equippedGlow: inv.find(i => (i.category === 'GLOW' || i.category === 'NAME_GLOW') && i.isEquipped) || null,
                        equippedBadges: inv.filter(i => i.category === 'BADGE' && i.isEquipped).slice(0, 3) || [],
                        equippedTitle: u.equippedTitle || null, nameLockedUntil: u.nameLockedUntil || null
                    };
                });
            }

            if (uniqueClanTags.length > 0) {
                const clans = await Clan.find({
                    $or: [{ tag: { $in: uniqueClanTags } }, { _id: { $in: uniqueClanTags.filter(id => id.length === 24) } }]
                }).lean();

                clans.forEach(c => {
                    const enrichedClan = { ...c, displayRank: typeof resolveClanDisplayRank === 'function' ? resolveClanDisplayRank(c.totalPoints || 0) : "Rank 1" };
                    if (c.tag) clanMap[c.tag] = enrichedClan;
                    if (c._id) clanMap[c._id.toString()] = enrichedClan;
                });
            }
        } catch (popErr) { console.error("Bulk Population Error:", popErr); }

        const serializedPosts = posts.map((p) => {
            const aId = (p.authorUserId || p.authorId)?.toString();
            const cTag = (p.clanTag || p.clanId)?.toString();

            const feedMessage = (p.message || "")
                .replace(/s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs, "$1$2$3$4$5$6$8$10")
                .replace(/\n+/g, ' ').trim();

            const postLikes = p.likes || [];
            const hasLiked = deviceId ? postLikes.some(like => (like?.fingerprint === deviceId || like === deviceId)) : false;

            const finalHypeCount = p.hypePointsCount || 0;
            const isTrending = finalHypeCount >= CONFIG.trendingThreshold;
            const isBoosted = Boolean(p.boostedUntil && new Date(p.boostedUntil).getTime() > Date.now());
            const isResurrected = Boolean(p.resurrectedAt && new Date(p.resurrectedAt) > fortyEightHoursAgo);
            const isFollowingClan = Boolean(cTag && followedClanTags.includes(cTag));

            const telemetrySources = candidateMap.get(p._id.toString())?.sources || [];

            return {
                _id: p._id.toString(),
                videoId: `${p._id.toString()}_${p.mediaIndex}`, // 🌟 Unwound video ID structure preserved
                mediaUrl: p.media.url,
                title: p.title,
                authorUserId: p.authorUserId || p.authorId,
                content: feedMessage.length > 150 ? feedMessage.slice(0, 150) + "..." : feedMessage,
                stats: {
                    likes: p.likesCount ?? (p.likes?.length || 0),
                    comments: p.commentsCount ?? (p.comments?.length || 0),
                    hype: finalHypeCount,
                    shares: p.shares || 0,
                    views: p.views || 0,
                },
                isLiked: hasLiked,
                isTrending,
                isBoosted,
                isResurrected,
                isFollowingClan,
                candidateSources: telemetrySources, // 🌟 ML Telemetry attached natively
                authorData: userMap[aId] || null,
                clanData: clanMap[cTag] || null
            };
        });

        return NextResponse.json({
            posts: serializedPosts,
            page,
            limit
        }, { status: 200 });

    } catch (err) {
        console.error("GET Video Feed Error:", err);
        return NextResponse.json({ message: "Failed to fetch video feed" }, { status: 500 });
    }
}
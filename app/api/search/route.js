import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel";
import { NextResponse } from "next/server";

// ⚡️ HELPER: Escapes special characters so searches like "[Awakening]" don't crash the database regex
const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

export async function GET(req) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const rawQuery = searchParams.get("q")?.trim();
        const query = rawQuery?.toLowerCase();
        const page = parseInt(searchParams.get("page")) || 1;
        const limit = parseInt(searchParams.get("limit")) || 10;
        const skip = (page - 1) * limit;

        const deviceId = req.headers.get("x-user-deviceId") || "";

        if (!rawQuery || rawQuery.length < 2) {
            return NextResponse.json({ success: false, message: "Input required" }, { status: 400 });
        }

        let users = [];
        let clans = [];
        let posts = [];
        let totalPosts = 0;
        let isIntentSearch = false;

        const TRENDING_THRESHOLD = 1000;
        const now = new Date(); // ⚡️ REQUIRED FOR PREMIUM TIMESTAMPS

        // ==========================================
        // 🧠 LAYER 1: INTENT DETECTION
        // ==========================================

        if (['clan', 'clans', 'guild', 'alliance', 'top clan', 'squad'].some(k => query.includes(k))) {
            isIntentSearch = true;
            // ⚡️ UPDATED: Aggregation prioritizes Locked Factions first, then total points
            clans = await Clan.aggregate([
                {
                    $addFields: {
                        isLockedBoost: { $cond: [{ $and: [{ $ne: ["$nameLockedUntil", null] }, { $gt: ["$nameLockedUntil", now] }] }, 1, 0] }
                    }
                },
                { $sort: { isLockedBoost: -1, totalPoints: -1, rank: -1 } },
                { $limit: 10 }
            ]);

            users = [];
            posts = [];
        }
        else if (['aura', 'best author', 'top author', 'ranking', 'elite', 'leaderboard'].some(k => query.includes(k))) {
            isIntentSearch = true;
            // ⚡️ UPDATED: Aggregation prioritizes Locked Operators first
            users = await MobileUser.aggregate([
                {
                    $addFields: {
                        isLockedBoost: { $cond: [{ $and: [{ $ne: ["$nameLockedUntil", null] }, { $gt: ["$nameLockedUntil", now] }] }, 1, 0] }
                    }
                },
                { $sort: { isLockedBoost: -1, previousRank: 1, weeklyAura: -1 } },
                { $limit: 15 }
            ]);

            posts = [];
            totalPosts = 0;
        }
        else if (['most liked', 'viral', 'best post', 'top post', 'popular'].some(k => query.includes(k))) {
            isIntentSearch = true;
            const pipeline = [
                { $match: { status: "approved" } },
                { $addFields: { likesCount: { $size: { "$ifNull": ["$likes", []] } } } },
                { $sort: { likesCount: -1 } },
                { $skip: skip },
                { $limit: limit }
            ];
            posts = await Post.aggregate(pipeline);
            totalPosts = await Post.countDocuments({ status: "approved" });
        }
        else if (['discussion', 'comments', 'debate', 'trending', 'hot'].some(k => query.includes(k))) {
            isIntentSearch = true;
            const pipeline = [
                { $match: { status: "approved" } },
                { $addFields: { commentsCount: { $size: { "$ifNull": ["$comments", []] } } } },
                { $sort: { commentsCount: -1, views: -1 } },
                { $skip: skip },
                { $limit: limit }
            ];
            posts = await Post.aggregate(pipeline);
            totalPosts = await Post.countDocuments({ status: "approved" });
        }

        // ==========================================
        // 🧠 LAYER 2: STANDARD NEURAL SEARCH WITH WEIGHTS
        // ==========================================

        if (!isIntentSearch) {
            const tokens = rawQuery.split(/\s+/).filter(t => t.length > 1);

            const extendedTokens = [...tokens];
            tokens.forEach(token => {
                if (/^\d{4}$/.test(token)) {
                    const year = parseInt(token);
                    extendedTokens.push((year - 1).toString());
                    extendedTokens.push((year + 1).toString());
                }
            });

            const searchRegexes = extendedTokens.map(t => new RegExp(escapeRegex(t), "i"));
            const lowerTokens = extendedTokens.map(t => t.toLowerCase());

            const postScoring = [
                { $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$title", ""] } }, query] }, 0] }, 1000, 0] },
                { $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$message", ""] } }, query] }, 0] }, 500, 0] }
            ];

            const userScoring = [
                { $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$username", ""] } }, query] }, 0] }, 1000, 0] },
                { $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$clanName", ""] } }, query] }, 0] }, 200, 0] },
                // ⚡️ PREMIUM BOOST: +2000 points if Identity is Locked
                { $cond: [{ $and: [{ $ne: ["$nameLockedUntil", null] }, { $gt: ["$nameLockedUntil", now] }] }, 2000, 0] }
            ];

            const clanScoring = [
                { $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$name", ""] } }, query] }, 0] }, 1000, 0] },
                { $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$tag", ""] } }, query] }, 0] }, 800, 0] },
                { $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$description", ""] } }, query] }, 0] }, 100, 0] },
                // ⚡️ PREMIUM BOOST: +2000 points if Identity is Locked
                { $cond: [{ $and: [{ $ne: ["$nameLockedUntil", null] }, { $gt: ["$nameLockedUntil", now] }] }, 2000, 0] }
            ];

            tokens.forEach(token => {
                const lowerToken = token.toLowerCase();
                postScoring.push({ $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$title", ""] } }, lowerToken] }, 0] }, 20, 0] });
                postScoring.push({ $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$message", ""] } }, lowerToken] }, 0] }, 2, 0] });
                userScoring.push({ $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$username", ""] } }, lowerToken] }, 0] }, 50, 0] });
                clanScoring.push({ $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$name", ""] } }, lowerToken] }, 0] }, 50, 0] });
            });

            const postsPipeline = [
                {
                    $match: {
                        status: "approved",
                        $or: [
                            { title: { $in: searchRegexes } },
                            { category: { $in: searchRegexes } },
                            { authorName: { $in: searchRegexes } },
                            { message: { $in: searchRegexes } }
                        ]
                    }
                },
                {
                    $addFields: {
                        lowerTitleArr: { $split: [{ $toLower: { $ifNull: ["$title", ""] } }, " "] },
                        lowerMessageArr: { $split: [{ $toLower: { $ifNull: ["$message", ""] } }, " "] }
                    }
                },
                {
                    $addFields: {
                        relevanceScore: {
                            $add: [
                                ...postScoring,
                                { $multiply: [{ $size: { $setIntersection: ["$lowerTitleArr", lowerTokens] } }, 5] },
                                { $multiply: [{ $size: { $setIntersection: ["$lowerMessageArr", lowerTokens] } }, 1] }
                            ]
                        }
                    }
                },
                { $sort: { relevanceScore: -1, createdAt: -1 } },
                { $skip: skip },
                { $limit: limit }
            ];

            const usersPipeline = [
                {
                    $match: {
                        $or: [
                            { username: { $in: searchRegexes } },
                            { clanName: { $in: searchRegexes } }
                        ]
                    }
                },
                { $addFields: { relevanceScore: { $add: userScoring } } },
                { $sort: { relevanceScore: -1 } },
                { $limit: 5 },
                {
                    // ⚡️ ADDED: Ensure nameLockedUntil passes through the project phase
                    $project: {
                        username: 1, profilePic: 1, weeklyAura: 1, lastStreak: 1,
                        previousRank: 1, peakLevel: 1, description: 1,
                        currentRankLevel: 1, aura: 1, relevanceScore: 1, nameLockedUntil: 1
                    }
                }
            ];

            const clansPipeline = [
                {
                    $match: {
                        $or: [
                            { name: { $in: searchRegexes } },
                            { tag: { $in: searchRegexes } }
                        ]
                    }
                },
                { $addFields: { relevanceScore: { $add: clanScoring } } },
                { $sort: { relevanceScore: -1, totalPoints: -1 } },
                { $limit: 5 },
                {
                    // ⚡️ ADDED: Ensure locks and verification pass through the project phase
                    $project: {
                        name: 1, tag: 1, description: 1, currentWeeklyPoints: 1,
                        members: 1, rank: 1, isInWar: 1, isRecruiting: 1,
                        followerCount: 1, badges: 1, relevanceScore: 1, 
                        nameLockedUntil: 1, verifiedUntil: 1
                    }
                }
            ];

            const [foundUsers, foundClans, foundPosts, count] = await Promise.all([
                MobileUser.aggregate(usersPipeline),
                Clan.aggregate(clansPipeline),
                Post.aggregate(postsPipeline),
                Post.countDocuments({
                    status: "approved",
                    $or: [
                        { title: { $in: searchRegexes } },
                        { category: { $in: searchRegexes } },
                        { authorName: { $in: searchRegexes } },
                        { message: { $in: searchRegexes } }
                    ]
                })
            ]);

            users = foundUsers;
            clans = foundClans;
            posts = foundPosts;
            totalPosts = count;
        }

        // ==========================================
        // 📊 POST BULK POPULATION GRAPH METRICS
        // ==========================================
        let userMap = {};
        let clanMap = {};

        try {
            const uniqueAuthorIds = [...new Set(posts.map(p => (p.authorUserId || p.authorId)?.toString()).filter(Boolean))];
            const uniqueClanTags = [...new Set(posts.map(p => (p.clanTag || p.clanId)?.toString()).filter(Boolean))];

            if (uniqueAuthorIds.length > 0) {
                const usersProfileData = await MobileUser.find({ _id: { $in: uniqueAuthorIds } }).lean();
                usersProfileData.forEach(u => {
                    const userIdStr = u._id.toString();
                    const rankInfo = typeof resolveUserRankServer === 'function' ? resolveUserRankServer(u.currentRankLevel || 1) : { rankName: "Rookie" };
                    const auraInfo = typeof getAuraVisualsServer === 'function' ? getAuraVisualsServer(u.previousRank || 0) : null;
                    const inv = Array.isArray(u.inventory) ? u.inventory : (Array.isArray(u.specialInventory) ? u.specialInventory : []);

                    userMap[userIdStr] = {
                        name: u.username,
                        image: u.profilePic?.url || null,
                        streak: u.lastStreak || 0,
                        rank: u.previousRank || 0,
                        peakLevel: u.peakLevel || 0,
                        inventory: inv,
                        rankLevel: u.currentRankLevel || 1,
                        aura: u.aura || 0,
                        displayRank: rankInfo.rankName,
                        auraVisuals: auraInfo,
                        equippedGlow: inv.find(i => (i.category === 'GLOW' || i.category === 'NAME_GLOW') && i.isEquipped) || null,
                        equippedBadges: inv.filter(i => i.category === 'BADGE' && i.isEquipped).slice(0, 3) || [],
                        equippedTitle: u.equippedTitle || null,
                        nameLockedUntil: u.nameLockedUntil || null
                    };
                });
            }

            if (uniqueClanTags.length > 0) {
                const clansData = await Clan.find({
                    $or: [
                        { tag: { $in: uniqueClanTags } },
                        { _id: { $in: uniqueClanTags.filter(id => id.length === 24) } }
                    ]
                }).lean();
                clansData.forEach(c => {
                    const enrichedClan = {
                        ...c,
                        displayRank: typeof resolveClanDisplayRank === 'function' ? resolveClanDisplayRank(c.totalPoints || 0) : "Rank 1"
                    };
                    if (c.tag) clanMap[c.tag] = enrichedClan;
                    if (c._id) clanMap[c._id.toString()] = enrichedClan;
                });
            }
        } catch (popErr) {
            console.error("Search Populate Core Error:", popErr);
        }

        const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));

        // Processing Raw Arrays back down to serial outputs safely
        const processedUsers = await Promise.all(users.map(async (u) => {
            const count = await Post.countDocuments({ authorName: u.username, status: "approved" });
            const inv = Array.isArray(u.inventory) ? u.inventory : (Array.isArray(u.specialInventory) ? u.specialInventory : []);
            return {
                ...u,
                _id: u._id.toString(),
                postsCount: count,
                inventory: inv,
                nameLockedUntil: u.nameLockedUntil || null
            };
        }));

        const processedClans = clans.map(clan => ({
            ...clan,
            _id: clan._id.toString(),
            memberCount: clan.members?.length || 0,
            nameLockedUntil: clan.nameLockedUntil || null,
            verifiedUntil: clan.verifiedUntil || null
        }));

        const processedPosts = posts.map(p => {
            const aId = (p.authorUserId || p.authorId)?.toString();
            const cTag = (p.clanTag || p.clanId)?.toString();

            const finalHypeCount = p.hypePointsCount ?? (Array.isArray(p.hypePoints) ? p.hypePoints.length : (p.hypePoints || 0));
            const isTrending = finalHypeCount >= TRENDING_THRESHOLD;
            const isBoosted = Boolean(p.boostedUntil && new Date(p.boostedUntil).getTime() > Date.now());
            const isResurrected = Boolean(p.resurrectedAt && new Date(p.resurrectedAt) > fortyEightHoursAgo);

            // Structure Media arrays cleanly for the frontend cards
            let finalMediaArray = [];
            if (p.media && Array.isArray(p.media) && p.media.length > 0) finalMediaArray = p.media;
            else if (p.mediaUrl) finalMediaArray = [{ url: p.mediaUrl, type: p.mediaType || "image" }];

            return {
                ...p,
                _id: p._id.toString(),
                likesCount: p.likes?.length || 0,
                commentsCount: p.comments?.length || 0,
                sharesCount: p.shares || 0,
                viewsCount: p.views || 0,
                hypePoints: finalHypeCount,
                media: finalMediaArray,
                isTrending,
                isBoosted,
                isResurrected,
                authorData: userMap[aId] || null,
                clanData: clanMap[cTag] || null
            };
        });

        return NextResponse.json(
            {
                success: true,
                players: processedUsers,
                clans: processedClans,
                posts: processedPosts,
                isIntentResult: isIntentSearch,
                pagination: {
                    total: totalPosts,
                    currentPage: page,
                    totalPages: Math.ceil(totalPosts / limit),
                    hasNextPage: isIntentSearch ? false : (skip + limit < totalPosts)
                }
            },
            {
                status: 200,
                headers: {
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET, OPTIONS",
                    "Access-Control-Allow-Headers": "Content-Type, x-oreblogda-secret",
                }
            }
        );

    } catch (error) {
        console.error("⛔ SEARCH_SYSTEM_ERROR:", error);
        return NextResponse.json({ success: false, message: "Neural link timeout" }, { status: 500 });
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, {
        status: 200,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, x-oreblogda-secret",
        },
    });
}
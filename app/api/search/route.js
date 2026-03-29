import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import MobileUser from "@/app/models/MobileUserModel";
import Clan from "@/app/models/ClanModel"; 

// ⚡️ HELPER: Escapes special characters so searches like "[Awakening]" don't crash the database regex
const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * SMART SEARCH ENGINE v3.8 - OMNI-WEIGHTING
 * Features:
 * 1. Intent Detection
 * 2. Phrase Matching via $indexOfCP (Applied to Posts, Users, and Clans)
 * 3. Token Weighting
 */
export async function GET(req) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const rawQuery = searchParams.get("q")?.trim();
        const query = rawQuery?.toLowerCase(); 
        const page = parseInt(searchParams.get("page")) || 1;
        const limit = parseInt(searchParams.get("limit")) || 10;
        const skip = (page - 1) * limit;

        if (!rawQuery || rawQuery.length < 2) {
            return NextResponse.json({ success: false, message: "Input required" }, { status: 400 });
        }

        let users = [];
        let clans = [];
        let posts = [];
        let totalPosts = 0;
        let isIntentSearch = false;

        // ==========================================
        // 🧠 LAYER 1: INTENT DETECTION
        // ==========================================

        if (['clan', 'clans', 'guild', 'alliance', 'top clan', 'squad'].some(k => query.includes(k))) {
            isIntentSearch = true;
            clans = await Clan.find({})
                .sort({ currentWeeklyPoints: -1, level: -1 })
                .limit(10)
                .select("name tag description currentWeeklyPoints members rank isInWar isRecruiting followerCount badges")
                .lean();
            
            users = [];
            posts = [];
        }
        else if (['aura', 'best author', 'top author', 'ranking', 'elite', 'leaderboard'].some(k => query.includes(k))) {
            isIntentSearch = true;
            users = await MobileUser.find({})
                .sort({ previousRank: 1, weeklyAura: -1 }) 
                .limit(15) 
                .select("username profilePic weeklyAura lastStreak previousRank peakLevel description currentRankLevel aura")
                .lean();

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
                { $limit: limit },
                { $project: { title: 1, message: 1, category: 1, mediaUrl: 1, authorName: 1, authorId: 1, createdAt: 1, likes: 1, comments: 1, shares: 1, views: 1 } }
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
                { $limit: limit },
                { $project: { title: 1, message: 1, category: 1, mediaUrl: 1, authorName: 1, authorId: 1, createdAt: 1, likes: 1, comments: 1, shares: 1, views: 1 } }
            ];
            posts = await Post.aggregate(pipeline);
            totalPosts = await Post.countDocuments({ status: "approved" });
        }

        // ==========================================
        // 🧠 LAYER 2: STANDARD NEURAL SEARCH WITH WEIGHTS
        // ==========================================
        
        if (!isIntentSearch) {
            const tokens = rawQuery.split(/\s+/).filter(t => t.length > 1);
            
            // --- FUZZY NUMERIC LOGIC ---
            const extendedTokens = [...tokens];
            tokens.forEach(token => {
                if (/^\d{4}$/.test(token)) {
                    const year = parseInt(token);
                    extendedTokens.push((year - 1).toString());
                    extendedTokens.push((year + 1).toString());
                }
            });

            // Escape tokens for safely injecting into MongoDB Regex
            const searchRegexes = extendedTokens.map(t => new RegExp(escapeRegex(t), "i"));
            const lowerTokens = extendedTokens.map(t => t.toLowerCase());

            // ⚡️ BUILD POST SCORING ARRAY
            const postScoring = [
                { $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$title", ""] } }, query] }, 0] }, 1000, 0] },
                { $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$message", ""] } }, query] }, 0] }, 500, 0] }
            ];
            
            // ⚡️ BUILD USER SCORING ARRAY
            const userScoring = [
                { $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$username", ""] } }, query] }, 0] }, 1000, 0] },
                { $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$clanName", ""] } }, query] }, 0] }, 200, 0] }
            ];

            // ⚡️ BUILD CLAN SCORING ARRAY
            const clanScoring = [
                { $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$name", ""] } }, query] }, 0] }, 1000, 0] },
                { $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$tag", ""] } }, query] }, 0] }, 800, 0] },
                { $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$description", ""] } }, query] }, 0] }, 100, 0] }
            ];

            // Add points for individual word hits
            tokens.forEach(token => {
                const lowerToken = token.toLowerCase();
                
                // For Posts
                postScoring.push({ $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$title", ""] } }, lowerToken] }, 0] }, 20, 0] });
                postScoring.push({ $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$message", ""] } }, lowerToken] }, 0] }, 2, 0] });
                
                // For Users
                userScoring.push({ $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$username", ""] } }, lowerToken] }, 0] }, 50, 0] });

                // For Clans
                clanScoring.push({ $cond: [{ $gte: [{ $indexOfCP: [{ $toLower: { $ifNull: ["$name", ""] } }, lowerToken] }, 0] }, 50, 0] });
            });

            // ⚡️ THE 3 AGGREGATION PIPELINES

            // 1. Post Pipeline
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
                { $limit: limit },
                {
                    $project: {
                        title: 1, message: 1, category: 1, mediaUrl: 1, 
                        authorName: 1, authorId: 1, createdAt: 1, 
                        likes: 1, comments: 1, shares: 1, views: 1,
                        relevanceScore: 1 
                    }
                }
            ];

            // 2. User Pipeline
            const usersPipeline = [
                {
                    $match: {
                        $or: [
                            { username: { $in: searchRegexes } },
                            { clanName: { $in: searchRegexes } }
                        ]
                    }
                },
                {
                    $addFields: {
                        relevanceScore: { $add: userScoring }
                    }
                },
                { $sort: { relevanceScore: -1 } },
                { $limit: 5 },
                {
                    $project: {
                        username: 1, profilePic: 1, weeklyAura: 1, lastStreak: 1, 
                        previousRank: 1, peakLevel: 1, description: 1, 
                        currentRankLevel: 1, aura: 1, relevanceScore: 1
                    }
                }
            ];

            // 3. Clan Pipeline
            const clansPipeline = [
                {
                    $match: {
                        $or: [
                            { name: { $in: searchRegexes } },
                            { tag: { $in: searchRegexes } }
                        ]
                    }
                },
                {
                    $addFields: {
                        relevanceScore: { $add: clanScoring }
                    }
                },
                { $sort: { relevanceScore: -1, currentWeeklyPoints: -1 } },
                { $limit: 5 },
                {
                    $project: {
                        name: 1, tag: 1, description: 1, currentWeeklyPoints: 1, 
                        members: 1, rank: 1, isInWar: 1, isRecruiting: 1, 
                        followerCount: 1, badges: 1, relevanceScore: 1
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
        // 📊 POST PROCESSING
        // ==========================================

        const usersWithCounts = await Promise.all(users.map(async (user) => {
            const count = await Post.countDocuments({ 
                authorName: user.username, 
                status: "approved" 
            });
            // Aggregation returns _id as ObjectId, map needs string representation
            return { ...user, _id: user._id.toString(), postsCount: count };
        }));

        const processedClans = clans.map(clan => ({
            ...clan,
            _id: clan._id.toString(),
            memberCount: clan.members?.length || 0,
            members: undefined 
        }));

        const processedPosts = posts.map(post => ({
            ...post,
            _id: post._id.toString(),
            likesCount: post.likes?.length || 0,
            commentsCount: post.comments?.length || 0,
            sharesCount: post.shares || 0,
            viewsCount: post.views || 0,
            message: post.message ? post.message.substring(0, 100) + "..." : "", 
            likes: undefined,
            comments: undefined
        }));

        return NextResponse.json(
            {
                success: true,
                users: usersWithCounts || [],
                clans: processedClans || [], 
                posts: processedPosts || [],
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
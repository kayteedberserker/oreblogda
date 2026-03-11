import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import MobileUser from "@/app/models/MobileUserModel";
import Clan from "@/app/models/ClanModel"; 

/**
 * SMART SEARCH ENGINE v3.5 - CLAN UPDATE
 * Features:
 * 1. Intent Detection (Keywords triggers specific sorting/filtering)
 * 2. Neural Scoring (Weighted text relevance)
 * 3. Fuzzy Numeric Matching (Years)
 * 4. Clan/Guild Discovery
 */
export async function GET(req) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const rawQuery = searchParams.get("q")?.trim();
        const query = rawQuery?.toLowerCase(); // Normalize for keyword checking
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
        // Check if user is asking for specific logic
        // ==========================================

        // INTENT: CLAN LEADERBOARDS ("Top Clan", "Guilds")
        if (['clan', 'clans', 'guild', 'alliance', 'top clan', 'squad'].some(k => query.includes(k))) {
            isIntentSearch = true;
            clans = await Clan.find({})
                .sort({ currentWeeklyPoints: -1, level: -1 })
                .limit(10)
                // Updated selection to match new Schema and UI requirements
                .select("name tag description currentWeeklyPoints members rank isInWar isRecruiting followerCount badges")
                .lean();
            
            // Empty posts/users for focused intent
            users = [];
            posts = [];
        }

        // INTENT: AUTHOR LEADERBOARDS ("Aura", "Best Author", "Top Rank")
        else if (['aura', 'best author', 'top author', 'ranking', 'elite', 'leaderboard'].some(k => query.includes(k))) {
            isIntentSearch = true;
            
            users = await MobileUser.find({})
                .sort({ previousRank: 1, weeklyAura: -1 }) 
                .limit(15) 
                .select("username profilePic weeklyAura lastStreak previousRank description")
                .lean();

            posts = []; 
            totalPosts = 0;
        }

        // INTENT: MOST LIKED / VIRAL ("Most Liked", "Viral", "Best Post")
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

        // INTENT: HOT DISCUSSIONS ("Discussion", "Debate", "Trending", "Hot")
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
        // 🧠 LAYER 2: STANDARD NEURAL SEARCH
        // Fallback if no specific intent is found
        // ==========================================
        
        if (!isIntentSearch) {
            // Split query into words: "Winter 2026" -> ["Winter", "2026"]
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

            const searchRegexes = extendedTokens.map(t => new RegExp(t, "i"));

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
                        relevanceScore: {
                            $add: [
                                // Higher weight for exact title match
                                { $cond: [{ $regexMatch: { input: "$title", regex: new RegExp(rawQuery, "i") } }, 10, 0] },
                                // Weight for word matches in title
                                { $multiply: [{ $size: { $setIntersection: [ { $split: ["$title", " "] }, extendedTokens ] } }, 5] },
                                // Lower weight for message match
                                { $cond: [{ $regexMatch: { input: "$message", regex: new RegExp(rawQuery, "i") } }, 2, 0] }
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
                        likes: 1, comments: 1, shares: 1, views: 1
                    }
                }
            ];

            const [foundUsers, foundClans, foundPosts, count] = await Promise.all([
                // 1. STANDARD AUTHOR SEARCH
                MobileUser.find({
                    $or: [
                        { username: { $in: searchRegexes } },
                        { clanName: { $in: searchRegexes } }
                    ]
                })
                .select("username profilePic weeklyAura lastStreak previousRank peakLevel description")
                .limit(5)
                .lean(),

                // 2. CLAN SEARCH (Updated for new Schema)
                Clan.find({
                    $or: [
                        { name: { $in: searchRegexes } },
                        { tag: { $in: searchRegexes } }
                    ]
                })
                .select("name tag description currentWeeklyPoints members rank isInWar isRecruiting followerCount badges")
                .limit(5)
                .lean(),

                // 3. SMART POST SEARCH
                Post.aggregate(postsPipeline),

                // 4. COUNT
                Post.countDocuments({
                    status: "approved",
                    $or: [
                        { title: { $in: searchRegexes } },
                        { category: { $in: searchRegexes } }
                    ]
                })
            ]);

            users = foundUsers;
            clans = foundClans;
            posts = foundPosts;
            totalPosts = count;
        }

        // ==========================================
        // 📊 POST PROCESSING (Formatting & Counts)
        // ==========================================

        // Fetch Post Counts for Users
        const usersWithCounts = await Promise.all(users.map(async (user) => {
            const count = await Post.countDocuments({ 
                authorName: user.username, 
                status: "approved" 
            });
            return { ...user, postsCount: count };
        }));

        // Format Clans (Calculate Member Count from array)
        const processedClans = clans.map(clan => ({
            ...clan,
            memberCount: clan.members?.length || 0,
            members: undefined // Remove array from response to save bandwidth
        }));

        // Format Posts for Frontend
        const processedPosts = posts.map(post => ({
            ...post,
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
                clans: processedClans || [], // Return processed clans
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
import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import MobileUser from "@/app/models/MobileUserModel";

/**
 * SMART SEARCH ENGINE v2.5 - NEURAL SCORING
 * Features: Tokenization, Fuzzy Numeric Matching, Weighted Relevance
 */
export async function GET(req) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q")?.trim();
        const page = parseInt(searchParams.get("page")) || 1;
        const limit = parseInt(searchParams.get("limit")) || 10;
        const skip = (page - 1) * limit;

        if (!query || query.length < 2) {
            return NextResponse.json({ success: false, message: "Input required" }, { status: 400 });
        }

        // --- SMART TOKENIZATION ---
        // Split query into words: "Winter 2026" -> ["Winter", "2026"]
        const tokens = query.split(/\s+/).filter(t => t.length > 1);
        
        // --- FUZZY NUMERIC LOGIC ---
        // If searching a year like 2027, include 2026 in the search terms
        const extendedTokens = [...tokens];
        tokens.forEach(token => {
            if (/^\d{4}$/.test(token)) {
                const year = parseInt(token);
                extendedTokens.push((year - 1).toString());
                extendedTokens.push((year + 1).toString());
            }
        });

        const searchRegexes = extendedTokens.map(t => new RegExp(t, "i"));

        // --- AGGREGATION PIPELINE FOR POSTS (SCORING) ---
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
                            { $cond: [{ $regexMatch: { input: "$title", regex: new RegExp(query, "i") } }, 10, 0] },
                            // Weight for word matches in title
                            { $multiply: [{ $size: { $setIntersection: [ { $split: ["$title", " "] }, extendedTokens ] } }, 5] },
                            // Lower weight for message match
                            { $cond: [{ $regexMatch: { input: "$message", regex: new RegExp(query, "i") } }, 2, 0] }
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

        const [users, posts, totalPosts] = await Promise.all([
            // 1. AUTHOR SEARCH (Keep simple regex for users)
            MobileUser.find({
                $or: [
                    { username: { $in: searchRegexes } },
                    { clanName: { $in: searchRegexes } }
                ]
            })
            .select("username profilePic weeklyAura consecutiveStreak previousRank description")
            .limit(5)
            .lean(),

            // 2. SMART POST SEARCH (Using Pipeline)
            Post.aggregate(postsPipeline),

            // 3. COUNT FOR PAGINATION
            Post.countDocuments({
                status: "approved",
                $or: [
                    { title: { $in: searchRegexes } },
                    { category: { $in: searchRegexes } }
                ]
            })
        ]);

        // --- ENHANCEMENT: Fetch Post Counts for each User ---
        const usersWithCounts = await Promise.all(users.map(async (user) => {
            const count = await Post.countDocuments({ 
                authorName: user.username, 
                status: "approved" 
            });
            return { ...user, postsCount: count };
        }));

        // Process Posts for Mobile Analytics
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
                posts: processedPosts || [],
                pagination: {
                    total: totalPosts,
                    currentPage: page,
                    totalPages: Math.ceil(totalPosts / limit),
                    hasNextPage: skip + limit < totalPosts
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

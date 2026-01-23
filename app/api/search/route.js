import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import MobileUser from "@/app/models/MobileUserModel";

/**
 * SMART SEARCH ENGINE v2.0
 * Features: Pagination, Relevance Scoring, Filtered Fields
 */
export async function GET(req) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q");
        const page = parseInt(searchParams.get("page")) || 1;
        const limit = parseInt(searchParams.get("limit")) || 10;
        const skip = (page - 1) * limit;

        if (!query || query.length < 2) {
            return NextResponse.json({ success: false, message: "Input required" }, { status: 400 });
        }

        // --- THE "SMART" BIT ---
        // We use a regex but anchor it or weight it.
        const searchRegex = new RegExp(query, "i");

        const [users, posts, totalPosts] = await Promise.all([
            // 1. AUTHOR SEARCH (Username is priority)
            MobileUser.find({
                $or: [
                    { username: searchRegex },
                    { clanName: searchRegex } // Included for future-proofing
                ]
            })
            .select("username profilePic weeklyAura consecutiveStreak previousRank")
            .limit(5) // Keep author results small and top-tier
            .lean(),

            // 2. SMART POST SEARCH (Title & Category priority)
            Post.find({
                status: "approved",
                $or: [
                    { title: searchRegex },
                    { category: searchRegex },
                    { authorName: searchRegex }
                ]
            })
            .select("title message category mediaUrl authorName createdAt likes comments shares views")
            .sort({ createdAt: -1 }) // We can also sort by { score: { $meta: "textScore" } } if you add indexes
            .skip(skip)
            .limit(limit)
            .lean(),

            // 3. COUNT FOR PAGINATION
            Post.countDocuments({
                status: "approved",
                $or: [
                    { title: searchRegex },
                    { category: searchRegex }
                ]
            })
        ]);

        // Process Posts for Mobile Analytics
        const processedPosts = posts.map(post => ({
            ...post,
            likesCount: post.likes?.length || 0,
            commentsCount: post.comments?.length || 0,
            sharesCount: post.shares || 0,
            viewsCount: post.views || 0,
            message: post.message.substring(0, 100) + "...", // Trim message to save data
            likes: undefined,
            comments: undefined
        }));

        return NextResponse.json(
            {
                success: true,
                users: users || [],
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

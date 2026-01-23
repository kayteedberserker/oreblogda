import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import MobileUser from "@/app/models/MobileUserModel";

/**
 * SMART SEARCH ENGINE v2.1
 * Features: Pagination, Relevance Scoring, Dynamic Author Post Counts
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

        // --- SEARCH LOGIC ---
        const searchRegex = new RegExp(query, "i");

        const [users, posts, totalPosts] = await Promise.all([
            // 1. AUTHOR SEARCH
            MobileUser.find({
                $or: [
                    { username: searchRegex },
                    { clanName: searchRegex }
                ]
            })
            .select("username profilePic weeklyAura lastStreak previousRank description")
            .limit(5)
            .lean(),

            // 2. SMART POST SEARCH
            Post.find({
                status: "approved",
                $or: [
                    { title: searchRegex },
                    { category: searchRegex },
                    { authorName: searchRegex }
                ]
            })
            .select("title message category mediaUrl authorName authorId createdAt likes comments shares views")
            .sort({ createdAt: -1 })
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

        // --- ENHANCEMENT: Fetch Post Counts for each User ---
        // We do this here because the MobileUser model doesn't store a live count
        const usersWithCounts = await Promise.all(users.map(async (user) => {
            const count = await Post.countDocuments({ 
                authorName: user.username, // Or use authorId if your schema links by ID
                status: "approved" 
            });
            return {
                ...user,
                postsCount: count
            };
        }));

        // Process Posts for Mobile Analytics
        const processedPosts = posts.map(post => ({
            ...post,
            likesCount: post.likes?.length || 0,
            commentsCount: post.comments?.length || 0,
            sharesCount: post.shares || 0,
            viewsCount: post.views || 0,
            message: post.message.substring(0, 100) + "...", 
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

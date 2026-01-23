import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";// Ensure this points to your DB connection utility
import Post from "@/app/models/PostModel";
import MobileUser from "@/app/models/MobileUserModel";

export async function GET(req) {
    try {
        await connectDB();

        // 1. Get query from URL
        const { searchParams } = new URL(req.url);
        const query = searchParams.get("q");

        if (!query || query.length < 2) {
            return NextResponse.json(
                { success: false, message: "Query too short" },
                { status: 400 }
            );
        }

        // 2. Create a case-insensitive regex
        const searchRegex = new RegExp(query, "i");

        // 3. Execute Search across both collections in parallel
        const [users, posts] = await Promise.all([
            // Search Users: by username, description, or clan name
            MobileUser.find({
                $or: [
                    { username: searchRegex },
                    { description: searchRegex },
                    { clanName: searchRegex }, // Ready for when you add clans
                ],
            })
            .select("username profilePic aura streak previousRank postsCount description")
            .limit(10)
            .lean(),

            // Search Posts: by title, message, or category
            Post.find({
                $or: [
                    { title: searchRegex },
                    { message: searchRegex },
                    { category: searchRegex },
                    { authorName: searchRegex }, // Search by author name inside post
                ],
            })
            .select("title message category mediaUrl authorName createdAt")
            .sort({ createdAt: -1 }) // Show newest intel first
            .limit(15)
            .lean(),
        ]);

        // 4. Return combined results
        return NextResponse.json(
            {
                success: true,
                users,
                posts,
                totalResults: users.length + posts.length,
                timestamp: new Date().toISOString()
            },
            { 
                status: 200,
                headers: {
                    // CORS headers if your mobile app hits this directly
                    "Access-Control-Allow-Origin": "*",
                    "Access-Control-Allow-Methods": "GET",
                }
            }
        );

    } catch (error) {
        console.error("⛔ SEARCH_CORE_FAILURE:", error);
        return NextResponse.json(
            { success: false, message: "Neural link interrupted." },
            { status: 500 }
        );
    }
}


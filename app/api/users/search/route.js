import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

export async function GET(req) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const query = searchParams.get("query");

        const userCountry = req.headers.get("x-user-country") || "Unknown";
        const senderDeviceId = req.headers.get("x-user-deviceId");

        if (!query || query.length < 3) {
            return NextResponse.json({ success: false, users: [] });
        }

        const users = await MobileUser.aggregate([
            {
                $match: {
                    username: { $regex: query, $options: "i" },
                    deviceId: { $ne: senderDeviceId }
                }
            },
            {
                $addFields: {
                    isSameCountry: {
                        $cond: { if: { $eq: ["$country", userCountry] }, then: 1, else: 0 }
                    }
                }
            },
            { $sort: { isSameCountry: -1, username: 1 } },
            { $limit: 15 },
            {
                $project: {
                    username: 1,
                    profilePic: 1, // 🔹 Returns the whole object { url: '...' }
                    country: 1,
                    _id: 1
                }
            }
        ])
        return NextResponse.json({ success: true, users });

    } catch (error) {
        console.error("Search API Error:", error);
        return NextResponse.json({ success: false, message: "Search failed" }, { status: 500 });
    }
}
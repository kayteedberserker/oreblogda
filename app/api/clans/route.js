import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import ClanFollower from "@/app/models/ClanFollower";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";
export async function GET(req) {
    await connectDB();

    const { searchParams } = new URL(req.url);
    const fingerprint = searchParams.get("fingerprint");
    const search = searchParams.get("search") || "";
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 10;
    const skip = (page - 1) * limit;
    
    const userCountry = req.headers.get("x-user-country") || "Global";

    try {
        let userClanData = null;
        let followedClans = [];

        if (fingerprint) {
            const mUser = await MobileUser.findOne({ deviceId: fingerprint });
            if (mUser) {
                // Find clan where user is leader, viceLeader, or a member
                const clan = await Clan.findOne({ 
                    $or: [
                        { leader: mUser._id }, 
                        { viceLeader: mUser._id }, 
                        { members: mUser._id }
                    ] 
                }).select("tag name leader viceLeader");

                if (clan) {
                    // Determine role hierarchy
                    let userRole = "member";
                    if (clan.leader?.toString() === mUser._id.toString()) {
                        userRole = "leader";
                    } else if (clan.viceLeader?.toString() === mUser._id.toString()) {
                        userRole = "viceleader";
                    }

                    userClanData = {
                        tag: clan.tag,
                        name: clan.name,
                        role: userRole,
                        clanId: clan._id
                    };
                }

                const follows = await ClanFollower.find({ userId: mUser._id }).select("clanTag");
                followedClans = follows.map(f => f.clanTag);
            }
        }

        // --- 🔹 SEARCH & PAGINATION PIPELINE 🔹 ---
        const query = search 
            ? { name: { $regex: search, $options: "i" } } 
            : {};

        const aggregationPipeline = [
            { $match: query },
            // Step 1: Add helper fields for sorting and counts
            {
                $addFields: {
                    isLocal: { $cond: [{ $eq: ["$country", userCountry] }, 1, 0] },
                    canJoin: {
                        $cond: [
                            { 
                                $and: [
                                    { $eq: ["$isRecruiting", true] },
                                    { $lt: [{ $size: { $ifNull: ["$members", []] } }, "$maxSlots"] }
                                ]
                            }, 
                            1, 0
                        ]
                    },
                    recentActivity: {
                        $cond: [
                            { $gt: ["$lastActive", new Date(Date.now() - 48 * 60 * 60 * 1000)] },
                            1, 0
                        ]
                    },
                    memberCount: { $size: { $ifNull: ["$members", []] } },
                    badgeCount: { $size: { $ifNull: ["$badges", []] } }
                }
            },
            // Step 2: Global Leaderboard Rank Calculation (lbRank)
            { $sort: { currentWeeklyPoints: -1 } },
            {
                $group: {
                    _id: null,
                    docs: { $push: "$$ROOT" }
                }
            },
            {
                $unwind: {
                    path: "$docs",
                    includeArrayIndex: "rankIndex"
                }
            },
            {
                $addFields: {
                    "docs.lbRank": { $add: ["$rankIndex", 1] }
                }
            },
            { $replaceRoot: { newRoot: "$docs" } },
            // Step 3: Final Priority Sorting
            {
                $sort: {
                    isLocal: -1,
                    currentWeeklyPoints: -1,
                    totalPoints: -1
                }
            },
            { $skip: skip },
            { $limit: limit },
            {
                $project: {
                    name: 1,
                    tag: 1,
                    logo: 1,
                    description: 1,
                    badges: 1,
                    isRecruiting: 1,
                    followerCount: 1,
                    maxSlots: 1,
                    memberCount: 1,
                    country: 1,
                    totalPoints: 1,
                    currentWeeklyPoints: 1,
                    badgeCount: 1,
                    // The stored rank from the database
                    rank: 1, 
                    // The dynamically calculated rank for this specific list/week
                    lbRank: 1 
                }
            }
        ];

        const [clans, totalClans] = await Promise.all([
            Clan.aggregate(aggregationPipeline),
            Clan.countDocuments(query)
        ]);
        
        const formattedClans = clans.map(clan => ({
            ...clan,
            isFollowing: followedClans.includes(clan.tag)
        }));

        return NextResponse.json({
            userInClan: !!userClanData,
            userClan: userClanData,
            clans: formattedClans,
            total: totalClans,
            currentPage: page,
            hasMore: totalClans > skip + clans.length,
            detectedCountry: userCountry
        }, { status: 200 });

    } catch (err) {
        console.error("Clan List Fetch Error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}

// DELETE remains the same
export async function DELETE(req, { params }) {
    await connectDB();
    const { tag } = await params;
    const { leaderId } = await req.json();

    const clan = await Clan.findOne({ tag });
    if (!clan || clan.leader.toString() !== leaderId) {
        return NextResponse.json({ message: "Unauthorized" }, { status: 403 });
    }

    await Clan.deleteOne({ tag });
    return NextResponse.json({ message: "Clan disbanded." });
}
import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import ReferralEvent from "@/app/models/ReferralEvent";
import MobileUser from "@/app/models/MobileUserModel";

// GET /api/referrals/stats
export async function GET(req) {
    try {
        await connectDB();

        // 1. Determine the current active round
        // You can store this in a 'GlobalSettings' collection or hardcode it for now
        const ACTIVE_ROUND = 1; 

        const leaderboard = await ReferralEvent.aggregate([
            { $match: { round: ACTIVE_ROUND } }, // 👈 Only count current round!
            {
                $group: {
                    _id: "$referrerId",
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            { $limit: 20 },
            {
                $lookup: {
                    from: "mobileusers",
                    localField: "_id",
                    foreignField: "_id",
                    as: "user"
                }
            },
            { $unwind: "$user" },
            {
                $project: {
                    username: "$user.username",
                    profilePic: "$user.profilePic.url",
                    count: 1
                }
            }
        ]);

        const roundTotal = await ReferralEvent.countDocuments({ round: ACTIVE_ROUND });

        // Define dynamic milestone based on round
        let currentMilestone = { goal: 500, reward: "$10", winners: 1 };
        if (ACTIVE_ROUND === 2) currentMilestone = { goal: 1000, reward: "$50", winners: 3 };
        if (ACTIVE_ROUND === 3) currentMilestone = { goal: 3000, reward: "$100", winners: 3 };

        return NextResponse.json({
            success: true,
            round: ACTIVE_ROUND,
            roundTotal,
            leaderboard,
            currentMilestone,
            progress: (roundTotal / currentMilestone.goal) * 100
        });

    } catch (err) {
        return NextResponse.json({ success: false, error: err.message });
    }
}
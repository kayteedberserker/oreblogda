import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollower";
import Clan from "@/app/models/ClanModel";
import ClanTopup from "@/app/models/ClanTopup";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

export async function GET(request) {
    try {
        await connectDB();

        const { searchParams } = new URL(request.url);
        const leaderId = searchParams.get("leaderId");
        let clanTag = searchParams.get("clanTag");

        // ⚡️ Parse bounds tracking pagination configuration safely
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "20", 10);
        const skip = (page - 1) * limit;

        if (!leaderId) {
            return NextResponse.json({ message: "Missing required parameter: leaderId" }, { status: 400 });
        }

        const leader = await MobileUser.findById(leaderId);
        if (!leader) {
            return NextResponse.json({ message: "Clan leader account not found." }, { status: 404 });
        }

        if (!clanTag) {
            const activeClanDoc = await Clan.findOne({ leader: leader._id });
            clanTag = activeClanDoc?.tag || leader.username;
        }

        // Verify that the target clan is actually a valid, officially verified ledger network tier
        const activeClanVerification = await Clan.findOne({ tag: clanTag });
        const isVerified = activeClanVerification?.verifiedClan && activeClanVerification.primeLevel >= 2;

        // ⚡️ Extract dynamic collab settings directly from the Clan doc
        const collabType = activeClanVerification?.collabType || 'followers';
        const collabPercentage = activeClanVerification?.collabPercentage !== undefined
            ? activeClanVerification.collabPercentage
            : (collabType === 'referrals' ? 40 : 20);

        // ⚡️ Pull and aggregate real-time clan-specific topups
        const aggregatedTopups = await ClanTopup.aggregate([
            { $match: { clanTag: clanTag } },
            { $group: { _id: "$userId", totalClanTopups: { $sum: "$amount" } } }
        ]);

        // Build map dictionary for O(1) performance extraction
        const topupMap = {};
        aggregatedTopups.forEach(item => {
            if (item._id) topupMap[item._id.toString()] = item.totalClanTopups;
        });

        // ⚡️ Pagination boundaries count pipeline query execution
        const totalFollowersCount = await ClanFollower.countDocuments({ clanTag });

        // ⚡️ Applied Pagination limits to the find pipeline stream to prevent memory overflow
        const followers = await ClanFollower.find({ clanTag })
            .populate({
                path: "userId",
                model: MobileUser,
                select: "username country referredBy lastActive profilePic role description",
            })
            .skip(skip)
            .limit(limit)
            .lean();

        let globalTotalTopups = 0;
        let globalEligibleTopups = 0;

        const activeMembers = followers
            .filter((follower) => follower.userId !== null && follower.userId !== undefined)
            .map((follower) => {
                const profile = follower.userId;
                const profileIdString = profile._id.toString();

                const memberTopups = isVerified ? (topupMap[profileIdString] || 0) : 0;
                const isReferredByLeader = profile.referredBy === leader.referralCode;

                // Track total raw topups in the clan
                globalTotalTopups += memberTopups;

                // ⚡️ Track ONLY eligible topups based on the collab rules
                if (collabType === 'followers' || (collabType === 'referrals' && isReferredByLeader)) {
                    globalEligibleTopups += memberTopups;
                }

                return {
                    id: profile._id,
                    username: profile.username || "Anonymous Creator",
                    country: profile.country || "Unknown",
                    referredBy: profile.referredBy || null,
                    lastActive: profile.lastActive || follower.followedAt,
                    clanTopups: memberTopups,
                    profilePic: profile.profilePic || { url: "", public_id: "" },
                    role: profile.role || "Author",
                };
            });

        return NextResponse.json(
            {
                success: true,
                clanTag,
                leaderReferralCode: leader.referralCode || null,
                collabType,
                collabPercentage,
                members: activeMembers,
                metrics: {
                    globalTotalTopups,
                    globalEligibleTopups, // ⚡️ Passed to frontend to ensure top HUD math is strict
                    isClanVerified: isVerified
                },
                pagination: {
                    totalMembers: totalFollowersCount,
                    currentPage: page,
                    totalPages: Math.ceil(totalFollowersCount / limit) || 1
                }
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("[CLAN_API_ERROR]:", error);
        return NextResponse.json({ message: "Internal server error processing clan arrays." }, { status: 500 });
    }
}
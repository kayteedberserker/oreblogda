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

        let activeMembers = [];
        let totalCount = 0;
        let globalTotalTopups = 0;

        // 🚀 THE BRANCH: STRICTLY SEPARATE DATA SOURCES
        if (collabType === 'referrals') {
            const referralCode = leader.referralCode;

            if (!referralCode) {
                totalCount = 0;
            } else {
                // ⚡️ STRICT REFERRAL MODE: Completely ignore ClanFollower. Check MobileUser directly.
                totalCount = await MobileUser.countDocuments({ referredBy: referralCode });

                const referredUsers = await MobileUser.find({ referredBy: referralCode })
                    .select("username country referredBy lastActive profilePic role")
                    .skip(skip)
                    .limit(limit)
                    .lean();

                activeMembers = referredUsers.map((profile) => {
                    const profileIdString = profile._id.toString();
                    const memberTopups = isVerified ? (topupMap[profileIdString] || 0) : 0;

                    return {
                        id: profile._id,
                        username: profile.username || "Anonymous Creator",
                        country: profile.country || "Unknown",
                        referredBy: profile.referredBy || null,
                        lastActive: profile.lastActive,
                        clanTopups: memberTopups,
                        profilePic: profile.profilePic || { url: "", public_id: "" },
                        role: profile.role || "Author",
                    };
                });

                // Calculate global metrics for ALL referrals
                const allReferredIds = await MobileUser.find({ referredBy: referralCode }).select("_id").lean();
                let sum = 0;
                allReferredIds.forEach(user => {
                    sum += (topupMap[user._id.toString()] || 0);
                });
                globalTotalTopups = sum;
            }
        } else {
            // ⚡️ STRICT FOLLOWER MODE: Use ClanFollower table.
            totalCount = await ClanFollower.countDocuments({ clanTag });

            const followers = await ClanFollower.find({ clanTag })
                .populate({
                    path: "userId",
                    model: MobileUser,
                    select: "username country referredBy lastActive profilePic role description",
                })
                .skip(skip)
                .limit(limit)
                .lean();

            // Calculate global metrics for ALL clan followers
            const globalMetricsDoc = await ClanTopup.aggregate([
                { $match: { clanTag: clanTag } },
                { $group: { _id: null, overallSum: { $sum: "$amount" } } }
            ]);
            globalTotalTopups = isVerified ? (globalMetricsDoc[0]?.overallSum || 0) : 0;

            activeMembers = followers
                .filter((follower) => follower.userId !== null && follower.userId !== undefined)
                .map((follower) => {
                    const profile = follower.userId;
                    const profileIdString = profile._id.toString();
                    const memberTopups = isVerified ? (topupMap[profileIdString] || 0) : 0;

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
        }

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
                    globalEligibleTopups: globalTotalTopups, // Cleaned up: Everyone returned is now 100% eligible
                    isClanVerified: isVerified
                },
                pagination: {
                    totalMembers: totalCount,
                    currentPage: page,
                    totalPages: Math.ceil(totalCount / limit) || 1
                }
            },
            { status: 200 }
        );

    } catch (error) {
        console.error("[CLAN_API_ERROR]:", error);
        return NextResponse.json({ message: "Internal server error processing clan arrays." }, { status: 500 });
    }
}
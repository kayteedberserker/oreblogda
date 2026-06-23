import { NextResponse } from "next/server";
// Ensure mongoose is initialized and database connection is established
import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollower";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";

export async function GET(request) {
    try {
        await connectDB();

        // 1. Parse query parameters from request url
        const { searchParams } = new URL(request.url);
        const leaderId = searchParams.get("leaderId");
        let clanTag = searchParams.get("clanTag");

        if (!leaderId) {
            return NextResponse.json(
                { message: "Missing required parameter: leaderId" },
                { status: 400 }
            );
        }

        // 2. Fetch the leader's account to grab their referralCode and verify identity
        const leader = await MobileUser.findById(leaderId);
        if (!leader) {
            return NextResponse.json(
                { message: "Clan leader account not found." },
                { status: 404 }
            );
        }

        if (!clanTag) {
            clanTag = leader.username;
        }

        // 3. Fetch the actual Clan entity to pull dynamic Collab Rules
        const clan = await Clan.findOne({ tag: clanTag });
        const collabType = clan?.collabType || 'followers';
        const collabPercentage = clan?.collabPercentage !== undefined ? clan.collabPercentage : (collabType === 'referrals' ? 40 : 20);

        let activeMembers = [];

        // ⚡️ 4. DYNAMIC DATA FETCHING BASED ON COLLAB TYPE
        if (collabType === 'referrals') {
            // Fetch ALL users who used this leader's referral code, regardless of clan status
            if (leader.referralCode) {
                const referredUsers = await MobileUser.find({ referredBy: leader.referralCode })
                    .select("username country referredBy lastActive totalPurchasedCoins profilePic role")
                    .lean();

                activeMembers = referredUsers.map((profile) => ({
                    id: profile._id,
                    username: profile.username || "Anonymous Creator",
                    country: profile.country || "Unknown",
                    referredBy: profile.referredBy || null,
                    lastActive: profile.lastActive,
                    totalPurchasedCoins: profile.totalPurchasedCoins || 0,
                    profilePic: profile.profilePic || { url: "", public_id: "" },
                    role: profile.role || "Author",
                }));
            }
        } else {
            // Default: Fetch users currently following the Clan
            const followers = await ClanFollower.find({ clanTag })
                .populate({
                    path: "userId",
                    model: MobileUser,
                    select: "username country referredBy lastActive totalPurchasedCoins profilePic role",
                })
                .lean();

            activeMembers = followers
                .filter((follower) => follower.userId !== null && follower.userId !== undefined)
                .map((follower) => {
                    const profile = follower.userId;
                    return {
                        id: profile._id,
                        username: profile.username || "Anonymous Creator",
                        country: profile.country || "Unknown",
                        referredBy: profile.referredBy || null,
                        lastActive: profile.lastActive || follower.followedAt,
                        totalPurchasedCoins: profile.totalPurchasedCoins || 0,
                        profilePic: profile.profilePic || { url: "", public_id: "" },
                        role: profile.role || "Author",
                    };
                });
        }

        // 5. Return clean structured operational response to the dashboard
        return NextResponse.json(
            {
                success: true,
                clanTag,
                leaderReferralCode: leader.referralCode || null,
                collabType,
                collabPercentage,
                members: activeMembers,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("[CLAN_API_ERROR]:", error);
        return NextResponse.json(
            { message: "Internal server error occurred processing collab network." },
            { status: 500 }
        );
    }
}
import { NextResponse } from "next/server";
// Ensure mongoose is initialized and database connection is established
// Replace this with your actual database connection utility import if different
import connectDB from "@/app/lib/mongodb";
import ClanFollower from "app/models/ClanFollower"; // Adjust path as needed for your project
import MobileUser from "app/models/MobileUserModel";


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

        // If clanTag isn't explicitly passed, we can fall back to using the leader's username 
        // or a custom clan field if you add one later.
        if (!clanTag) {
            clanTag = leader.username;
        }

        // 3. Query the ClanFollower collection and populate the safe user profile fields
        // We explicitly only select fields that are NOT secret/sensitive.
        const followers = await ClanFollower.find({ clanTag })
            .populate({
                path: "userId",
                model: MobileUser,
                select: "username country referredBy lastActive totalPurchasedCoins profilePic corePreferences role description",
            })
            .lean();

        // 4. Transform and filter out any orphaned records where the user document might no longer exist
        const activeMembers = followers
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

        // 5. Return clean structured operational response to the dashboard
        return NextResponse.json(
            {
                success: true,
                clanTag,
                leaderReferralCode: leader.referralCode || null,
                members: activeMembers,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("[CLAN_API_ERROR]:", error);
        return NextResponse.json(
            { message: "Internal server error occurred processing clan arrays." },
            { status: 500 }
        );
    }
}
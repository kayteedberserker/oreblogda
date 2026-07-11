import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollower";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

// --- GET: Check Follow Status (Filters Blocked Clans) ---
export async function GET(req) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const clanTag = searchParams.get('clanTag')?.toUpperCase();
        const deviceId = searchParams.get('deviceId');

        if (!clanTag || !deviceId) {
            return NextResponse.json({ message: "Missing parameters" }, { status: 400 });
        }

        // 1. Find the user via deviceId
        const user = await MobileUser.findOne({ deviceId });
        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        // 2. Fetch the Clan to obtain its true database ObjectId (_id)
        const clan = await Clan.findOne({ tag: clanTag });
        if (!clan) {
            return NextResponse.json({ message: "Clan not found" }, { status: 404 });
        }

        // 🛡️ BLOCK CHECK: If the clan is blocked, exclude it from active follow status
        const isBlocked = user.blockedClans?.some(id => id.equals(clan._id));
        if (isBlocked) {
            return NextResponse.json({
                success: true,
                isFollowing: false,
                isBlocked: true // Optional: helpful flag for client UI customization
            });
        }

        // 3. Check if a normal follow record exists
        const followRecord = await ClanFollower.findOne({
            clanTag: clan.tag,
            userId: user._id
        });

        return NextResponse.json({
            success: true,
            isFollowing: !!followRecord
        });

    } catch (err) {
        console.error("Follow Status Check Error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}

// --- POST: Handle Follow/Unfollow Actions (Enforces Safety Constraints) ---
export async function POST(req) {
    await connectDB();
    const { clanTag, deviceId, action } = await req.json();

    try {
        if (!clanTag) {
            return NextResponse.json({ message: "Clan tag is required" }, { status: 400 });
        }

        // 1. Resolve the MongoDB ObjectId using the deviceId
        const user = await MobileUser.findOne({ deviceId });
        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        const userId = user._id;

        // 2. Fetch Clan details for role and constraint verification
        const clan = await Clan.findOne({ tag: clanTag.toUpperCase() });
        if (!clan) {
            return NextResponse.json({ message: "Clan not found" }, { status: 404 });
        }

        // ==========================================
        // ACTION: FOLLOW
        // ==========================================
        if (action === "follow") {
            // 🛡️ CONSTRAINT: Verify the target clan isn't currently blocked
            const isBlocked = user.blockedClans?.some(id => id.equals(clan._id));
            if (isBlocked) {
                return NextResponse.json({
                    message: "You have blocked this clan. Please unblock it from your profile settings first."
                }, { status: 403 });
            }

            // Check if already following to prevent duplicate index errors
            const existing = await ClanFollower.findOne({ clanTag: clan.tag, userId });
            if (existing) {
                return NextResponse.json({ message: "Already following this clan" }, { status: 419 });
            }

            // Create follower record
            await ClanFollower.create({ clanTag: clan.tag, userId });

            // Increment count on Clan document
            await Clan.findOneAndUpdate(
                { tag: clan.tag },
                { $inc: { followerCount: 1 } }
            );

            return NextResponse.json({ message: "Followed" });
        }

        // ==========================================
        // ACTION: UNFOLLOW
        // ==========================================
        else if (action === "unfollow") {
            // PROTECTION LOGIC: Check if user is an official member/leader
            const isLeader = clan.leader?.equals(userId);
            const isViceLeader = clan.viceLeader?.equals(userId);
            const isMember = clan.members?.some(id => id.equals(userId));

            if (isLeader || isViceLeader || isMember) {
                return NextResponse.json({
                    message: "Official roster members cannot unfollow their own clan. Leave the clan first."
                }, { status: 403 });
            }

            // Remove follower record from ClanFollower collection
            const deleted = await ClanFollower.findOneAndDelete({ clanTag: clan.tag, userId });

            // Decrement only if a record was actually deleted
            if (deleted) {
                await Clan.findOneAndUpdate(
                    { tag: clan.tag },
                    { $inc: { followerCount: -1 } }
                );
                return NextResponse.json({ message: "Unfollowed" });
            }

            return NextResponse.json({ message: "Not following this clan" }, { status: 400 });
        }

        return NextResponse.json({ message: "Invalid action" }, { status: 400 });

    } catch (err) {
        console.error("Follow/Unfollow Error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
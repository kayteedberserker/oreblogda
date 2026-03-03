import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import ClanFollower from "@/app/models/ClanFollower";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

// --- GET: Check Follow Status ---
export async function GET(req) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const clanTag = searchParams.get('clanTag')?.toUpperCase();
        const deviceId = searchParams.get('deviceId');

        if (!clanTag || !deviceId) {
            return NextResponse.json({ message: "Missing parameters" }, { status: 400 });
        }

        // Find the user via deviceId
        const user = await MobileUser.findOne({ deviceId });
        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        // Check if a follow record exists
        const followRecord = await ClanFollower.findOne({ 
            clanTag, 
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

// --- POST: Handle Follow/Unfollow Actions ---
export async function POST(req) {
    await connectDB();
    const { clanTag, deviceId, action } = await req.json();

    try {
        // 1. Resolve the MongoDB ObjectId using the deviceId
        const user = await MobileUser.findOne({ deviceId });
        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        const userId = user._id;

        // Fetch Clan details for role verification
        const clan = await Clan.findOne({ tag: clanTag.toUpperCase() });
        if (!clan) {
            return NextResponse.json({ message: "Clan not found" }, { status: 404 });
        }

        if (action === "follow") {
            // Check if already following to prevent index errors
            const existing = await ClanFollower.findOne({ clanTag: clan.tag, userId });
            if (existing) {
                return NextResponse.json({ message: "Already following this clan" }, { status: 419 });
            }

            // Create follower record
            await ClanFollower.create({ clanTag: clan.tag, userId });
            
            // Increment count on Clan
            await Clan.findOneAndUpdate(
                { tag: clan.tag }, 
                { $inc: { followerCount: 1 } }
            );
            
            return NextResponse.json({ message: "Followed" });
        } else if (action === "unfollow") {
            // 🔹 PROTECTION LOGIC: Check if user is an official member/leader
            const isLeader = clan.leader?.equals(userId);
            const isViceLeader = clan.viceLeader?.equals(userId);
            const isMember = clan.members?.some(id => id.equals(userId));

            if (isLeader || isViceLeader || isMember) {
                return NextResponse.json({ 
                    message: "Official members cannot unfollow their own clan. Leave the clan roster first." 
                }, { status: 403 });
            }

            // 1. Remove follower record from ClanFollower collection
            const deleted = await ClanFollower.findOneAndDelete({ clanTag: clan.tag, userId });
            
            // 2. Decrement only if a record was actually deleted
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
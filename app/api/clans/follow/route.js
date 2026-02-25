import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import ClanFollower from "@/app/models/ClanFollower";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

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
        console.log(clanTag) 
        const clan = await Clan.findOne({ tag: clanTag });
        if (!clan) {
            return NextResponse.json({ message: "Clan not found" }, { status: 404 });
        }

        if (action === "follow") {
            // Check if already following to prevent index errors
            const existing = await ClanFollower.findOne({ clanTag, userId });
            if (existing) {
                return NextResponse.json({ message: "Already following" }, { status: 419 });
            }

            // Create follower record
            await ClanFollower.create({ clanTag, userId });
            
            // Increment count on Clan
            await Clan.findOneAndUpdate(
                { tag: clanTag }, 
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
            const deleted = await ClanFollower.findOneAndDelete({ clanTag, userId });
            
            // 2. Decrement only if a record was actually deleted
            if (deleted) {
                await Clan.findOneAndUpdate(
                    { tag: clanTag }, 
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

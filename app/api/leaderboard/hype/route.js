import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import MonthlyHypeStat from "@/app/models/MonthlyHypeStat";
import mongoose from "mongoose"; // Needed to check for valid ObjectIds

// Ensure models are registered
import "@/app/models/MobileUserModel";
import "@/app/models/ClanModel";

export async function GET(req) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const type = searchParams.get("type") || "USER_GIVEN";
        const currentMonth = new Date().toISOString().slice(0, 7);

        const isClan = type === "CLAN_RECEIVED";

        // 1. Fetch the raw stats WITHOUT Mongoose `.populate()`
        const rawStats = await MonthlyHypeStat.find({ month: currentMonth, entityType: type })
            .sort({ score: -1 })
            .limit(50)
            .lean();

        // 2. Extract the entity IDs (some are ObjectIds, some are strings like "WRITERS-CLAN")
        const entityIds = rawStats.map(stat => stat.entityId);

        // Separate valid ObjectIds from plain strings
        const validObjectIds = entityIds.filter(id => mongoose.Types.ObjectId.isValid(id));
        const stringIds = entityIds.filter(id => !mongoose.Types.ObjectId.isValid(id));

        // 3. Manually fetch the related entities (Smart Lookup)
        let entitiesMap = {};

        if (isClan) {
            const Clan = mongoose.model("Clan");
            // Search for clans matching the exact ObjectId OR matching the Clan Tag / Name
            const clans = await Clan.find({
                $or: [
                    { _id: { $in: validObjectIds } },
                    { tag: { $in: stringIds } },
                    { name: { $in: stringIds } }
                ]
            }).select("name members rank tag").lean();

            // Map the results so we can attach them to the stats quickly
            clans.forEach(clan => {
                entitiesMap[clan._id.toString()] = clan;
                if (clan.tag) entitiesMap[clan.tag] = clan;
                if (clan.name) entitiesMap[clan.name] = clan;
            });
        } else {
            const MobileUser = mongoose.model("MobileUsers");
            // Search for users matching the exact ObjectId OR matching their username/uid
            const users = await MobileUser.find({
                $or: [
                    { _id: { $in: validObjectIds } },
                    { username: { $in: stringIds } },
                    { uid: { $in: stringIds } }
                ]
            }).select("username profilePic uid").lean();

            users.forEach(user => {
                entitiesMap[user._id.toString()] = user;
                if (user.username) entitiesMap[user.username] = user;
                if (user.uid) entitiesMap[user.uid] = user;
            });
        }

        // 4. Merge the stats and the entity data together for the frontend
        const formattedLeaderboard = rawStats.map(stat => {
            const entityIdString = stat.entityId?.toString();
            // Try to find the matching entity in our map
            const entity = entitiesMap[entityIdString] || {};

            if (isClan) {
                return {
                    _id: stat._id.toString(),
                    score: stat.score,
                    // If we couldn't find the clan in the DB, gracefully fallback to showing the string ID
                    name: entity.name || stat.entityId,
                    // 2. RETURN THE RANK (Defaulting to 1 if missing)
                    rank: entity.rank || 1,
                    tag: entity.tag || 1,
                    memberCount: entity.members ? entity.members.length : 0,
                };
            } else {
                return {
                    _id: stat._id.toString(),
                    score: stat.score,
                    name: entity.username || stat.entityId,
                    userId: entity._id.toString() || null,
                    avatar: entity.profilePic?.url || null,
                    clanTag: null,
                    megaHypesCount: 0,
                    positionsGained: 0
                };
            }
        });

        return NextResponse.json({ success: true, leaderboard: formattedLeaderboard });
    } catch (err) {
        console.error("Leaderboard API Error:", err);
        return NextResponse.json({
            error: "Failed to fetch leaderboard",
            details: err.message
        }, { status: 500 });
    }
}
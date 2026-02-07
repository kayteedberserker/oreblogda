import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

const getRankDetails = (points) => {
    // Exact thresholds from your handwritten notes
    if (points >= 300000) return { title: "The Akatsuki", next: 1000000, color: "#ef4444" }; // Red
    if (points >= 100000) return { title: "The Espada", next: 300000, color: "#e0f2fe" }; // White
    if (points >= 50000) return { title: "Phantom Troupe", next: 100000, color: "#a855f7" }; // Purple
    if (points >= 20000) return { title: "Upper Moon", next: 50000, color: "#60a5fa" }; // Blue
    if (points >= 5000) return { title: "Squad 13", next: 20000, color: "#10b981" }; // Green
    return { title: "Wandering Ronin", next: 5000, color: "#94a3b8" }; // Grey
};

export async function GET(req, { params }) {
    await connectDB();
    const _registerUser = MobileUser.modelName; 
    const { tag } = await params;
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get("deviceId");

    try {
        const clan = await Clan.findOne({ tag: tag.toUpperCase() })
            .populate({ path: "leader", model: MobileUser, select: "username profilePic" })
            .populate({ path: "viceLeader", model: MobileUser, select: "username profilePic" })
            .populate({ path: "members", model: MobileUser, select: "username profilePic lastActive" })
            .populate({ path: "joinRequests.userId", model: MobileUser, select: "username profilePic" });

        if (!clan) return NextResponse.json({ message: "Clan not found" }, { status: 404 });

        const user = deviceId ? await MobileUser.findOne({ deviceId }) : null;
        const rank = getRankDetails(clan.totalPoints || 0);

        const responseData = clan.toObject();
        const isAdmin = clan.leader?._id.toString() === user?._id.toString() || 
                        clan.viceLeader?._id.toString() === user?._id.toString();

        return NextResponse.json({
            ...responseData,
            rankTitle: rank.title,
            nextThreshold: rank.next,
            rankColor: rank.color,
            isAdmin,
            role: clan.leader?._id.toString() === user?._id.toString() ? "leader" : 
                  (clan.viceLeader?._id.toString() === user?._id.toString() ? "viceLeader" : "member")
        });
    } catch (err) {
        return NextResponse.json({ message: "Error", error: err.message }, { status: 500 });
    }
}

export async function PATCH(req, { params }) {
    await connectDB();
    const { tag } = await params;
    const { deviceId, action, payload } = await req.json();

    try {
        const user = await MobileUser.findOne({ deviceId });
        const clan = await Clan.findOne({ tag: tag.toUpperCase() });
        if (!clan || !user) return NextResponse.json({ message: "Not found" }, { status: 404 });

        const isAdmin = clan.leader.toString() === user._id.toString() || clan.viceLeader?.toString() === user._id.toString();
        if (!isAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

        if (action === "EDIT_CLAN") {
            clan.description = payload.description;
            clan.name = payload.name;
        }
        if (action === "TOGGLE_RECRUIT") clan.isRecruiting = !clan.isRecruiting;
        if (action === "APPROVE_MEMBER") {
            // Check if there is room before approving
            if (clan.members.length >= clan.maxSlots) {
                return NextResponse.json({ message: "Barracks are full. Upgrade in Treasury." }, { status: 400 });
            }
            clan.members.push(payload.userId);
            clan.joinRequests = clan.joinRequests.filter(r => r.userId.toString() !== payload.userId);
        }
        if (action === "KICK_MEMBER") {
            clan.members = clan.members.filter(m => m.toString() !== payload.userId);
        }

        // 🔹 NEW: Handle Purchases
        if (action === "BUY_SLOTS") {
            const cost = 1000;
            if (clan.spendablePoints < cost) {
                return NextResponse.json({ message: "Insufficient Clan Funds" }, { status: 400 });
            }
            if (clan.maxSlots >= 13) {
                return NextResponse.json({ message: "Barracks already at maximum capacity (13)" }, { status: 400 });
            }

            clan.spendablePoints -= cost;
            clan.maxSlots += 1;
        }

        await clan.save();
        return NextResponse.json({ success: true });
    } catch (err) {
        return NextResponse.json({ message: "Update failed" }, { status: 500 });
    }
}
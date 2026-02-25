import connectDB from "@/app/lib/mongodb";
import { sendPushNotification } from "@/app/lib/pushNotifications";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
    await connectDB();
    const { tag } = await params;
    const { deviceId, username } = await req.json();

    try {
        const user = await MobileUser.findOne({ deviceId });
        if (!user) {
            return NextResponse.json({ message: "User profile not found" }, { status: 404 });
        }

        const userId = user._id;

        // 1. CHECK TOTAL CLAN LIMIT: If in ANY clan (Leader OR Member), block joining
        const existingMembership = await Clan.findOne({ 
            $or: [{ leader: userId }, { members: userId }] 
        });

        if (existingMembership) {
            return NextResponse.json({ 
                message: `You are already in [${existingMembership.name}]. One cannot serve two masters.` 
            }, { status: 403 });
        }

        const targetClan = await Clan.findOne({ tag });
        if (!targetClan) {
            return NextResponse.json({ message: "Clan not found" }, { status: 404 });
        }

        // 2. Check if already requested
        const alreadyRequested = targetClan.joinRequests.some(r => r.userId.toString() === userId.toString());
        if (alreadyRequested) {
            return NextResponse.json({ message: "Request already pending" }, { status: 400 });
        }

        // 3. Check if recruitment is closed or full
        if (!targetClan.isRecruiting || targetClan.members.length >= targetClan.maxSlots) {
            return NextResponse.json({ message: "Recruitment is closed or clan is full" }, { status: 400 });
        }

        // 4. Add to joinRequests
        targetClan.joinRequests.push({ 
            userId, 
            username: username || user.username, 
            appliedAt: new Date() 
        });
        const leader = await MobileUser.findById(targetClan.leader)
        const noti = await sendPushNotification(
            leader?.pushToken,
            "New Clan Join Request",
            `${username || user.username} has requested to join your clan [${targetClan.name}]!`,
            {  
              type: "screen", 
              page: "clanprofile"
            },
        )
        
        await targetClan.save();

        return NextResponse.json({ message: "Application sent successfully!" }, { status: 200 });

    } catch (err) {
        console.error("Join Request Error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
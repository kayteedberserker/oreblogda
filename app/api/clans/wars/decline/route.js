import { NextResponse } from 'next/server';
import connectDB from "@/app/lib/mongodb";
import ClanWar from '@/app/models/ClanWar';
import Clan from '@/app/models/ClanModel';
import MobileUser from '@/app/models/MobileUserModel';
import { sendMultiplePushNotifications } from '@/app/lib/pushNotifications';

export async function POST(req) {
    try {
        await connectDB();
        const { warId } = await req.json();

        const war = await ClanWar.findById(warId);
        if (!war) return NextResponse.json({ message: "War request not found" }, { status: 404 });

        // Update status and set TTL for 30 days
        war.status = "REJECTED";
        war.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 
        await war.save();

        // Notify the Challenger that they were rejected
        const challenger = await Clan.findOne({ tag: war.challengerTag });
        const rejectingClan = await Clan.findOne({ tag: war.targetTag });

        if (challenger && rejectingClan) {
            const challengerIds = [
                challenger.leader,
                challenger.viceLeader,
                ...(challenger.members || [])
            ].filter(id => id != null);

            const members = await MobileUser.find({ _id: { $in: challengerIds } }).select("pushToken");
            const tokens = members.map(m => m.pushToken).filter(token => !!token);

            if (tokens.length > 0) {
                await sendMultiplePushNotifications(
                    tokens,
                    "Challenge Rejected 🛡️",
                    `${rejectingClan.name} has declined your war challenge.`,
                    { screen: "/clans/wars", warId: war._id },
                    war._id
                );
            }
        }

        return NextResponse.json({ message: "War challenge declined and archived" });
    } catch (error) {
        console.error("Decline War Error:", error);
        return NextResponse.json({ message: "Decline failed" }, { status: 500 });
    }
}
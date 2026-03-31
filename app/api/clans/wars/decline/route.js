import { createMessagePill } from '@/app/lib/messagePillService'; // ⚡️ Added
import connectDB from "@/app/lib/mongodb";
import { sendMultiplePushNotifications } from '@/app/lib/pushNotifications';
import Clan from '@/app/models/ClanModel';
import ClanWar from '@/app/models/ClanWar';
import MobileUser from '@/app/models/MobileUserModel';
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        await connectDB();
        const { warId } = await req.json();

        // ⚡️ Changed findById to findOne to match your custom warId strings
        const war = await ClanWar.findOne({ warId });
        if (!war) return NextResponse.json({ message: "War request not found" }, { status: 404 });

        // Update status and set TTL for 30 days
        war.status = "REJECTED";
        war.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        await war.save();

        const challenger = await Clan.findOne({ tag: war.challengerTag });
        const rejectingClan = await Clan.findOne({ tag: war.defenderTag });

        if (challenger && rejectingClan) {
            // ⚡️ INTEGRATE MESSAGE PILLS
            await Promise.all([
                // 1. Challenger Pill: "Your challenge was rejected"
                createMessagePill({
                    text: `🛡️ CHALLENGE DECLINED: ${rejectingClan.name} has refused your war declaration.`,
                    type: 'war_update',
                    targetAudience: 'clan',
                    targetId: war.challengerTag,
                    priority: 1,
                    expiresInHours: 24, // Keep it for a day so they see the result
                    replaceExistingType: true
                }),
                // 2. Defender Pill: Clear the "Action Required" notification
                // We create a short-lived confirmation or simply let replaceExisting wipe the old one
                createMessagePill({
                    text: `Challenge from ${challenger.name} dismissed.`,
                    type: 'war_update',
                    targetAudience: 'clan',
                    targetId: war.defenderTag,
                    priority: 0,
                    expiresInHours: 1, // Disappears quickly since the action is done
                    replaceExistingType: true
                })
            ]);

            // 🔔 Push Notifications
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
                    { screen: "/clans/wars", warId: war.warId },
                    war.warId
                );
            }
        }

        return NextResponse.json({ message: "War challenge declined and archived" });
    } catch (error) {
        console.error("Decline War Error:", error);
        return NextResponse.json({ message: "Decline failed" }, { status: 500 });
    }
}
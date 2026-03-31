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
        const { warId, senderTag, stake, duration, winCondition, metrics } = await req.json();

        const war = await ClanWar.findOne({ warId });
        if (!war) return NextResponse.json({ message: "War record not found" }, { status: 404 });

        // Update terms
        war.prizePool = stake;
        war.durationDays = duration;
        war.winCondition = winCondition;
        war.warType = metrics;
        war.status = "NEGOTIATING";

        // 🔥 Update who is making this offer
        war.lastUpdatedByCustomTag = senderTag;

        // Determine opponent
        const opponentTag = (senderTag === war.challengerTag) ? war.defenderTag : war.challengerTag;

        await war.save();

        const [senderClan, opponentClan] = await Promise.all([
            Clan.findOne({ tag: senderTag }),
            Clan.findOne({ tag: opponentTag })
        ]);

        if (opponentClan && senderClan) {
            // ⚡️ INTEGRATE MESSAGE PILLS
            await Promise.all([
                // Pill for the Opponent: "Someone sent a counter-offer!"
                createMessagePill({
                    text: `🤝 COUNTER-OFFER: ${senderClan.name} proposed new terms for the war.`,
                    type: 'war_update',
                    targetAudience: 'clan',
                    targetId: opponentTag,
                    link: '/clans/wars',
                    priority: 2,
                    expiresInHours: 48,
                    replaceExistingType: true
                }),
                // Pill for the Sender: "Awaiting their response"
                createMessagePill({
                    text: `⌛ Sent counter-offer to ${opponentClan.name}. Awaiting response...`,
                    type: 'war_update',
                    targetAudience: 'clan',
                    targetId: senderTag,
                    link: '/clans/wars',
                    priority: 1,
                    expiresInHours: 48,
                    replaceExistingType: true
                })
            ]);

            // 🔔 Push Notifications
            const opponentIds = [
                opponentClan.leader,
                opponentClan.viceLeader,
                ...(opponentClan.members || [])
            ].filter(id => id != null);

            const members = await MobileUser.find({ _id: { $in: opponentIds } }).select("pushToken");
            const tokens = members.map(m => m.pushToken).filter(token => !!token);

            if (tokens.length > 0) {
                await sendMultiplePushNotifications(
                    tokens,
                    "New Counter-Offer! 🤝",
                    `${senderClan.name} has proposed new war terms.`,
                    { screen: "/clans/wars", warId: war.warId },
                    war.warId
                );
            }
        }

        return NextResponse.json({ message: "Counter-offer transmitted" });
    } catch (error) {
        console.error("Counter War Error:", error);
        return NextResponse.json({ message: "Counter failed" }, { status: 500 });
    }
}
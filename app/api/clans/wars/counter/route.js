import { NextResponse } from 'next/server';
import connectDB from "@/app/lib/mongodb";
import ClanWar from '@/app/models/ClanWar';
import Clan from '@/app/models/ClanModel';
import MobileUser from '@/app/models/MobileUserModel';
import { sendMultiplePushNotifications } from '@/app/lib/pushNotifications';

export async function POST(req) {
    try {
        await connectDB();
        const { warId, senderTag, stake, duration, winCondition, metrics } = await req.json();
        
        // Find by warId (your custom string ID)
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
        console.log(war);
        
        await war.save();

        // 🔔 Notify the Opponent Clan
        const [senderClan, opponentClan] = await Promise.all([
            Clan.findOne({ tag: senderTag }),
            Clan.findOne({ tag: opponentTag })
        ]);

        if (opponentClan && senderClan) {
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
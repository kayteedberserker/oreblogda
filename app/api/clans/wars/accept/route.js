import { createMessagePill } from '@/app/lib/messagePillService'; // ⚡️ Import the service
import connectDB from "@/app/lib/mongodb";
import { sendMultiplePushNotifications } from '@/app/lib/pushNotifications';
import Clan from '@/app/models/ClanModel';
import ClanWar from '@/app/models/ClanWar';
import MobileUser from '@/app/models/MobileUserModel';
import { NextResponse } from 'next/server';

export async function POST(req) {
    try {
        await connectDB();
        const { warId, userClanTag } = await req.json();

        const war = await ClanWar.findOne({
            warId,
            status: { $in: ["PENDING", "NEGOTIATING"] }
        });

        if (!war) {
            return NextResponse.json({ message: "War request not found or already active" }, { status: 404 });
        }

        if (war.status === "PENDING" && userClanTag === war.challengerTag) {
            return NextResponse.json({ message: "You cannot accept your own initial challenge" }, { status: 403 });
        }

        if (war.status === "NEGOTIATING" && userClanTag === war.lastUpdatedByCustomTag) {
            return NextResponse.json({ message: "Waiting for the opponent to accept your counter-offer" }, { status: 403 });
        }

        const challenger = await Clan.findOne({ tag: war.challengerTag });
        const defender = await Clan.findOne({ tag: war.defenderTag });

        if (!challenger || !defender) {
            return NextResponse.json({ message: "One of the clans no longer exists" }, { status: 404 });
        }

        const stake = war.prizePool;

        if (challenger.spendablePoints < stake || defender.spendablePoints < stake) {
            return NextResponse.json({ message: "One clan lacks sufficient points to cover the stake" }, { status: 400 });
        }

        // 🛡️ LOCK POINTS & ACTIVATE WAR
        challenger.spendablePoints -= stake;
        challenger.lockedPoints += stake;
        challenger.isInWar = true;
        challenger.activeWarId = war.warId;

        defender.spendablePoints -= stake;
        defender.lockedPoints += stake;
        defender.isInWar = true;
        defender.activeWarId = war.warId;

        war.initialStats = {
            challenger: {
                points: challenger.totalPoints || 0,
                likes: challenger.stats?.likes || 0,
                comments: challenger.stats?.comments || 0
            },
            defender: {
                points: defender.totalPoints || 0,
                likes: defender.stats?.likes || 0,
                comments: defender.stats?.comments || 0
            }
        };

        war.status = "ACTIVE";
        war.startTime = new Date();
        war.endTime = new Date(Date.now() + (war.durationDays * 24 * 60 * 60 * 1000));

        await Promise.all([
            war.save(),
            challenger.save(),
            defender.save()
        ]);

        // ⚡️ INTEGRATE MESSAGE PILLS
        // Create pills for both clans so all members see the status in their header
        const warMessage = `WAR ACTIVE: ${challenger.name} vs ${defender.name}. Stake: ${stake} pts.`;

        await Promise.all([
            createMessagePill({
                text: warMessage,
                type: 'war_update',
                targetAudience: 'clan',
                targetId: challenger.tag,
                link: '/clans/wars',
                priority: 2,
                expiresInHours: war.durationDays * 24,
                replaceExistingType: true
            }),
            createMessagePill({
                text: warMessage,
                type: 'war_update',
                targetAudience: 'clan',
                targetId: defender.tag,
                link: '/clans/wars',
                priority: 2,
                expiresInHours: war.durationDays * 24,
                replaceExistingType: true
            })
        ]);

        // 🔔 Push Notifications
        const recipientTag = (userClanTag === war.challengerTag) ? war.defenderTag : war.challengerTag;
        const recipientClan = (recipientTag === challenger.tag) ? challenger : defender;
        const senderClanName = (userClanTag === challenger.tag) ? challenger.name : defender.name;

        const notifyIds = [
            recipientClan.leader,
            recipientClan.viceLeader,
            ...(recipientClan.members || [])
        ].filter(id => id != null);

        const members = await MobileUser.find({ _id: { $in: notifyIds } }).select("pushToken");
        const tokens = members.map(m => m.pushToken).filter(token => !!token);

        if (tokens.length > 0) {
            await sendMultiplePushNotifications(
                tokens,
                "War Accepted! 🔥",
                `${senderClanName} has accepted the terms. The bloodbath begins!`,
                { screen: "/clans/wars", warId: war.warId },
                war.warId
            );
        }

        return NextResponse.json({ message: "War is now ACTIVE" });
    } catch (error) {
        console.error("Accept War Error:", error);
        return NextResponse.json({ message: "Activation failed" }, { status: 500 });
    }
}
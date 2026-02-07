import { NextResponse } from 'next/server';
import connectDB from "@/app/lib/mongodb";
import ClanWar from '@/app/models/ClanWar';
import Clan from '@/app/models/ClanModel';
import MobileUser from '@/app/models/MobileUserModel';
import { sendMultiplePushNotifications } from '@/app/lib/pushNotifications';

export async function POST(req) {
    try {
        await connectDB();
        // userClanTag is the tag of the clan the current user belongs to
        const { warId, userClanTag } = await req.json();

        // 1. Find the war - allow both PENDING and NEGOTIATING
        const war = await ClanWar.findOne({ 
            warId, 
            status: { $in: ["PENDING", "NEGOTIATING"] } 
        });

        if (!war) {
            return NextResponse.json({ message: "War request not found or already active" }, { status: 404 });
        }

        // 2. SECURITY CHECK: Ensure the person accepting isn't the one who sent the last offer
        // If status is PENDING, only the defender can accept.
        // If status is NEGOTIATING, only the clan that DIDN'T send the last counter can accept.
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

        // 🛡️ UPDATE CLAN FIELDS & POINTS
        const stake = war.prizePool;

        // Check if both clans actually have the points before proceeding
        if (challenger.spendablePoints < stake || defender.spendablePoints < stake) {
            return NextResponse.json({ message: "One clan lacks sufficient points to cover the stake" }, { status: 400 });
        }

        // Move points to locked for Challenger
        challenger.spendablePoints -= stake;
        challenger.lockedPoints += stake;
        challenger.isInWar = true;
        challenger.activeWarId = war.warId;

        // Move points to locked for Defender
        defender.spendablePoints -= stake;
        defender.lockedPoints += stake;
        defender.isInWar = true;
        defender.activeWarId = war.warId;

        // SNAPSHOT INITIAL STATS
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

        // Save everything
        await Promise.all([
            war.save(),
            challenger.save(),
            defender.save()
        ]);

        // 🔔 Notify the OTHER clan (the one that didn't just click 'Accept')
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
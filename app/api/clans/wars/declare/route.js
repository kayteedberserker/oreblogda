import { NextResponse } from 'next/server';
import connectDB from "@/app/lib/mongodb";
import ClanWar from '@/app/models/ClanWar';
import Clan from '@/app/models/ClanModel';
import MobileUser from '@/app/models/MobileUserModel'; // Ensure this import exists
import { sendMultiplePushNotifications } from '@/app/lib/pushNotifications';

export async function POST(req) {
    try {
        await connectDB();
        const country = req.headers.get('x-user-country') || "Global";
        const { targetTag, stake, duration, winCondition, metrics, challengerTag } = await req.json();

        // 1. Verify Challenger
        const challengerClan = await Clan.findOne({ tag: challengerTag });
        if (!challengerClan) return NextResponse.json({ message: "Challenger clan not found" }, { status: 404 });

        // Check if challenger has enough points to stake
        if (challengerClan.spendablePoints < stake) {
            return NextResponse.json({ message: "Insufficient spendable points to challenge" }, { status: 400 });
        }

        // 2. Verify Defender
        const defenderClan = await Clan.findOne({ tag: targetTag });
        if (!defenderClan) return NextResponse.json({ message: "Target clan does not exist" }, { status: 404 });
        
        if (defenderClan.spendablePoints < stake) {
            return NextResponse.json({ message: "Target clan cannot afford this stake" }, { status: 400 });
        }

        // 3. Unique War ID
        const tags = [challengerTag, targetTag].sort();
        const warId = `${tags[0]}VS${tags[1]}`;

        const existingWar = await ClanWar.findOne({ warId, status: { $in: ["PENDING", "ACTIVE"] } });
        if (existingWar) return NextResponse.json({ message: "Conflict already exists" }, { status: 400 });

        // 4. Create War
        const newWar = await ClanWar.create({
            warId,
            country,
            challengerTag,
            defenderTag: targetTag,
            prizePool: stake,
            durationDays: duration,
            winCondition,
            warType: metrics.length > 1 ? "ALL" : metrics[0],
            status: "PENDING"
        });

        // 5. Notify ALL Defender Clan Members
        // Collect IDs of Leader, Vice Leader, and Members
        const defenderIds = [
            defenderClan.leader,
            defenderClan.viceLeader,
            ...(defenderClan.members || [])
        ].filter(id => id != null);

        const members = await MobileUser.find({ _id: { $in: defenderIds } }).select("pushToken");
        const tokens = members.map(m => m.pushToken).filter(token => !!token);

        if (tokens.length > 0) {
            await sendMultiplePushNotifications(
                tokens,
                "War Declared! ⚔️",
                `${challengerClan.name} has challenged your clan to a ${stake}pt war!`,
                { screen: "/clans/wars", warId: newWar.warId },
                newWar.warId
            );
        }

        return NextResponse.json(newWar, { status: 201 });
    } catch (error) {
        console.error(error);
        return NextResponse.json({ message: "Internal Error" }, { status: 500 });
    }
}
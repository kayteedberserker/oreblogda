import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import { NextResponse } from "next/server";


export async function POST(req, { params }) {
    await connectDB();
    const { tag } = await params;
    const { requestId, decision } = await req.json(); // requestId is the User's ID

    try {
        const clan = await Clan.findOne({ tag });
        if (!clan) return NextResponse.json({ message: "Clan not found" }, { status: 404 });

        if (decision === 'approve') {
            // 1. Check if clan is already full
            if (clan.members.length >= clan.maxSlots) {
                return NextResponse.json({ message: "Squad is full. Upgrade slots first!" }, { status: 400 });
            }

            // 2. Add to members if not already there
            if (!clan.members.includes(requestId)) {
                clan.members.push(requestId);
            }

            // 3. Auto-close recruitment if this was the last slot
            if (clan.members.length >= clan.maxSlots) {
                clan.isRecruiting = false;
            }
        }

        // 4. Remove from joinRequests regardless of approve/reject
        clan.joinRequests = clan.joinRequests.filter(req => req.userId.toString() !== requestId);

        await clan.save();
        return NextResponse.json({ message: `Request ${decision}ed successfully` });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
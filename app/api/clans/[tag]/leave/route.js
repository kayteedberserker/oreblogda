import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
    await connectDB();
    const { tag } = await params;
    const { userId } = await req.json();

    try {
        const clan = await Clan.findOne({ tag });

        if (!clan) {
            return NextResponse.json({ message: "Clan not found" }, { status: 404 });
        }

        // 1. Check if the user is actually the Leader
        if (clan.leader.toString() === userId) {
            return NextResponse.json({ 
                message: "Captains cannot leave. You must transfer leadership or disband the clan." 
            }, { status: 400 });
        }

        // 2. Check if the user is actually a member
        if (!clan.members.includes(userId)) {
            return NextResponse.json({ message: "You are not a member of this clan" }, { status: 400 });
        }

        // 3. Remove the member
        clan.members = clan.members.filter(id => id.toString() !== userId);
        
        // 4. If they left, and the clan was full/closed, maybe re-open recruitment?
        // (Optional logic: let the leader decide manually via settings instead)

        await clan.save();

        return NextResponse.json({ message: "You have left the clan." }, { status: 200 });

    } catch (err) {
        console.error("Leave Clan Error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
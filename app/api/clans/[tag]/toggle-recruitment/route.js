import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import { NextResponse } from "next/server";

export async function POST(req, { params }) {
    await connectDB();
    const { tag } = await params;

    try {
        const clan = await Clan.findOne({ tag });
        if (!clan) return NextResponse.json({ message: "Clan not found" }, { status: 404 });

        clan.isRecruiting = !clan.isRecruiting;
        await clan.save();
        
        return NextResponse.json({ isRecruiting: clan.isRecruiting });
    } catch (err) {
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

export async function GET(req, { params }) {
    await connectDB();
    const { tag } = await params;

    try {
        // Populate members_details to show names in the squad list
        const clan = await Clan.findOne({ tag }).populate("members", "username email");

        if (!clan) return NextResponse.json({ message: "Clan not found" }, { status: 404 });

        // Format the response to match your UI's expected 'members_details'
        const clanData = clan.toObject();
        clanData.members_details = clanData.members; 

        return NextResponse.json(clanData);
    } catch (err) {
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
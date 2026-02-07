import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import { NextResponse } from "next/server";

export async function PATCH(req, { params }) {
    await connectDB();
    const { tag } = await params;
    const { leaderId, name, description, logo, isRecruiting } = await req.json();

    try {
        // 1. Find the clan and verify leadership
        const clan = await Clan.findOne({ tag });
        if (!clan) {
            return NextResponse.json({ message: "Clan not found" }, { status: 404 });
        }

        if (clan.leader.toString() !== leaderId) {
            return NextResponse.json({ message: "Unauthorized: Only the Captain can change settings" }, { status: 403 });
        }

        // 2. Update fields (limiting what can be changed)
        if (name) clan.name = name.trim();
        if (description !== undefined) clan.description = description;
        if (logo !== undefined) clan.logo = logo;
        if (isRecruiting !== undefined) clan.isRecruiting = isRecruiting;

        await clan.save();

        return NextResponse.json({ 
            message: "Clan scrolls updated successfully!", 
            clan 
        }, { status: 200 });

    } catch (err) {
        console.error("Update Settings Error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
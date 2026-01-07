// app/api/streak/[deviceId]/route.js
import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import UserStreak from "@/app/models/UserStreak";
import MobileUser from "@/app/models/MobileUserModel";

export async function GET(req, { params }) {
    await connectDB();
    const resolvedParams = await params;
    
    const { deviceId } = resolvedParams;
    
    if (!deviceId) return NextResponse.json({ message: "Device ID required" }, { status: 400 });

    try {
        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        const streakDoc = await UserStreak.findOne({ userId: user._id });

        return NextResponse.json({
            streak: streakDoc?.streak || 0,
            lastPostDate: streakDoc?.lastPostDate || null,
            canRestore: !streakDoc && (user.lastStreak > 0), // Logic to tell frontend restore is possible
            recoverableStreak: user.lastStreak || 0
        }, { status: 200 });
    } catch (err) {
        console.error(err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
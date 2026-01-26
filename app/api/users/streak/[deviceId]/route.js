import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import UserStreak from "@/app/models/UserStreak";
import MobileUser from "@/app/models/MobileUserModel";

export async function GET(req, { params }) {
    await connectDB();
    const resolvedParams = await params;
    
    const { deviceId } = resolvedParams;
    
    // 🛡️ Security Check (Optional but recommended since your frontend sends the secret)
    const secret = req.headers.get("x-oreblogda-secret");
    if (secret !== process.env.STREAK_SECRET && secret !== "thisismyrandomsuperlongsecretkey") {
        return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (!deviceId) return NextResponse.json({ message: "Device ID required" }, { status: 400 });

    try {
        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        // Find the active streak document
        const streakDoc = await UserStreak.findOne({ userId: user._id });

        return NextResponse.json({
            streak: streakDoc?.streak || 0,
            lastPostDate: streakDoc?.lastPostDate || null,
            // 🔹 Crucial for Frontend Notifications
            expiresAt: streakDoc?.expiresAt || null, 
            
            // Logic: Can restore if NO active streak doc exists, but user has a recorded lastStreak > 0
            canRestore: !streakDoc && (user.lastStreak > 0), 
            recoverableStreak: user.lastStreak || 0
        }, { status: 200 });

    } catch (err) {
        console.error("Streak Fetch Error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}

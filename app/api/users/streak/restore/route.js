import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import UserStreak from "@/app/models/UserStreak";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        await connectDB();

        const { deviceId } = await req.json();
        if (!deviceId) {
            return NextResponse.json({ message: "Device ID required" }, { status: 400 });
        }

        // 1️⃣ Find user
        const user = await MobileUser.findOne({ deviceId });
        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        // 2️⃣ If active streak exists → block restore
        const existingStreak = await UserStreak.findOne({ userId: user._id });
        if (existingStreak) {
            return NextResponse.json({
                message: "Active streak already exists",
                streak: existingStreak.streak,
            }, { status: 409 });
        }

        // 3️⃣ Validate backup streak
        const restoreValue = user.lastStreak || 0;
        if (restoreValue <= 0) {
            return NextResponse.json({ message: "No streak available to restore" }, { status: 400 });
        }

        // 4️⃣ INVENTORY CHECK (Strict Item Enforcement)
        const itemIndex = user.inventory?.findIndex(i => i.itemId === 'streak_restore');

        if (itemIndex === undefined || itemIndex === -1) {
            return NextResponse.json({
                message: "No Streak Restore Pass found. Please visit the store to purchase one."
            }, { status: 400 });
        }

        // Consume 1 Restore Pass
        if (user.inventory[itemIndex].itemCount > 1) {
            user.inventory[itemIndex].itemCount -= 1;
        } else {
            user.inventory.splice(itemIndex, 1);
        }

        const now = new Date();

        // 5️⃣ Restore streak
        const restoredStreak = await UserStreak.create({
            userId: user._id,
            streak: restoreValue,
            lastPostDate: now,
            expiresAt: new Date(now.getTime() + 48 * 60 * 60 * 1000), // 48h TTL
        });

        // Save the user document (updates the inventory)
        await user.save();

        return NextResponse.json({
            success: true,
            message: "Streak restored using a Restore Pass!",
            streak: restoredStreak.streak,
            lastPostDate: now.toISOString().split("T")[0],
            inventory: user.inventory
        });

    } catch (err) {
        console.error("Streak Restore Error:", err);
        return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
    }
}
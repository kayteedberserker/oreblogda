import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import UserStreak from "@/app/models/UserStreak";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        await connectDB();
        const body = await req.json();
        const { deviceId, actionType } = body;

        if (!deviceId || !actionType) {
            return NextResponse.json({ message: "Missing system identifiers." }, { status: 400 });
        }

        if (actionType !== 'streak_freeze') {
            return NextResponse.json({ message: "Invalid action protocol." }, { status: 400 });
        }

        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ message: "User matrix not found." }, { status: 404 });

        // 1. Check Inventory for the Freeze Pass
        const itemIndex = user.inventory?.findIndex(i => i.itemId === 'streak_freeze');

        if (itemIndex === undefined || itemIndex === -1) {
            return NextResponse.json({ message: "Streak Freeze Pass not found in inventory." }, { status: 400 });
        }

        // 2. Fetch the User's Active Streak Document
        let streakDoc = await UserStreak.findOne({ userId: user._id });

        if (!streakDoc || streakDoc.streak <= 0) {
            return NextResponse.json({ message: "No active streak detected to freeze." }, { status: 400 });
        }

        const now = new Date();

        // Check if already frozen far into the future
        if (streakDoc.frozenUntil && new Date(streakDoc.frozenUntil) > new Date(now.getTime() + 24 * 60 * 60 * 1000)) {
            return NextResponse.json({ message: "Streak is already under deep freeze protection." }, { status: 400 });
        }

        // 3. Consume the Item
        if (user.inventory[itemIndex].itemCount > 1) {
            user.inventory[itemIndex].itemCount -= 1;
        } else {
            user.inventory.splice(itemIndex, 1);
        }
        user.markModified('inventory');

        // 4. Apply the Freeze Effect 
        const freezeDurationMs = 72 * 60 * 60 * 1000; // 72 hours
        const standardExpiryMs = 48 * 60 * 60 * 1000; // 48 hours for them to post AFTER freeze ends

        // If already frozen, extend it. Otherwise, start from now.
        const baseTime = (streakDoc.frozenUntil && new Date(streakDoc.frozenUntil) > now)
            ? new Date(streakDoc.frozenUntil).getTime()
            : now.getTime();

        // 🔹 1. Update the Frontend/Logic tracker
        streakDoc.frozenUntil = new Date(baseTime + freezeDurationMs);

        // 🔹 2. Update the MongoDB Background Cleanup (TTL)
        // It expires 48 hours AFTER the freeze completely ends
        streakDoc.expiresAt = new Date(streakDoc.frozenUntil.getTime() + standardExpiryMs);

        // Save concurrently
        await Promise.all([
            user.save(),
            streakDoc.save()
        ]);

        return NextResponse.json({
            success: true,
            message: "Defense protocol active. Streak frozen for 72 hours.",
            inventory: user.inventory,
            frozenUntil: streakDoc.frozenUntil,
            expiresAt: streakDoc.expiresAt // Sending this back just in case your frontend needs to see the absolute hard-death limit
        }, { status: 200 });

    } catch (err) {
        console.error("Critical Streak Action Error:", err);
        return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
    }
}
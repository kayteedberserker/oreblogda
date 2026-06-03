import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        await connectDB();

        const { uid, oldPin, newPin } = await req.json();

        // 1. Validation
        if (!uid || !newPin || newPin.length !== 6 || !oldPin || oldPin.length !== 6) {
            return NextResponse.json({
                message: "Invalid Encryption Protocol. 6-digit PIN required."
            }, { status: 400 });
        }

        // 2. Find the user
        const user = await MobileUser.findOne({ uid }).select("+pin");
        if (!user) {
            return NextResponse.json({
                message: "Player not found in Neural Network."
            }, { status: 404 });
        }

        if (!user?.pin) {
            return NextResponse.json({
                message: "No PIN has been allocated to this account."
            }, { status: 404 });
        }
        // --- 3. DUAL-LOGIC: VERIFY OR CREATE ---
        const isMatch = await user.comparePin(oldPin);
        if (!isMatch) {
            return NextResponse.json({
                message: "NEURAL_MISMATCH: Incorrect PIN."
            }, { status: 401 });
        }
        user.pin = newPin;
        await user.save();

        return NextResponse.json({
            message: "PIN successfully updated.",
        }, { status: 200 });

    } catch (err) {
        console.error("Security Interface Error:", err);
        return NextResponse.json({
            message: "Uplink Interrupted",
            error: err.message
        }, { status: 500 });
    }
}
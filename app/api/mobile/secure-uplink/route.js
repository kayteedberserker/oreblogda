import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        await connectDB();

        const { uid, pin, email } = await req.json();

        // 1. Validation
        if (!uid || ((!pin || pin.length !== 6) && !email)) {
            return NextResponse.json({
                message: "Invalid Encryption Protocol. 6-digit PIN required."
            }, { status: 400 });
        }

        // 2. Find the user
        const user = await MobileUser.findOne({ uid }).select("+pin");
        if (!user) {
            return NextResponse.json({
                message: "Operative not found in Neural Network."
            }, { status: 404 });
        }

        // --- 3. DUAL-LOGIC: VERIFY OR CREATE ---
        if (user.pin) {
            const isMatch = await user.comparePin(pin);
            if (!isMatch) {
                return NextResponse.json({
                    message: "NEURAL_MISMATCH: Invalid signature."
                }, { status: 401 });
            }

            if (email && !user.email) {
                user.email = email.toLowerCase().trim();
                user.securityLevel = 3;
            }
        } else {
            user.pin = pin;
            user.securityLevel = 2;
            if (email && email.trim() !== "") {
                user.email = email.toLowerCase().trim();
                user.securityLevel = 3;
            }
        }

        // --- 4. DOUBLE TOKEN GENERATION ---

        // Short-lived Access Token (15 minutes for high security)
        const accessToken = jwt.sign(
            { userId: user.deviceId, uid: user.uid, level: user.securityLevel },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        // Long-lived Refresh Token (90 days)
        const refreshToken = jwt.sign(
            { uid: user.uid },
            process.env.REFRESH_TOKEN_SECRET, // Use a separate secret for refresh tokens
            { expiresIn: "90d" }
        );
        user.refreshToken = refreshToken; // Store the refresh token in DB for later verification
        await user.save();

        return NextResponse.json({
            message: user.pin ? "Neural Link Restored" : "Neural Link Fortified",
            securityLevel: user.securityLevel,
            accessToken: accessToken,
            refreshToken: refreshToken
        }, { status: 200 });

    } catch (err) {
        console.error("Security Interface Error:", err);
        if (err.code === 11000) {
            return NextResponse.json({
                message: "This email is already linked to another operative."
            }, { status: 400 });
        }
        return NextResponse.json({
            message: "Uplink Interrupted",
            error: err.message
        }, { status: 500 });
    }
}
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import jwt from "jsonwebtoken";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        await connectDB();

        const { refreshToken, deviceId } = await req.json();

        if (!refreshToken) {
            return NextResponse.json({ message: "NEURAL_LINK_EMPTY: Missing Token" }, { status: 440 });
        }

        // 1. Verify the Refresh Token signature
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        } catch (err) {
            console.log("Session expired");
            return NextResponse.json({ message: "ENCRYPTION_EXPIRED: Session Timed Out" }, { status: 401 });
        }

        // 2. Find user in MongoDB and verify token + deviceId match
        const user = await MobileUser.findOne({ uid: decoded.uid });
        console.log("This user refreshToken is: ", refreshToken, " but its supposed to be? ", user.refreshToken);

        if (!user || user.refreshToken !== refreshToken || user.deviceId !== deviceId) {
            // This is critical: If the token doesn't match what we have in DB, 
            // someone might be trying a Replay Attack.
            console.log("Token verification failed for user:", decoded.uid);
            console.log("Expected deviceId:", user.deviceId);
            console.log("Received deviceId:", deviceId);

            return NextResponse.json({ message: "SESSION_COMPROMISED: Neural Link Severed" }, { status: 405 });
        }

        // 3. GENERATE NEW PAIR (Rotation)
        const newAccessToken = jwt.sign(
            { userId: user.deviceId, uid: user.uid, level: user.securityLevel },
            process.env.JWT_SECRET,
            { expiresIn: "15m" }
        );

        const newRefreshToken = jwt.sign(
            { uid: user.uid },
            process.env.REFRESH_TOKEN_SECRET,
            { expiresIn: "90d" }
        );

        // 4. Update MongoDB with the NEW Refresh Token (Invalidates the old one)
        user.refreshToken = newRefreshToken;
        await user.save();

        return NextResponse.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken
        }, { status: 200 });

    } catch (err) {
        console.error("Refresh Logic Error:", err);
        return NextResponse.json({ message: "Uplink Interrupted" }, { status: 500 });
    }
}
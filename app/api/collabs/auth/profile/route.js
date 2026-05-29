import connectDB from "@/app/lib/mongodb";
import MobileUser from "app/models/MobileUserModel";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export async function GET() {
    try {
        const cookieStore = await cookies();
        const token = cookieStore.get("collabs_token")?.value;

        if (!token) {
            return NextResponse.json({ message: "Unauthorized token state." }, { status: 401 });
        }

        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error("JWT_SECRET environment variable is missing from application runtime environment.");
        }

        // 🔐 Verify Edge-Safe Token Signature
        const secret = new TextEncoder().encode(jwtSecret);
        const { payload } = await jwtVerify(token, secret);

        if (!payload || !payload.userId) {
            return NextResponse.json({ message: "Malformed session payload signature." }, { status: 401 });
        }

        await connectDB();

        // Hydrate user profile details safely from database
        const user = await MobileUser.findById(payload.userId).lean();
        if (!user) {
            return NextResponse.json({ message: "User document missing from core system collections." }, { status: 404 });
        }

        return NextResponse.json({
            user: {
                id: user._id.toString(),
                username: user.username,
                referralCode: user.referralCode || null,
                role: user.role || "Author"
            }
        });

    } catch (err) {
        console.error("Profile sync error details:", err);

        if (err.code === "ERR_JWT_EXPIRED") {
            return NextResponse.json({ message: "Your creator dashboard session has expired." }, { status: 401 });
        }

        return NextResponse.json({ message: "Internal server error syncing network context." }, { status: 500 });
    }
}
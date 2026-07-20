import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel"; // Make sure path matches your setup
import MobileUser from "@/app/models/MobileUserModel"; // Make sure path matches your setup
import { SignJWT } from "jose";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        await connectDB();

        const { uid, pin } = await req.json();

        // 1. Check if payload inputs are present
        if (!uid || !pin) {
            return NextResponse.json(
                { error: "UID and PIN are required fields." },
                { status: 400 }
            );
        }

        // 2. Locate the user by UID (+pin is mandatory because select: false hides it by default)
        const user = await MobileUser.findOne({ uid }).select("+pin");
        if (!user) {
            return NextResponse.json(
                { error: "No user account found matching this UID." },
                { status: 404 }
            );
        }

        // 3. Confirm that the user has initialized a password PIN inside the app
        if (!user.pin) {
            return NextResponse.json(
                { error: "Go back into the app to create a PIN before accessing the creator dashboard." },
                { status: 400 }
            );
        }

        // 4. Validate PIN signature match
        const pinMatch = await user.comparePin(pin);
        if (!pinMatch) {
            return NextResponse.json(
                { error: "Invalid credential authorization code. Double check your PIN." },
                { status: 401 }
            );
        }

        // 5. Look up the Clan dashboard to verify leader authority structure
        const userClan = await Clan.findOne({ leader: user._id });
        if (!userClan) {
            return NextResponse.json(
                { error: "Access denied. Your account profile is not registered as a Clan Leader." },
                { status: 403 }
            );
        }

        // 6. Verify structural confirmation of the Clan
        if (userClan.verifiedClan !== true || userClan.primeLevel < 2) {
            return NextResponse.json(
                { error: "Access Denied. Your Clan has not been verified for external dashboard permissions yet." },
                { status: 403 }
            );
        }

        // SUCCESS! Generate session configurations here 
        const responseData = {
            success: true,
            user: {
                id: user._id,
                username: user.username,
                role: user.role,
                deviceId: user.deviceId
            },
            clan: {
                id: userClan._id,
                name: userClan.name,
                tag: userClan.tag
            }
        };

        const response = NextResponse.json(responseData, { status: 200 });

        // 🔐 GENERATE EDGE-SAFE JWT SESSION TOKEN
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            throw new Error("JWT_SECRET environment variable is missing.");
        }

        const secret = new TextEncoder().encode(jwtSecret);
        const token = await new SignJWT({
            userId: user._id.toString(),
            username: user.username,
            role: user.role,
            clanId: userClan._id.toString()
        })
            .setProtectedHeader({ alg: "HS256" })
            .setIssuedAt()
            .setExpirationTime("7d") // Cookie aligns to 7-day session window
            .sign(secret);

        // 🍪 DROP THE SECURE COOKIE CONTAINER FOR THE MIDDLEWARE
        response.cookies.set("collabs_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            path: "/",
            sameSite: "lax",
            maxAge: 60 * 60 * 24 * 7, // 7 days
        });

        return response;

    } catch (error) {
        console.error("Collab Auth API Error:", error);
        return NextResponse.json(
            { error: "Internal Server Authorization Error." },
            { status: 500 }
        );
    }
}
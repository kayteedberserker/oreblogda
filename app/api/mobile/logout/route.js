import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        await connectDB();
        const { deviceId } = await req.json();

        if (!deviceId) {
            return NextResponse.json({ message: "Missing operative ID." }, { status: 400 });
        }

        // ⚡️ Nullify the push token so this device stops receiving targeted intel
        await MobileUser.findOneAndUpdate(
            { deviceId },
            { $set: { pushToken: null, hasLoggedOut: true } }
        );

        return NextResponse.json({ message: "Neural link detached successfully." }, { status: 200 });

    } catch (err) {
        console.error("Logout Error:", err);
        return NextResponse.json({ message: "System error during detachment." }, { status: 500 });
    }
}
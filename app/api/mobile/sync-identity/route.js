import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

const generateSecureSuffix = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let suffix = "";
    while (true) {
        suffix = "";
        for (let i = 0; i < 4; i++) {
            suffix += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (!/^(\w)\1+$/.test(suffix) && !"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".includes(suffix)) break;
    }
    return suffix;
};

export async function POST(req) {
    try {
        await connectDB();
        const { deviceId, hardwareId } = await req.json();

        // ⚡️ 1. CORE VALIDATION: Ensure device parameters were actually sent
        if (!deviceId) {
            return NextResponse.json({ success: false, message: "Missing system signature (deviceId)." }, { status: 400 });
        }

        let user = await MobileUser.findOne({ deviceId });

        if (!user) {
            return NextResponse.json({ success: false, message: "Operative not found in archives." }, { status: 404 });
        }

        // ⚡️ 2. IDENTITY GATE: Verify the user has a real alias
        const currentName = user.username ? user.username.trim() : "";
        const invalidNames = ["guest", "anonymous", "user", "admin", "system"];

        if (!currentName || invalidNames.includes(currentName.toLowerCase()) || currentName.length < 3) {
            return NextResponse.json({
                success: false,
                message: "Incomplete identity. A valid Operative Alias (3+ characters) is required to generate a UID.",
                requiresSetup: true // ⚡️ You can use this flag on the frontend to force them to the Profile Setup screen
            }, { status: 400 });
        }

        // ⚡️ 3. UID GENERATION
        if (!user.uid) {
            const suffix = generateSecureSuffix();

            // Strip out emojis, spaces, and special characters to keep the UID clean and scannable
            const cleanName = currentName.toUpperCase().replace(/[^A-Z0-9]/g, "_").substring(0, 10); // Cap name length in UID

            user.uid = `ORE-${cleanName}-${suffix}-DA`;
        }

        // ⚡️ 4. HARDWARE BINDING
        if (hardwareId) {
            user.hardwareId = hardwareId;
        }

        await user.save();

        return NextResponse.json({
            success: true,
            uid: user.uid,
            message: "Identity Synchronized and Locked."
        });

    } catch (err) {
        console.error("UID Sync Error:", err);
        return NextResponse.json({ success: false, message: "Internal System Error", error: err.message }, { status: 500 });
    }
}
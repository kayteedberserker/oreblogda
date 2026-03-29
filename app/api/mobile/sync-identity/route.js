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

        let user = await MobileUser.findOne({ deviceId });

        if (!user) {
            return NextResponse.json({ message: "Operative not found." }, { status: 404 });
        }

        // ⚡️ If the user already has a UID, just return it. 
        // ⚡️ If not, generate a new one.
        if (!user.uid) {
            const suffix = generateSecureSuffix();
            const cleanName = (user.username || "Guest").trim().toUpperCase().replace(/\s+/g, "_");
            user.uid = `ORE-${cleanName}-${suffix}-DA`;
        }

        // ⚡️ Update the hardwareId for the legacy user so they are now bound to their physical device
        if (hardwareId) user.hardwareId = hardwareId;

        await user.save();

        return NextResponse.json({
            success: true,
            uid: user.uid,
            message: "Identity Synchronized"
        });

    } catch (err) {
        return NextResponse.json({ message: "Sync Error", error: err.message }, { status: 500 });
    }
}
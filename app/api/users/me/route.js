import connectDB from "@/app/lib/mongodb";
import MobileUserModel from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel"; // ⚡️ ADDED
import UserStreak from "@/app/models/UserStreak";
import { NextResponse } from "next/server";
export async function GET(req) {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const fingerprint = searchParams.get("fingerprint");
    const secret = req.headers.get("x-oreblogda-secret");
    if (secret !== "thisismyrandomsuperlongsecretkey") return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    if (!fingerprint) return NextResponse.json({ message: "No ID" }, { status: 400 });
    try {
        let user = await MobileUserModel.findOne({ deviceId: fingerprint }).lean();
        if (!user) {
            let randNum = Math.floor(Math.random() * 10000000);
            const newUser = await MobileUserModel.create({ deviceId: fingerprint, username: `User${randNum}` });
            user = newUser.toObject();
        } else {
            if (user.inventory && Array.isArray(user.inventory)) {
                const now = new Date();
                let needsUpdate = false;
                const validInv = user.inventory.filter(item => { if (item.expiresAt && new Date(item.expiresAt) < now) { needsUpdate = true; return false; } return true; });
                if (needsUpdate) MobileUserModel.updateOne({ _id: user._id }, { $set: { inventory: validInv } }).catch(console.error);
            }
        }
        // ⚡️ PARALLEL DATA AGGREGATION
        const [streakDoc, totalPosts] = await Promise.all([
            UserStreak.findOne({ userId: user._id }).lean(),
            Post.countDocuments({ $or: [{ authorId: fingerprint }, { authorId: user._id }] }) // Support both ID types
        ]);
        const formattedStreak = { streak: streakDoc?.streak || 0, lastPostDate: streakDoc?.lastPostDate || null, frozenUntil: streakDoc?.frozenUntil || null, expiresAt: streakDoc?.expiresAt || null, canRestore: !streakDoc && (user.lastStreak > 0), recoverableStreak: user.lastStreak || 0 };
        return NextResponse.json({ user, streak: formattedStreak, totalPosts }, { status: 200 });
    } catch (err) { console.error("Sync Error:", err); return NextResponse.json({ message: "Error" }, { status: 500 }); }
}
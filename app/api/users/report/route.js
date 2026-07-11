import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollowerModel"; // 🔄 Imported your follower model
import MobileUser from "@/app/models/MobileUserModel";
import Report from "@/app/models/ReportModel";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        await connectDB();
        const body = await req.json();

        const {
            action,         // "report", "block", or "unblock"
            targetUserId,   // ID of the user or clan being targeted
            reason,
            isClan          // Boolean flag indicating if the target is a Clan
        } = body;

        const currentUserId = req.headers.get("x-user-deviceId") || req.headers.get("x-device-id");

        // Base validation
        if (!action || !currentUserId || !targetUserId) {
            return NextResponse.json({ message: "Missing required profile operation details" }, { status: 400 });
        }

        if (currentUserId === targetUserId) {
            return NextResponse.json({ message: "You cannot perform safety actions on your own profile context" }, { status: 400 });
        }

        // Fetch the active user's document to get their true database ObjectId (_id)
        const currentUser = await MobileUser.findOne({ deviceId: currentUserId });
        if (!currentUser) {
            return NextResponse.json({ message: "Initiating user account context not found" }, { status: 404 });
        }

        // ==========================================
        // ACTION 1: PROFILE BLOCKING SYSTEM
        // ==========================================
        if (action === "block") {
            if (isClan) {
                const updatedUser = await MobileUser.findOneAndUpdate(
                    { deviceId: currentUserId },
                    { $addToSet: { blockedClans: new mongoose.Types.ObjectId(targetUserId) } },
                    { new: true }
                );

                if (!updatedUser) {
                    return NextResponse.json({ message: "Initiating clan profile context not found" }, { status: 404 });
                }

                // 🚨 AUTOMATIC UNFOLLOW LOGIC FOR CLANS
                // Dynamically fetch the Clan model to grab the string tag required by ClanFollower
                const Clan = mongoose.models.Clan;
                if (Clan) {
                    const clanDoc = await Clan.findById(targetUserId);
                    if (clanDoc?.tag) {
                        // Wipe their follower record out completely
                        await ClanFollower.deleteOne({
                            clanTag: clanDoc.tag,
                            userId: currentUser._id
                        });
                    }
                }

                return NextResponse.json({
                    success: true,
                    message: "Target Clan profile restricted. Updates masked from feeds and unfollowed."
                });
            } else {
                const updatedUser = await MobileUser.findOneAndUpdate(
                    { deviceId: currentUserId },
                    { $addToSet: { blockedUsers: new mongoose.Types.ObjectId(targetUserId) } },
                    { new: true }
                );

                if (!updatedUser) {
                    return NextResponse.json({ message: "Initiating user account profile context not found" }, { status: 404 });
                }

                return NextResponse.json({
                    success: true,
                    message: "Target user profile restricted. Updates will be masked from feeds."
                });
            }
        }

        // ==========================================
        // ACTION 2: PROFILE UNBLOCKING SYSTEM
        // ==========================================
        if (action === "unblock") {
            if (isClan) {
                const updatedUser = await MobileUser.findOneAndUpdate(
                    { deviceId: currentUserId },
                    { $pull: { blockedClans: new mongoose.Types.ObjectId(targetUserId) } },
                    { new: true }
                );

                if (!updatedUser) {
                    return NextResponse.json({ message: "Initiating clan profile context not found" }, { status: 404 });
                }

                return NextResponse.json({
                    success: true,
                    message: "Target Clan profile restriction lifted successfully."
                });
            } else {
                const updatedUser = await MobileUser.findOneAndUpdate(
                    { deviceId: currentUserId },
                    { $pull: { blockedUsers: new mongoose.Types.ObjectId(targetUserId) } },
                    { new: true }
                );

                if (!updatedUser) {
                    return NextResponse.json({ message: "Initiating user account profile context not found" }, { status: 404 });
                }

                return NextResponse.json({
                    success: true,
                    message: "Target user profile restriction lifted successfully."
                });
            }
        }

        // ==========================================
        // ACTION 3: USER/CLAN ACCOUNT REPORTING SYSTEM
        // ==========================================
        if (action === "report") {
            if (!reason?.trim()) {
                return NextResponse.json({ message: "Report reason is required" }, { status: 400 });
            }

            // Target verification based on context type (Fixes the structural 404 bug)
            let targetExists = false;
            if (isClan) {
                const Clan = mongoose.models.Clan;
                targetExists = Clan ? await Clan.exists({ _id: targetUserId }) : true;
            } else {
                targetExists = await MobileUser.exists({ _id: targetUserId });
            }

            if (!targetExists) {
                return NextResponse.json({ message: `Target ${isClan ? 'clan' : 'user'} profile not found` }, { status: 404 });
            }

            try {
                // Logs the record out cleanly with corrected reporter parameters
                await Report.create({
                    targetId: new mongoose.Types.ObjectId(targetUserId),
                    targetType: isClan ? "clan" : "user",
                    reporterFingerprint: currentUserId,
                    reporterUserId: currentUser._id, // Fixed: Now saves the actual reporter's _id
                    reason: reason.trim(),
                    status: "pending"
                });
            } catch (err) {
                if (err.code === 11000) {
                    return NextResponse.json({ message: "You have already filed a safety flag assessment against this profile." }, { status: 400 });
                }
                throw err;
            }

            return NextResponse.json({
                success: true,
                message: "Account behavior flagged. Violations tracked under safety guidelines."
            });
        }

        return NextResponse.json({ message: "Requested action processing framework unmapped" }, { status: 400 });

    } catch (err) {
        console.error("SAFETY_MUTATION_ROUTE_ERROR:", err);
        return NextResponse.json({ message: "Internal application services fault handling error", error: err.message }, { status: 500 });
    }
}
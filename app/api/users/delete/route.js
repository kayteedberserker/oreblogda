// app/api/user/delete/route.js
import connectDB from "app/lib/mongodb";
import ClanFollower from "app/models/ClanFollower";
import Clan from "app/models/ClanModel";
import ClanWar from "app/models/ClanWar";
import MessagePill from "app/models/MessagePillModel";
import MobileUser from "app/models/MobileUserModel";
import MonthlyHypeStat from "app/models/MonthlyHypeStat";
import Post from "app/models/PostModel";
import QuizEvent from "app/models/QuizEvent";
import ShoutoutEvent from "app/models/ShoutoutEvent";
import Tournament from "app/models/Tournament";
import mongoSanitize from "mongo-sanitize";
import { NextResponse } from "next/server";
import { z } from "zod";

// Validation Schemas matching your JSON Payload structure
const deleteSchema = z.object({
    userId: z.string().min(3),
    deviceId: z.string().min(3),
    pin: z.string().length(6)
});

const cancelSchema = z.object({
    userId: z.string().min(3),
    pin: z.string().length(6)
});

// ==========================================
// 1. THE DELETION ROUTE
// ==========================================
export async function DELETE(req) {
    try {
        await connectDB();

        // 1. Read, sanitize, and validate payload from body JSON
        const rawBody = await req.json();
        const cleanBody = mongoSanitize(rawBody);
        const validation = deleteSchema.safeParse(cleanBody);

        if (!validation.success) {
            return NextResponse.json({ error: "Invalid data formats or missing credentials." }, { status: 400 });
        }

        const { userId, deviceId, pin } = validation.data;

        // 2. Fetch User along with security properties
        const user = await MobileUser.findById(userId).select("+pin +loginAttempts +lockUntil");
        if (!user) {
            return NextResponse.json({ error: "User profile not found" }, { status: 404 });
        }

        // 3. Rate Limit / Brute-Force Check
        if (user.lockUntil && user.lockUntil > Date.now()) {
            const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
            return NextResponse.json({
                error: `SECURITY_LOCKOUT: Rate-limit reached. Try again in ${remainingMinutes} minutes.`
            }, { status: 429 });
        }

        // 4. Compare Security PIN using your model's native method
        const isMatch = await user.comparePin(pin);
        if (!isMatch) {
            const currentAttempts = (user.loginAttempts || 0) + 1;
            let lockUntil = user.lockUntil;

            if (currentAttempts >= 5) {
                lockUntil = Date.now() + 30 * 60 * 1000; // 30-minute lockout
            }

            await MobileUser.updateOne(
                { _id: user._id },
                { $set: { loginAttempts: currentAttempts, lockUntil } }
            );

            return NextResponse.json({
                error: "Incorrect security PIN",
                attemptsRemaining: Math.max(0, 5 - currentAttempts)
            }, { status: 401 });
        }

        // Reset Brute-force counters on verified action
        await MobileUser.updateOne(
            { _id: user._id },
            { $set: { loginAttempts: 0, lockUntil: null } }
        );

        // Set expiration thresholds
        const now = new Date();
        const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

        // IMMEDIATE DELETIONS
        await ClanFollower.deleteMany({ userId });
        await MessagePill.updateMany(
            { $or: [{ targetId: deviceId }, { targetId: userId }] },
            { expiresAt: now }
        );

        // CLAN LEADERSHIP & WAR HANDLING
        const userClans = await Clan.find({ leader: userId });
        for (const clan of userClans) {
            if (clan.viceLeader) {
                clan.leader = clan.viceLeader;
                clan.viceLeader = null;
                clan.members.pull(userId);
                await clan.save();
            } else {
                clan.willBeDeleted = true;
                clan.deleteAt = sevenDaysFromNow;
                await clan.save();

                await ClanWar.updateMany(
                    {
                        $or: [{ challengerTag: clan.tag }, { defenderTag: clan.tag }],
                        status: { $in: ["PENDING", "NEGOTIATING", "ACTIVE"] }
                    },
                    { status: "REJECTED", expiresAt: sevenDaysFromNow }
                );

                await Tournament.updateMany({ clanId: clan._id }, { expiresAt: now });
                await QuizEvent.updateMany({ clanId: clan._id }, { expiresAt: now });
                await ShoutoutEvent.updateMany({ clanId: clan._id }, { expiresAt: now });
            }
        }

        // TTL / 7-DAY SOFT DELETES
        await MonthlyHypeStat.updateMany({ entityId: userId }, { deleteAt: sevenDaysFromNow });
        await Post.updateMany({ authorUserId: userId }, { willBeDeleted: true, deleteAt: sevenDaysFromNow });

        await MobileUser.findByIdAndUpdate(userId, {
            willBeDeleted: true,
            deleteAt: sevenDaysFromNow
        });

        return NextResponse.json({ message: "Account scheduled for deletion successfully" }, { status: 200 });

    } catch (error) {
        console.error("Account Deletion Error:", error);
        return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
    }
}

// ==========================================
// 2. THE COUNTER ROUTE (CANCELLATION)
// ==========================================
export async function PATCH(req) {
    try {
        await connectDB();

        // 1. Read, sanitize, and validate payload from body JSON
        const rawBody = await req.json();
        const cleanBody = mongoSanitize(rawBody);
        const validation = cancelSchema.safeParse(cleanBody);

        if (!validation.success) {
            return NextResponse.json({ error: "Invalid data formats or missing credentials." }, { status: 400 });
        }

        const { userId, pin } = validation.data;

        // 2. Fetch User along with security properties
        const user = await MobileUser.findById(userId).select("+pin +loginAttempts +lockUntil +willBeDeleted");
        if (!user) {
            return NextResponse.json({ error: "User profile not found" }, { status: 404 });
        }

        // 3. Rate Limit / Brute-Force Check
        if (user.lockUntil && user.lockUntil > Date.now()) {
            const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / 60000);
            return NextResponse.json({
                error: `SECURITY_LOCKOUT: Rate-limit reached. Try again in ${remainingMinutes} minutes.`
            }, { status: 429 });
        }

        // 4. Compare PIN using native comparison method
        const isMatch = await user.comparePin(pin);
        if (!isMatch) {
            const currentAttempts = (user.loginAttempts || 0) + 1;
            let lockUntil = user.lockUntil;

            if (currentAttempts >= 5) {
                lockUntil = Date.now() + 30 * 60 * 1000;
            }

            await MobileUser.updateOne(
                { _id: user._id },
                { $set: { loginAttempts: currentAttempts, lockUntil } }
            );

            return NextResponse.json({
                error: "Incorrect security PIN",
                attemptsRemaining: Math.max(0, 5 - currentAttempts)
            }, { status: 401 });
        }

        if (!user.willBeDeleted) {
            return NextResponse.json({ error: "Account is already active" }, { status: 400 });
        }

        // Reset tracking parameters on success
        await MobileUser.updateOne(
            { _id: user._id },
            { $set: { loginAttempts: 0, lockUntil: null } }
        );

        // COUNTER-ACTION: Reverse the process cleanly
        await MobileUser.findByIdAndUpdate(userId, {
            willBeDeleted: false,
            $unset: { deleteAt: 1 }
        });

        await Post.updateMany({ authorUserId: userId }, { willBeDeleted: false, $unset: { deleteAt: 1 } });
        await MonthlyHypeStat.updateMany({ entityId: userId }, { $unset: { deleteAt: 1 } });
        await Clan.updateMany({ leader: userId, willBeDeleted: true }, { willBeDeleted: false, $unset: { deleteAt: 1 } });

        return NextResponse.json({ message: "Account termination cancelled. Status fully restored." }, { status: 200 });

    } catch (error) {
        console.error("Account Restoration Counter Error:", error);
        return NextResponse.json({ error: "Failed to cancel deletion process" }, { status: 500 });
    }
}
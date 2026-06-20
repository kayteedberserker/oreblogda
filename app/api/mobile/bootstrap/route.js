import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import UserStreak from "@/app/models/UserStreak";
import mongoose from 'mongoose';
import { NextResponse } from "next/server";

const VersionSchema = new mongoose.Schema({
    key: { type: String, default: 'latest_app_version' },
    appVersion: { type: String, required: true },
    runtimeVersion: { type: String, required: true },
    critical: { type: Boolean, default: false },
}, { timestamps: true });

const VersionModel = mongoose.models.Version || mongoose.model('Version', VersionSchema);

const calculatePeakLevel = (totalPurchased) => {
    if (!totalPurchased || totalPurchased < 1) return 0;
    if (totalPurchased < 1000) return 1;
    if (totalPurchased < 5000) return 2;
    if (totalPurchased < 10000) return 3;
    if (totalPurchased < 25000) return 4;
    if (totalPurchased < 50000) return 5;
    if (totalPurchased < 100000) return 6;
    if (totalPurchased < 250000) return 7;
    if (totalPurchased < 500000) return 8;
    if (totalPurchased < 1000000) return 9;
    return 10;
};

function addCorsHeaders(response) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
    return response;
}

export async function OPTIONS() { return addCorsHeaders(new NextResponse(null, { status: 204 })); }

export async function POST(req) {
    try {
        await connectDB();
        const { deviceId, pushToken, platform } = await req.json();

        if (!deviceId) return addCorsHeaders(NextResponse.json({ error: "Missing deviceId" }, { status: 400 }));

        const now = new Date();
        const sixtyDaysAgo = new Date(now);
        sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

        let user = await MobileUser.findOne({ deviceId }).lean();
        let isNewUser = false;

        if (!user) {
            let randNum = Math.floor(Math.random() * 10000000);
            const newUser = await MobileUser.create({ deviceId, username: `User${randNum}` });
            user = newUser.toObject();
            isNewUser = true;
        }

        let validInventory = user.inventory || [];
        let inventoryNeedsUpdate = false;

        // Clean expired inventory items
        if (validInventory.length > 0) {
            validInventory = validInventory.filter(item => {
                if (item.expiresAt && new Date(item.expiresAt) < now) {
                    inventoryNeedsUpdate = true;
                    return false;
                }
                return true;
            });
            if (inventoryNeedsUpdate) user.inventory = validInventory;
        }

        let updateQuery = { $set: { lastActive: now } };
        let hasReturned = false;

        // =======================================================================
        // ⚡️ RETURNER REWARD PROTOCOL (28+ Days Inactive)
        // =======================================================================
        if (!isNewUser && user.lastActive) {
            const daysSinceLastActive = (now.getTime() - new Date(user.lastActive).getTime()) / (1000 * 60 * 60 * 24);

            if (daysSinceLastActive >= 28) {
                hasReturned = true;

                // 1. Double Streak for 7 days
                const doubleStreakDate = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                updateQuery.$set.doubleStreakUntil = doubleStreakDate;
                user.doubleStreakUntil = doubleStreakDate; // Update memory for response

                // 2. Grant 2 Free Hypes
                const existingHype = validInventory.find(item => item.itemId === 'hype_free');
                if (existingHype) {
                    existingHype.itemCount = (existingHype.itemCount || 1) + 2;
                } else {
                    validInventory.push({
                        itemId: `hype_free`,
                        name: `Free Hype`,
                        category: 'HYPE',
                        rarity: 'RARE',
                        hypeType: 'FREE',
                        visualConfig: {
                            primaryColor: '#22c55e',
                            isAnimated: false
                        },
                        itemCount: 2,
                        acquiredAt: now,
                        expiresAt: null,
                        isConsumable: true
                    });
                }
                inventoryNeedsUpdate = true;

                // 3. Grant "Resurrected" Title
                user.unlockedTitles = user.unlockedTitles || [];
                const hasResurrectedTitle = user.unlockedTitles.some(t => t.name === 'Resurrected');

                if (!hasResurrectedTitle) {
                    const resTitle = { name: 'Resurrected', tier: 'Epic' };
                    user.unlockedTitles.push(resTitle);
                    user.equippedTitle = resTitle;

                    updateQuery.$set.unlockedTitles = user.unlockedTitles;
                    updateQuery.$set.equippedTitle = resTitle;
                }
            }
        }

        if (pushToken) updateQuery.$set.pushToken = pushToken;
        if (platform) updateQuery.$set.platform = platform;
        if (inventoryNeedsUpdate) updateQuery.$set.inventory = validInventory;

        const lastLogEntry = user?.activityLog?.[user.activityLog?.length - 1];
        const shouldLog = isNewUser || !lastLogEntry || new Date(lastLogEntry) < oneHourAgo;

        if (shouldLog) {
            updateQuery.$inc = { appOpens: 1 };
            let newActivityLog = user.activityLog || [];
            newActivityLog.push(now);
            newActivityLog = newActivityLog.filter(date => new Date(date) >= sixtyDaysAgo);
            updateQuery.$set.activityLog = newActivityLog;
        }

        const [updateResult, streakDoc, versionConfig] = await Promise.all([
            MobileUser.updateOne({ _id: user._id }, updateQuery),
            UserStreak.findOne({ userId: user._id }).lean(),
            VersionModel.findOne({ key: 'latest_app_version' }).lean()
        ]);

        const rawEvents = [];
        const activeEvents = rawEvents.filter(event => !event.endsAt || new Date(event.endsAt) > now).map(event => ({
            ...event,
            isComing: event.startsAt && new Date(event.startsAt) > now,
            status: (event.startsAt && new Date(event.startsAt) > now) ? 'coming_soon' : 'active'
        }));

        const systemVersion = versionConfig || { appVersion: "1.0.0", runtimeVersion: "v1", critical: false };

        // =======================================================================
        // ⚡️ CRITICAL PAYLOAD OPTIMIZATION: UNCONDITIONALLY STRIP SVGS
        // =======================================================================
        const safeInventoryPayload = validInventory.map(item => {
            const safeItem = item.toObject ? item.toObject() : { ...item };

            // Completely destroy the SVG string payload to prevent network truncation crashes
            if (safeItem.visualConfig) {
                safeItem.visualConfig = { ...safeItem.visualConfig };
                delete safeItem.visualConfig.svgCode;
            }

            // Catching any edge cases where it's stored in visualData instead
            if (safeItem.visualData) {
                safeItem.visualData = { ...safeItem.visualData };
                delete safeItem.visualData.svgCode;
            }

            return safeItem;
        });

        return addCorsHeaders(NextResponse.json({
            success: true,
            system: { appVersion: systemVersion.appVersion, runtimeVersion: systemVersion.runtimeVersion, critical: systemVersion.critical },
            // ⚡️ Added `hasReturned` to the activity block for your frontend check
            activity: { recorded: shouldLog, pushTokenUpdated: !!pushToken, hasReturned },
            user: { ...user, country: user.country || "Unknown", securityLevel: user.securityLevel || 0, inventory: safeInventoryPayload },
            coins: {
                balance: user.coins || 0,
                tokens: user.tokens || 0,
                clanBalance: user.clanCoins || 0,
                totalPurchasedCoins: user.totalPurchasedCoins || 0,
                peakLevel: calculatePeakLevel(user.totalPurchasedCoins || 0),
                doubleStreakUntil: user.doubleStreakUntil || null
            },
            streak: {
                streak: streakDoc?.streak || 0,
                lastPostDate: streakDoc?.lastPostDate || null,
                expiresAt: streakDoc?.expiresAt || null,
                canRestore: !streakDoc && (user.lastStreak > 0),
                recoverableStreak: user.lastStreak || 0
            },
            events: activeEvents
        }));

    } catch (err) {
        console.error("Bootstrap Error:", err);
        return addCorsHeaders(NextResponse.json({ error: "Internal Server Error" }, { status: 500 }));
    }
}
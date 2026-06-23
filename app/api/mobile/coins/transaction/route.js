import { sendPillParallel } from '@/app/lib/messagePillService';
import connectDB from '@/app/lib/mongodb';
import { sendPushNotification } from '@/app/lib/pushNotifications';
import ClanFollower from '@/app/models/ClanFollower';
import Clan from '@/app/models/ClanModel';
import ClanTopup from '@/app/models/ClanTopup';
import MobileUser from '@/app/models/MobileUserModel';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer'; // Assuming you have this imported for your emails

const OC_VALUES = {
    'daily_login': 10,
    'daily_login_7': 50,
    "1kpostevent": 1000,
    'streak_restore': 50,
    'create_clan': 250,
    'extra_slot': 20,
    'clan_war': 20,
};

// ⚡️ NEW: Peak Level Calculation Logic
// Level 1 now strictly requires at least 1 purchased coin.
const PEAK_THRESHOLDS = [1, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];

const calculatePeakLevel = (totalPurchased) => {
    if (!totalPurchased || totalPurchased < 1) return 0; // 0 = No Peak Badge
    if (totalPurchased < 1000) return 1;
    if (totalPurchased < 5000) return 2;
    if (totalPurchased < 10000) return 3;
    if (totalPurchased < 25000) return 4;
    if (totalPurchased < 50000) return 5;
    if (totalPurchased < 100000) return 6;
    if (totalPurchased < 250000) return 7;
    if (totalPurchased < 500000) return 8;
    if (totalPurchased < 1000000) return 9;
    return 10; // Max level
};

// --- GET HANDLER: FETCH BALANCE & INFO ---
export async function GET(req) {
    try {
        await connectDB();

        // Extract deviceId from URL query parameters
        const { searchParams } = new URL(req.url);
        const deviceId = searchParams.get('deviceId');

        if (!deviceId) {
            return NextResponse.json({ error: 'Device ID required' }, { status: 400 });
        }

        const user = await MobileUser.findOne({ deviceId });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        // Always calculate the accurate peak level just in case
        const currentPeak = calculatePeakLevel(user.totalPurchasedCoins || 0);

        return NextResponse.json({
            success: true,
            balance: user.coins || 0,
            tokens: user.tokens || 0,
            clanBalance: user.clanCoins || 0,
            inventory: user.inventory || [],
            doubleStreakUntil: user.doubleStreakUntil,
            totalPurchasedCoins: user.totalPurchasedCoins || 0,
            peakLevel: currentPeak // ⚡️ Return peak info so the app context updates instantly
        });

    } catch (error) {
        console.error("GET Balance Error:", error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

// 🏆 Transaction Title Thresholds
const TITLE_THRESHOLDS = {
    // For Buying Coins (IAP)
    totalPurchasedCoins: [
        { limit: 1000, name: "Patron", tier: "COMMON" },
        { limit: 10000, name: "Ore-Magnate", tier: "RARE" },
        { limit: 50000, name: "The Exalted", tier: "EPIC" },
        { limit: 100000, name: "System Benefactor", tier: "LEGENDARY" }
    ],
    // For Spending Coins (Shop/Inventory)
    lifetimeCoinsSpent: [
        { limit: 1, name: "First Blood", tier: "COMMON" },
        { limit: 5000, name: "Shop regular", tier: "RARE" },
        { limit: 25000, name: "Big Spender", tier: "EPIC" },
        { limit: 100000, name: "Gilded Collector", tier: "LEGENDARY" }
    ]
};

// 🛠 Helper to check and award titles using parallel notification stack
async function checkTitleUnlocks(user, field, currentCount) {
    const thresholds = TITLE_THRESHOLDS[field];
    if (!thresholds) return null;

    const earnedTitle = [...thresholds].reverse().find(t => currentCount >= t.limit);

    if (earnedTitle) {
        const alreadyHas = user.unlockedTitles?.some(t => t.name === earnedTitle.name);
        if (!alreadyHas) {
            await MobileUser.findByIdAndUpdate(user._id, {
                $addToSet: { unlockedTitles: earnedTitle }
            });

            // 🔔 Handle Notifications for Title Unlock
            if (user.pushToken) {
                const titleMsg = `🏆 NEW TITLE: You have received the "${earnedTitle.name}" TITLE!`;

                // UI Pill
                await sendPillParallel(
                    [user.pushToken],
                    "Title Earned",
                    titleMsg,
                    { type: "achievement" },
                    {
                        type: 'achievement',
                        targetAudience: 'user',
                        targetId: user._id.toString(),
                        singleUser: true,
                        priority: 3
                    }
                );
            }
            return earnedTitle;
        }
    }
    return null;
}

// Ensure you have these environment variables set:
// REVENUECAT_API_KEY (Your v1 Secret Key)
// MAILEREMAIL, MAILERPASS

export async function POST(req) {
    try {
        await connectDB();
        const body = await req.json();

        // ⚡️ Added expiresInDays to the destructured body
        const { deviceId, action, type, packId, coinType, itemId, price, name, category, rarity, visualConfig, rewards, payload, expiresInDays } = body;

        // Note: For complex multi-user transactions like 'transfer', findOne is okay, 
        // but for individual updates, findOneAndUpdate is safer.
        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // --- ACTION: TRANSFER OC TO ANOTHER USER ---
        if (action === 'transfer') {
            const { recipientId, amount } = payload;
            const transferAmount = parseInt(amount);

            if (isNaN(transferAmount) || transferAmount <= 0) {
                return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
            }

            if ((user.coins || 0) < transferAmount) {
                return NextResponse.json({ error: 'Insufficient OC reserves' }, { status: 400 });
            }

            const recipient = await MobileUser.findById(recipientId);
            if (!recipient) {
                return NextResponse.json({ error: 'Target shinobi not found' }, { status: 404 });
            }

            // Perform atomic updates
            user.coins -= transferAmount;
            recipient.coins = (recipient.coins || 0) + transferAmount;

            await user.save();
            await recipient.save();

            try {
                if (recipient.pushToken) {
                    await sendPushNotification(
                        recipient.pushToken,
                        "Energy Received!",
                        `${user.username} has transferred ${transferAmount} OC to your vault.`,
                        { type: "COIN_TRANSFER", sender: user.username }
                    );
                }
            } catch (pushErr) {
                console.error("🔔 Push failed but transfer succeeded:", pushErr);
            }

            return NextResponse.json({
                success: true,
                newBalance: user.coins,
                message: `Transferred ${transferAmount} OC to ${recipient.username}`
            });
        }

        // --- ACTION: BUY ITEM ---
        if (action === 'buy_item') {
            const isCC = coinType === 'CC' || body.currency === 'CC';
            const balanceKey = isCC ? 'clanCoins' : 'coins';

            if ((user[balanceKey] || 0) < price) {
                return NextResponse.json({ error: `Insufficient ${isCC ? 'CC' : 'OC'}` }, { status: 400 });
            }

            // Tracking lifetime spend for Titles (Usually tracked in OC)
            let spendIncrement = !isCC ? price : 0;

            const existingItemIndex = user.inventory?.findIndex(i => i.itemId === itemId);

            if (existingItemIndex > -1) {
                if (!expiresInDays) {
                    return NextResponse.json({ error: 'Already owned permanently' }, { status: 400 });
                } else {
                    const existingItem = user.inventory[existingItemIndex];
                    let newExpiryDate = (existingItem.expiresAt && new Date(existingItem.expiresAt) > new Date())
                        ? new Date(existingItem.expiresAt)
                        : new Date();

                    newExpiryDate.setDate(newExpiryDate.getDate() + parseInt(expiresInDays));

                    // Atomic update for extension
                    const updatedUser = await MobileUser.findOneAndUpdate(
                        { deviceId, "inventory.itemId": itemId },
                        {
                            $inc: { [balanceKey]: -price, lifetimeCoinsSpent: spendIncrement },
                            $set: { "inventory.$.expiresAt": newExpiryDate }
                        },
                        { new: true }
                    );

                    // 🏆 Check Titles with fresh data
                    await checkTitleUnlocks(updatedUser, "lifetimeCoinsSpent", updatedUser.lifetimeCoinsSpent);

                    return NextResponse.json({
                        success: true,
                        balance: updatedUser.coins,
                        clanBalance: updatedUser.clanCoins,
                        inventory: updatedUser.inventory
                    });
                }
            }

            // Logic for NOT owned
            let expiryDate = null;
            if (expiresInDays) {
                expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + parseInt(expiresInDays));
            }

            const newItem = {
                itemId,
                name: name || 'Unnamed Item',
                category,
                rarity,
                visualConfig: {
                    svgCode: visualConfig?.svgCode || '',
                    lottieUrl: visualConfig?.lottieUrl || '',
                    primaryColor: visualConfig?.primaryColor || visualConfig?.color || '#22c55e',
                    secondaryColor: visualConfig?.secondaryColor || null,
                    animationType: visualConfig?.animationType || null,
                    duration: visualConfig?.duration,
                    zoom: visualConfig?.zoom || null,
                    opacity: visualConfig?.opacity || null,
                    offsetY: visualConfig?.offsetY || null,
                    snakeLength: visualConfig?.snakeLength,
                    isAnimated: visualConfig?.isAnimated || !!(visualConfig?.animated || visualConfig?.animationType)
                },
                acquiredAt: new Date(),
                expiresAt: expiryDate
            };

            const updatedUser = await MobileUser.findOneAndUpdate(
                { deviceId },
                {
                    $inc: { [balanceKey]: -price, lifetimeCoinsSpent: spendIncrement },
                    $push: { inventory: newItem }
                },
                { new: true }
            );

            await checkTitleUnlocks(updatedUser, "lifetimeCoinsSpent", updatedUser.lifetimeCoinsSpent);

            return NextResponse.json({
                success: true,
                balance: updatedUser.coins,
                clanBalance: updatedUser.clanCoins,
                inventory: updatedUser.inventory
            });
        }

        // --- ACTION: PURCHASE PACK ---
        if (action === 'purchase_pack') {
            const packData = rewards || payload?.rewards;
            if (!packData) return NextResponse.json({ error: 'Pack data missing' }, { status: 400 });

            if (user.purchasedPacks?.includes(packId)) {
                return NextResponse.json({ error: 'Pack already purchased' }, { status: 400 });
            }

            // 🛡️ SECURITY VERIFICATION: Validate IAP tokens with RevenueCat
            const { appUserId, transactionId } = payload || body || {};

            if (!appUserId || !transactionId) {
                return NextResponse.json({ error: "TRANSMISSION REJECTED: Missing receipt tokens." }, { status: 400 });
            }

            try {
                const rcResponse = await fetch(`https://api.revenuecat.com/v1/subscribers/${appUserId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${process.env.REVENUECAT_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!rcResponse.ok) {
                    return NextResponse.json({ error: "VERIFICATION FAILURE: Validation server unreachable." }, { status: 400 });
                }

                const rcData = await rcResponse.json();
                const nonSubscriptions = rcData.subscriber?.non_subscriptions || {};

                // Frontend might pass the package identifier in 'type' or 'packId'
                const productPurchases = nonSubscriptions[type] || nonSubscriptions[packId];
                if (!productPurchases || productPurchases.length === 0) {
                    return NextResponse.json({ error: "VERIFICATION FAILURE: Purchase matching identifier not found." }, { status: 400 });
                }

                const transactionExists = productPurchases.some(p => p.id === transactionId);
                if (!transactionExists) {
                    return NextResponse.json({ error: "VERIFICATION FAILURE: Malformed purchase transaction token." }, { status: 400 });
                }
            } catch (verificationErr) {
                console.error("RevenueCat transaction authorization failed:", verificationErr);
                return NextResponse.json({ error: "VERIFICATION OFFLINE: Security processing error." }, { status: 500 });
            }

            // Since packs have multiple different reward types, we'll keep the loop but save once at the end
            packData.forEach(reward => {
                if (reward.type === 'OC') {
                    user.coins = (user.coins || 0) + reward.amount;
                }
                if (reward.type === 'MULTIPLIER') {
                    const now = user.doubleStreakUntil && user.doubleStreakUntil > new Date()
                        ? new Date(user.doubleStreakUntil)
                        : new Date();
                    now.setDate(now.getDate() + (reward.duration || 7));
                    user.doubleStreakUntil = now;
                }

                const inventoryCategories = ['WATERMARK', 'BADGE', 'BORDER', 'GLOW', 'BACKGROUND'];
                if (inventoryCategories.includes(reward.type)) {
                    const alreadyHasItem = user.inventory.some(inv => inv.itemId === reward.id);
                    if (!alreadyHasItem) {
                        let expiryDate = null;
                        if (reward.expiresInDays) {
                            expiryDate = new Date();
                            expiryDate.setDate(expiryDate.getDate() + parseInt(reward.expiresInDays));
                        }

                        user.inventory.push({
                            itemId: reward.id,
                            name: reward.name,
                            category: reward.type,
                            visualConfig: {
                                svgCode: reward.visualConfig?.svgCode || '',
                                lottieUrl: reward.visualConfig?.lottieUrl || '',
                                primaryColor: reward.visualConfig?.primaryColor || '#ffffff',
                                secondaryColor: reward.visualConfig?.secondaryColor || null,
                                animationType: reward.visualConfig?.animationType || null,
                                duration: reward.visualConfig?.duration || 3000,
                                isAnimated: reward.visualConfig?.isAnimated || false
                            },
                            acquiredAt: new Date(),
                            expiresAt: expiryDate
                        });
                    }
                }
            });

            if (!user.purchasedPacks) user.purchasedPacks = [];
            user.purchasedPacks.push(packId);

            await user.save();
            return NextResponse.json({
                success: true,
                balance: user.coins,
                inventory: user.inventory,
                doubleStreakUntil: user.doubleStreakUntil
            });
        }

        // --- ACTION: BUY COINS (IAP) ---
        if (action === 'buy_coins') {
            // 🛡️ SECURITY VERIFICATION: Validate IAP tokens with RevenueCat
            const { appUserId, transactionId } = payload || body || {};

            if (!appUserId || !transactionId) {
                return NextResponse.json({ error: "TRANSMISSION REJECTED: Missing receipt tokens." }, { status: 400 });
            }

            try {
                const rcResponse = await fetch(`https://api.revenuecat.com/v1/subscribers/${appUserId}`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${process.env.REVENUECAT_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                });

                if (!rcResponse.ok) {
                    return NextResponse.json({ error: "VERIFICATION FAILURE: Validation server unreachable." }, { status: 400 });
                }

                const rcData = await rcResponse.json();
                const nonSubscriptions = rcData.subscriber?.non_subscriptions || {};

                const productPurchases = nonSubscriptions[type];
                if (!productPurchases || productPurchases.length === 0) {
                    return NextResponse.json({ error: "VERIFICATION FAILURE: Purchase matching identifier not found." }, { status: 400 });
                }

                const transactionExists = productPurchases.some(p => p.id === transactionId);
                if (!transactionExists) {
                    return NextResponse.json({ error: "VERIFICATION FAILURE: Malformed purchase transaction token." }, { status: 400 });
                }
            } catch (verificationErr) {
                console.error("RevenueCat transaction authorization failed:", verificationErr);
                return NextResponse.json({ error: "VERIFICATION OFFLINE: Security processing error." }, { status: 500 });
            }

            const matchedNumbers = type.match(/\d+/);
            const amount = matchedNumbers ? parseInt(matchedNumbers[0], 10) : 0;
            let purchasedCurrency = 'OC';

            const updateQuery = { $inc: { totalPurchasedCoins: amount } };

            if (type.toLowerCase().includes('clan') || coinType === 'CC') {
                updateQuery.$inc.clanCoins = amount;
                purchasedCurrency = 'Clan Coins (CC)';
            } else {
                updateQuery.$inc.coins = amount;
            }

            const updatedUser = await MobileUser.findOneAndUpdate(
                { deviceId },
                updateQuery,
                { new: true }
            );

            // Recalculate Peak Level based on fresh data
            updatedUser.peakLevel = calculatePeakLevel(updatedUser.totalPurchasedCoins);
            await updatedUser.save();

            // ⚡️ SHARP FIX: Handle multiple clans, check verified statuses, apply store cut, and notify leaders
            try {
                const activeMemberships = await ClanFollower.find({ userId: updatedUser._id });

                for (const membership of activeMemberships) {
                    // Check if this explicit clan tag actually exists and is verified
                    const clan = await Clan.findOne({ tag: membership.clanTag });

                    if (clan && clan.verifiedClan) {
                        // Log explicit ledger record for this specific verified clan association
                        await ClanTopup.create({
                            userId: updatedUser._id,
                            clanTag: clan.tag,
                            amount: amount
                        });

                        // Financial Splitting Logic: Deduct 30% App Store cut first, then calculate the dynamic percentage based on collab settings
                        const netCoins = amount * 0.7;
                        const currentCollabPercentage = clan.collabPercentage !== undefined ? clan.collabPercentage : 20;
                        const finalLeaderShare = Math.floor(netCoins * (currentCollabPercentage / 100));

                        // Look up the leader to push instant real-time financial pills
                        const leaderUser = await MobileUser.findById(clan.leader);
                        if (leaderUser && leaderUser.pushToken) {
                            await sendPillParallel(
                                [leaderUser.pushToken],
                                "Clan Revenue Dispatched! 💰",
                                `Clan member @${updatedUser.username || 'A follower'} purchased ${amount} Coins! Your ${currentCollabPercentage}% share (after 30% store cut) is +${finalLeaderShare} Coins.`,
                                { screen: "CollabsDashboard", clanTag: clan.tag },
                                {
                                    type: "clan_points",
                                    targetId: leaderUser._id.toString(),
                                    targetAudience: "user",
                                    singleUser: true,
                                    priority: 3
                                }
                            );
                        }
                    }
                }
            } catch (clanLogErr) {
                console.error("Failed handling multi-clan verification/notification ledger loop:", clanLogErr);
            }

            // 🏆 Check Titles
            await checkTitleUnlocks(updatedUser, "totalPurchasedCoins", updatedUser.totalPurchasedCoins);

            // Email Logic
            try {
                const transporter = nodemailer.createTransport({
                    service: "gmail",
                    auth: { user: process.env.MAILEREMAIL, pass: process.env.MAILERPASS },
                });

                const mailOptions = {
                    from: `"O hablo" <${process.env.MAILEREMAIL}>`,
                    to: "Admins",
                    bcc: ["kayteedberserker@gmail.com"],
                    subject: `💰 New Coin Purchase Alert!`,
                    html: `
<h2>New In-App Purchase!</h2>
<p><strong>User:</strong> ${updatedUser.username || 'Unknown User'} (Device ID: ${deviceId})</p>
<p><strong>Package Type:</strong> ${type}</p>
<p><strong>Amount Gained:</strong> ${amount} ${purchasedCurrency}</p>
<p><strong>New Peak Level:</strong> ${updatedUser.peakLevel}</p>
`
                };
                await transporter.sendMail(mailOptions);
            } catch (emailErr) {
                console.error("Coin purchase email notification failed:", emailErr);
            }

            return NextResponse.json({
                success: true,
                newBalance: updatedUser.coins,
                newClanBalance: updatedUser.clanCoins,
                totalPurchasedCoins: updatedUser.totalPurchasedCoins,
                peakLevel: updatedUser.peakLevel
            });
        }

        // --- ACTION: CLAIM ---
        if (action === 'claim') {
            console.log(`Processing claim for user ${user.username} with claim type: ${type}`);
            // 1. Handle Event claims separately (Non-daily login claims)
            if (type !== 'daily_login' && type !== 'daily_login_7') {
                const amount = OC_VALUES[type];
                if (!amount) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

                if (!user.claimedEvents) user.claimedEvents = [];
                if (user.claimedEvents.some(event => event.eventId === type)) {
                    return NextResponse.json({ error: 'Reward already claimed.' }, { status: 400 });
                }
                user.claimedEvents.push({ eventId: type });
                user.coins = (user.coins || 0) + amount;

                await user.save();
                return NextResponse.json({ success: true, newBalance: user.coins });
            }

            // 2. Handle Scheduled Daily Login Reward Engine
            const today = new Date().setHours(0, 0, 0, 0);
            if (user.lastClaimedDate && new Date(user.lastClaimedDate).setHours(0, 0, 0, 0) === today) {
                return NextResponse.json({ error: 'Already claimed today' }, { status: 400 });
            }

            user.lastClaimedDate = new Date();
            // Server-side continuous rotation layout logic
            user.consecutiveStreak = (user.consecutiveStreak >= 7) ? 1 : (user.consecutiveStreak || 0) + 1;

            // Helper function to inject the strict FREE Hype item structure
            const pushFreeHype = (usr) => {
                if (!usr.inventory) usr.inventory = [];

                // Check if the user already has a 'hype_free' item in their inventory
                const existingHype = usr.inventory.find(item => item.itemId === 'hype_free');

                if (existingHype) {
                    // If it exists, simply increment the itemCount
                    existingHype.itemCount = (existingHype.itemCount || 1) + 1;
                } else {
                    // If it doesn't exist, create it with itemCount set to 1
                    const newFreeHypeProduct = {
                        itemId: `hype_free`,
                        name: `Free Hype`,
                        category: 'HYPE',
                        rarity: 'RARE',
                        hypeType: 'FREE',
                        visualConfig: {
                            primaryColor: '#22c55e',
                            isAnimated: false
                        },
                        itemCount: 1,
                        acquiredAt: new Date(),
                        expiresAt: null,
                        isConsumable: true
                    };
                    usr.inventory.push(newFreeHypeProduct);
                }
            };

            // 3. Process rewards purely by looking up the calculated consecutive streak day
            const currentDay = user.consecutiveStreak;

            if (currentDay === 7) {
                // Day 7 grants BOTH 10 OC and 1 FREE Hype item
                user.coins = (user.coins || 0) + 10;
                pushFreeHype(user);
            }
            else {
                user.coins = (user.coins || 0) + 5;
            }

            await user.save();
            return NextResponse.json({
                success: true,
                newBalance: user.coins,
                inventory: user.inventory,
                consecutiveStreak: user.consecutiveStreak
            });
        }

        // --- ACTION: SPEND ---
        if (action === 'spend') {
            const amount = OC_VALUES[type];
            if (user.coins < amount) return NextResponse.json({ error: 'Insufficient OC' }, { status: 400 });

            const updatedUser = await MobileUser.findOneAndUpdate(
                { deviceId },
                {
                    $inc: { coins: -amount, lifetimeCoinsSpent: amount }
                },
                { new: true }
            );

            await checkTitleUnlocks(updatedUser, "lifetimeCoinsSpent", updatedUser.lifetimeCoinsSpent);
            return NextResponse.json({ success: true, newBalance: updatedUser.coins });
        }

        // --- ACTION: REFUND ---
        if (action === 'refund') {
            const amount = OC_VALUES[type];
            const updatedUser = await MobileUser.findOneAndUpdate(
                { deviceId },
                {
                    // Merged duplicate $inc objects into one valid structure
                    $inc: { coins: amount, lifetimeCoinsSpent: -amount }
                },
                { new: true }
            );

            return NextResponse.json({ success: true, newBalance: updatedUser.coins });
        }

        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error("Transaction Error:", error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
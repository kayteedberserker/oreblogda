import { sendPillParallel } from '@/app/lib/messagePillService';
import connectDB from '@/app/lib/mongodb';
import { sendPushNotification } from '@/app/lib/pushNotifications';
import ClanFollower from '@/app/models/ClanFollower';
import Clan from '@/app/models/ClanModel';
import ClanTopup from '@/app/models/ClanTopup';
import MobileUser from '@/app/models/MobileUserModel';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const OC_VALUES = {
    'daily_login': 10,
    'daily_login_7': 50,
    "1kpostevent": 1000,
    'create_clan': 250,
    'extra_slot': 20,
    'clan_war': 20,
};

const PEAK_THRESHOLDS = [1, 1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000, 1000000];

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

export async function GET(req) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const deviceId = searchParams.get('deviceId');

        if (!deviceId) {
            return NextResponse.json({ error: 'Device ID required' }, { status: 400 });
        }

        const user = await MobileUser.findOne({ deviceId });
        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const currentPeak = calculatePeakLevel(user.totalPurchasedCoins || 0);

        return NextResponse.json({
            success: true,
            balance: user.coins || 0,
            tokens: user.tokens || 0,
            clanBalance: user.clanCoins || 0,
            inventory: user.inventory || [],
            doubleStreakUntil: user.doubleStreakUntil,
            totalPurchasedCoins: user.totalPurchasedCoins || 0,
            peakLevel: currentPeak
        });

    } catch (error) {
        console.error("GET Balance Error:", error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}

const TITLE_THRESHOLDS = {
    totalPurchasedCoins: [
        { limit: 1000, name: "Patron", tier: "COMMON" },
        { limit: 10000, name: "Ore-Magnate", tier: "RARE" },
        { limit: 50000, name: "The Exalted", tier: "EPIC" },
        { limit: 100000, name: "System Benefactor", tier: "LEGENDARY" }
    ],
    lifetimeCoinsSpent: [
        { limit: 1, name: "First Blood", tier: "COMMON" },
        { limit: 5000, name: "Shop regular", tier: "RARE" },
        { limit: 25000, name: "Big Spender", tier: "EPIC" },
        { limit: 100000, name: "Gilded Collector", tier: "LEGENDARY" }
    ]
};

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

            if (user.pushToken) {
                const titleMsg = `🏆 NEW TITLE: You have received the "${earnedTitle.name}" TITLE!`;
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

export async function POST(req) {
    try {
        await connectDB();
        const body = await req.json();

        const { deviceId, action, type, packId, coinType, itemId, price, name, category, rarity, visualConfig, rewards, payload, expiresInDays } = body;

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
            let finalPrice = price;
            let targetItemId = itemId;
            let isCC = coinType === 'CC' || body.currency === 'CC';

            // =======================================================================
            // ⚡️ STREAK INTERCEPTIONS (USER ONLY OVERRIDES)
            // =======================================================================
            if (targetItemId === 'streak_freeze' || targetItemId === 'streak_restore') {
                isCC = false; // Guard guarantee
            }

            if (targetItemId === 'streak_freeze') {
                finalPrice = 50; // Lock structural fee to 50 OC
            }
            else if (targetItemId === 'streak_restore') {
                const streakScore = user.lastStreak || 0;
                if (streakScore <= 0) {
                    return NextResponse.json({ error: "No broken streak available to restore in neural logs." }, { status: 400 });
                }

                // 🛡️ TWICE-WEEKLY LIMIT ENFORCEMENT
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
                const recentRestoresCount = user.coinTransactionHistory?.filter(tx =>
                    tx.type === 'STREAK_RESTORE' && tx.date && new Date(tx.date) >= sevenDaysAgo
                ).length || 0;

                if (recentRestoresCount >= 2) {
                    return NextResponse.json({ error: "Weekly limit exceeded. Max 2 restores allowed per rolling 7 days." }, { status: 429 });
                }

                // Progressive Pricing Scale Mapped to 1 OC = $0.005 parity
                if (streakScore <= 15) finalPrice = 100;       // 1 - 15 posts ($0.49)
                else if (streakScore <= 50) finalPrice = 300;  // 16 - 50 posts ($1.49)
                else if (streakScore <= 100) finalPrice = 600; // 51 - 100 posts ($2.99)
                else finalPrice = 1000;                        // 101+ posts ($4.99 Cap)
            }

            const balanceKey = isCC ? 'clanCoins' : 'coins';

            if ((user[balanceKey] || 0) < finalPrice) {
                return NextResponse.json({ error: `Insufficient ${isCC ? 'CC' : 'OC'}` }, { status: 400 });
            }

            let spendIncrement = !isCC ? finalPrice : 0;
            const existingItemIndex = user.inventory?.findIndex(i => i.itemId === targetItemId);

            // Item Stacking / Extension logic
            if (existingItemIndex > -1) {
                // Stackable count items like Hype or Streak modifiers can pile up
                if (targetItemId === 'streak_freeze' || targetItemId === 'streak_restore') {
                    const updatedUser = await MobileUser.findOneAndUpdate(
                        { deviceId, "inventory.itemId": targetItemId },
                        {
                            $inc: {
                                [balanceKey]: -finalPrice,
                                lifetimeCoinsSpent: spendIncrement,
                                "inventory.$.itemCount": 1
                            }
                        },
                        { new: true }
                    );

                    // Manually track inside ledger history for the rolling cap filter
                    updatedUser.coinTransactionHistory.push({
                        action: "SPENT",
                        type: targetItemId.toUpperCase(),
                        amount: finalPrice,
                        date: new Date()
                    });
                    await updatedUser.save();

                    await checkTitleUnlocks(updatedUser, "lifetimeCoinsSpent", updatedUser.lifetimeCoinsSpent);
                    return NextResponse.json({ success: true, balance: updatedUser.coins, clanBalance: updatedUser.clanCoins, inventory: updatedUser.inventory });
                }

                if (!expiresInDays) {
                    return NextResponse.json({ error: 'Already owned permanently' }, { status: 400 });
                } else {
                    const existingItem = user.inventory[existingItemIndex];
                    let newExpiryDate = (existingItem.expiresAt && new Date(existingItem.expiresAt) > new Date())
                        ? new Date(existingItem.expiresAt)
                        : new Date();

                    newExpiryDate.setDate(newExpiryDate.getDate() + parseInt(expiresInDays));

                    const updatedUser = await MobileUser.findOneAndUpdate(
                        { deviceId, "inventory.itemId": targetItemId },
                        {
                            $inc: { [balanceKey]: -finalPrice, lifetimeCoinsSpent: spendIncrement },
                            $set: { "inventory.$.expiresAt": newExpiryDate }
                        },
                        { new: true }
                    );

                    await checkTitleUnlocks(updatedUser, "lifetimeCoinsSpent", updatedUser.lifetimeCoinsSpent);
                    return NextResponse.json({ success: true, balance: updatedUser.coins, clanBalance: updatedUser.clanCoins, inventory: updatedUser.inventory });
                }
            }

            let expiryDate = null;
            if (expiresInDays) {
                expiryDate = new Date();
                expiryDate.setDate(expiryDate.getDate() + parseInt(expiresInDays));
            }

            const newItem = {
                itemId: targetItemId,
                name: targetItemId === 'streak_freeze' ? 'Streak Freeze' : (targetItemId === 'streak_restore' ? 'Streak Restore' : (name || 'Unnamed Item')),
                category: targetItemId === 'streak_freeze' || targetItemId === 'streak_restore' ? 'STREAK_MODIFIER' : category,
                rarity: targetItemId === 'streak_freeze' ? 'Rare' : (targetItemId === 'streak_restore' ? 'Epic' : rarity || 'Common'),
                url: body.url,
                visualConfig: {
                    svgCode: visualConfig?.svgCode || '',
                    lottieUrl: visualConfig?.lottieUrl || '',
                    primaryColor: visualConfig?.primaryColor || visualConfig?.color || (targetItemId === 'streak_freeze' ? '#3b82f6' : '#ef4444'),
                    secondaryColor: visualConfig?.secondaryColor || null,
                    animationType: visualConfig?.animationType || null,
                    duration: visualConfig?.duration,
                    zoom: visualConfig?.zoom || null,
                    opacity: visualConfig?.opacity || null,
                    offsetY: visualConfig?.offsetY || null,
                    snakeLength: visualConfig?.snakeLength,
                    isAnimated: visualConfig?.isAnimated || !!(visualConfig?.animated || visualConfig?.animationType)
                },
                description: body.description || null, // ⚡️ ADD THIS LINE
                isConsumable: targetItemId.includes("streak") ? true : false,
                itemCount: 1,
                acquiredAt: new Date(),
                expiresAt: expiryDate
            };
            console.log(newItem, "is the new item")

            const updatedUser = await MobileUser.findOneAndUpdate(
                { deviceId },
                {
                    $inc: { [balanceKey]: -finalPrice, lifetimeCoinsSpent: spendIncrement },
                    $push: { inventory: newItem }
                },
                { new: true }
            );

            updatedUser.coinTransactionHistory.push({
                action: "SPENT",
                type: targetItemId.toUpperCase(),
                amount: finalPrice,
                date: new Date()
            });
            await updatedUser.save();

            await checkTitleUnlocks(updatedUser, "lifetimeCoinsSpent", updatedUser.lifetimeCoinsSpent);

            return NextResponse.json({
                success: true,
                balance: updatedUser.coins,
                clanBalance: updatedUser.clanCoins,
                inventory: updatedUser.inventory
            });
        }

        // --- ACTION: BUY COINS (IAP) ---
        if (action === 'buy_coins') {
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

            updatedUser.peakLevel = calculatePeakLevel(updatedUser.totalPurchasedCoins);
            await updatedUser.save();

            try {
                const clansToReward = new Map();

                const activeMemberships = await ClanFollower.find({ userId: updatedUser._id });
                for (const membership of activeMemberships) {
                    const clan = await Clan.findOne({ tag: membership.clanTag });
                    if (clan && clan.verifiedClan && (!clan.collabType || clan.collabType === 'followers')) {
                        clansToReward.set(clan._id.toString(), clan);
                    }
                }

                if (updatedUser.referredBy) {
                    const referringLeader = await MobileUser.findOne({ referralCode: updatedUser.referredBy });
                    if (referringLeader) {
                        const referralClan = await Clan.findOne({ leader: referringLeader._id });
                        if (referralClan && referralClan.verifiedClan && referralClan.collabType === 'referrals') {
                            clansToReward.set(referralClan._id.toString(), referralClan);
                        }
                    }
                }

                for (const clan of clansToReward.values()) {
                    await ClanTopup.create({
                        userId: updatedUser._id,
                        clanTag: clan.tag,
                        amount: amount
                    });

                    const netCoins = amount * 0.7;
                    const currentCollabPercentage = clan.collabPercentage !== undefined
                        ? clan.collabPercentage
                        : (clan.collabType === 'referrals' ? 40 : 20);
                    const finalLeaderShare = Math.floor(netCoins * (currentCollabPercentage / 100));

                    const leaderUser = await MobileUser.findById(clan.leader);
                    if (leaderUser && leaderUser.pushToken) {
                        const messageSubtext = clan.collabType === 'referrals'
                            ? `Your referral @${updatedUser.username || 'A user'}`
                            : `Clan member @${updatedUser.username || 'A follower'}`;

                        await sendPillParallel(
                            [leaderUser.pushToken],
                            "Revenue Dispatched! 💰",
                            `${messageSubtext} purchased ${amount} Coins! Your ${currentCollabPercentage}% share (after 30% store cut) is +${finalLeaderShare} Coins.`,
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
            } catch (clanLogErr) {
                console.error("Failed handling dynamic collab notification ledger loop:", clanLogErr);
            }

            await checkTitleUnlocks(updatedUser, "totalPurchasedCoins", updatedUser.totalPurchasedCoins);

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

            const today = new Date().setHours(0, 0, 0, 0);
            if (user.lastClaimedDate && new Date(user.lastClaimedDate).setHours(0, 0, 0, 0) === today) {
                return NextResponse.json({ error: 'Already claimed today' }, { status: 400 });
            }

            user.lastClaimedDate = new Date();
            user.consecutiveStreak = (user.consecutiveStreak >= 7) ? 1 : (user.consecutiveStreak || 0) + 1;

            const pushFreeHype = (usr) => {
                if (!usr.inventory) usr.inventory = [];
                const existingHype = usr.inventory.find(item => item.itemId === 'hype_free');

                if (existingHype) {
                    existingHype.itemCount = (existingHype.itemCount || 1) + 1;
                } else {
                    usr.inventory.push({
                        itemId: `hype_free`,
                        name: `Free Hype`,
                        category: 'HYPE',
                        rarity: 'RARE',
                        hypeType: 'FREE',
                        visualConfig: { primaryColor: '#22c55e', isAnimated: false },
                        itemCount: 1,
                        isConsumable: true,
                        acquiredAt: new Date(),
                        expiresAt: null
                    });
                }
            };

            const currentDay = user.consecutiveStreak;

            if (currentDay === 7) {
                user.coins = (user.coins || 0) + 10;
                pushFreeHype(user);
            } else {
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
                { $inc: { coins: -amount, lifetimeCoinsSpent: amount } },
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
                { $inc: { coins: amount, lifetimeCoinsSpent: -amount } },
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
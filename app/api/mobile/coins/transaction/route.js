import MobileUser from '@/app/models/MobileUserModel';
import connectDB from '@/app/lib/mongodb';
import { NextResponse } from 'next/server';
import { sendPushNotification } from '@/app/lib/pushNotifications';
import nodemailer from 'nodemailer'; // Assuming you have this imported for your emails

const OC_VALUES = {
    'daily_login': 10,
    'daily_login_7': 50,
    "1kpostevent": 1000,
    'streak_restore': 50,
    'create_clan': 500,
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

// --- POST HANDLER: TRANSACTIONS ---
export async function POST(req) {
    try {
        await connectDB();
        const body = await req.json();
        
        const { deviceId, action, type, packId, coinType, itemId, price, name, category, visualConfig, rewards, payload } = body;

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

        // --- ACTION: BUY INDIVIDUAL ITEM ---
        if (action === 'buy_item') {
            const isCC = coinType === 'CC' || body.currency === 'CC';
            const balanceKey = isCC ? 'clanCoins' : 'coins';

            if ((user[balanceKey] || 0) < price) {
                return NextResponse.json({ error: `Insufficient ${isCC ? 'CC' : 'OC'}` }, { status: 400 });
            }

            const alreadyOwned = user.inventory?.some(i => i.itemId === itemId);
            if (alreadyOwned) return NextResponse.json({ error: 'Already owned' }, { status: 400 });

            user[balanceKey] -= price;
            if (!user.inventory) user.inventory = [];
            
            user.inventory.push({
                itemId,
                name: name || 'Unnamed Item',
                category,
                visualConfig: {
                    svgCode: visualConfig?.svgCode || '',
                    primaryColor: visualConfig?.primaryColor || visualConfig?.color || '#22c55e',
                    secondaryColor: visualConfig?.secondaryColor || null,
                    animationType: visualConfig?.animationType || null,
                    duration: visualConfig?.duration || 3000,
                    snakeLength: visualConfig?.snakeLength || 120,
                    isAnimated: !!(visualConfig?.animated || visualConfig?.animationType)
                },
                acquiredAt: new Date()
            });

            await user.save();
            return NextResponse.json({ success: true, balance: user.coins, clanBalance: user.clanCoins, inventory: user.inventory });
        }

        // --- ACTION: PURCHASE PACK (UNPACKING REWARDS) ---
        if (action === 'purchase_pack') {
            const packData = rewards; 
            if (!packData) return NextResponse.json({ error: 'Pack data missing' }, { status: 400 });

            if (user.purchasedPacks?.includes(packId)) {
                return NextResponse.json({ error: 'Pack already purchased' }, { status: 400 });
            }

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
                        user.inventory.push({
                            itemId: reward.id,
                            name: reward.name,
                            category: reward.type,
                            visualConfig: {
                                svgCode: reward.visualConfig?.svgCode || '',
                                primaryColor: reward.visualConfig?.primaryColor || '#ffffff',
                                secondaryColor: reward.visualConfig?.secondaryColor || null,
                                animationType: reward.visualConfig?.animationType || null,
                                duration: reward.visualConfig?.duration || 3000,
                                isAnimated: reward.visualConfig?.isAnimated || false
                            },
                            acquiredAt: new Date()
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
            const matchedNumbers = type.match(/\d+/);
            const amount = matchedNumbers ? parseInt(matchedNumbers[0], 10) : 0;
            let purchasedCurrency = 'OC';

            if (type.toLowerCase().includes('clan') || coinType === 'CC') {
                user.clanCoins = (user.clanCoins || 0) + amount;
                purchasedCurrency = 'Clan Coins (CC)';
            } else {
                user.coins = (user.coins || 0) + amount;
            }

            // ⚡️ Add to total purchased REGARDLESS of OC or CC (since both use real money)
            user.totalPurchasedCoins = (user.totalPurchasedCoins || 0) + amount;
            
            // ⚡️ Automatically calculate and upgrade Peak Level
            user.peakLevel = calculatePeakLevel(user.totalPurchasedCoins);

            await user.save();

            // Notify Admins about the purchase
            try {
                const transporter = nodemailer.createTransport({
                    service: "gmail",
                    auth: { user: process.env.MAILEREMAIL, pass: process.env.MAILERPASS },
                });
                
                const mailOptions = {
                    from: `"Oreblogda" <${process.env.MAILEREMAIL}>`,
                    to: "Admins", 
                    bcc: ["kayteedberserker@gmail.com"],
                    subject: `💰 New Coin Purchase Alert!`,
                    html: `
                        <h2>New In-App Purchase!</h2>
                        <p><strong>User:</strong> ${user.username || 'Unknown User'} (Device ID: ${deviceId})</p>
                        <p><strong>Package Type:</strong> ${type}</p>
                        <p><strong>Amount Gained:</strong> ${amount} ${purchasedCurrency}</p>
                        <p><strong>New Peak Level:</strong> ${user.peakLevel}</p>
                    `
                };
                
                await transporter.sendMail(mailOptions);
            } catch (emailErr) {
                console.error("Coin purchase email notification failed:", emailErr);
            }

            // ⚡️ Return the new total and peak back to the app context
            return NextResponse.json({ 
                success: true, 
                newBalance: user.coins, 
                newClanBalance: user.clanCoins,
                totalPurchasedCoins: user.totalPurchasedCoins,
                peakLevel: user.peakLevel
            });
        }

        // --- ACTION: CLAIM DAILY OR EVENTS ---
        if (action === 'claim') {
            const amount = OC_VALUES[type];
            if (!amount) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

            // 🔹 Validation 1: Daily Login Streak
            if (type === 'daily_login' || type === 'daily_login_7') {
                const today = new Date().setHours(0, 0, 0, 0);
                if (user.lastClaimedDate && new Date(user.lastClaimedDate).setHours(0, 0, 0, 0) === today) {
                    return NextResponse.json({ error: 'Already claimed today' }, { status: 400 });
                }
                user.lastClaimedDate = new Date();
            } 
            // 🔹 Validation 2: Special One-Time Events (e.g., '1kpostevent')
            else {
                // Ensure the array exists
                if (!user.claimedEvents) user.claimedEvents = [];
                
                // Check if they already claimed this specific event
                const hasClaimed = user.claimedEvents.some(event => event.eventId === type);
                
                if (hasClaimed) {
                    // ⚡️ Note: The frontend explicitly looks for the word "Already claimed" to lock the button!
                    return NextResponse.json({ error: 'Reward already claimed.' }, { status: 400 });
                }
                
                // Record the claim so they can never get it again
                user.claimedEvents.push({ eventId: type });
            }

            user.coins = (user.coins || 0) + amount;
            await user.save();
            return NextResponse.json({ success: true, newBalance: user.coins });
        }
        
        if (action === 'spend') {
            const amount = OC_VALUES[type];
            if (user.coins < amount) return NextResponse.json({ error: 'Insufficient OC' }, { status: 400 });
            user.coins -= amount;
            await user.save();
            return NextResponse.json({ success: true, newBalance: user.coins });
        }
        
        if (action === 'refund') {
            const amount = OC_VALUES[type];
            user.coins += amount;
            await user.save();
            return NextResponse.json({ success: true, newBalance: user.coins });
        }
        
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error("Transaction Error:", error);
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
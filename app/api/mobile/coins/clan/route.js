import connectDB from '@/app/lib/mongodb';
import Clan from '@/app/models/ClanModel';
import MobileUser from '@/app/models/MobileUserModel';
import { NextResponse } from 'next/server';
import nodemailer from 'nodemailer';

const CC_VALUES = {
    "increase_slot": 400,
    "change_name_desc": 200,
};

const VERIFIED_TIERS = {
    'none': 0,
    'basic': 1,
    'standard': 2,
    'premium': 3
};

// Server-controlled pricing configuration (Prevents frontend parameter tampering exploits)
const VERIFIED_PRICES = {
    'basic': {
        7: 100,    // $1.00 (Casual Fan Weekly)
        30: 300    // $3.00 (Casual Fan Monthly)
    },
    'standard': {
        7: 200,    // $2.00 (Otaku / Gamer Weekly)
        30: 600    // $6.00 (Otaku / Gamer Monthly)
    },
    'premium': {
        7: 400,    // $4.00 (Clan Leader / Whale Weekly)
        30: 1200   // $12.00 (Clan Leader / Whale Monthly)
    }
};

export async function POST(req) {
    try {
        await connectDB();
        const body = await req.json();
        const {
            deviceId,
            action,
            type, // This is the packIdentifier from frontend
            packId,
            clanTag,
            itemId,
            price,
            name,
            category,
            rarity,          // ⚡️ Added
            description,     // ⚡️ Added
            url,             // ⚡️ Added
            expiresInDays,   // ⚡️ Added
            durationDays,    // ⚡️ Added (for verified tiers)
            visualConfig,
            visualData,      // ⚡️ Added (Clan catalog uses this)
            rewards,
            payload
        } = body;
        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

        const clan = clanTag
            ? await Clan.findOne({ tag: clanTag.toUpperCase() })
            : await Clan.findOne({ $or: [{ leader: user._id }, { viceLeader: user._id }] });

        if (!clan) return NextResponse.json({ success: false, error: 'Clan not found' }, { status: 404 });

        const isAuthorized = clan.leader.equals(user._id) || (clan.viceLeader && clan.viceLeader.equals(user._id));

        // --- ACTION: BUY DYNAMIC STORE ITEMS (using CC) ---
        if (action === 'buy_item') {

            // 1. HANDLE SLOTS / UPGRADES
            if (category === "UPGRADE" || type === "UPGRADE" || type === "increase_slot") {
                if (clan.maxSlots >= 13) return NextResponse.json({ success: false, error: 'Clan Slots full' }, { status: 400 });

                const cost = price || CC_VALUES["increase_slot"];
                if ((clan.spendablePoints || 0) < cost) return NextResponse.json({ success: false, error: 'Insufficient CC' }, { status: 400 });

                clan.spendablePoints -= cost;
                clan.maxSlots += 1;
                await clan.save();
                return NextResponse.json({ success: true, newBalance: clan.spendablePoints, newClanBalance: clan.spendablePoints });
            }

            // =======================================================================
            // 🛡️ VERIFIED TIERS & SUBSCRIPTION ALLOWANCES ENGINE
            // =======================================================================
            if (category === "VERIFIED") {
                const parts = itemId.split('_'); // Expected format e.g., "verified_premium_30d"
                const newTier = parts[1];
                const days = durationDays || parseInt(parts[2]) || 7;

                // Unify visual config payload
                const vConfig = visualData || visualConfig || {};

                if ((clan.spendablePoints || 0) < price) return NextResponse.json({ success: false, error: 'Insufficient CC' }, { status: 400 });

                const currentTier = clan.activeCustomizations?.verifiedTier || 'none';
                const VERIFIED_TIERS = { 'none': 0, 'basic': 1, 'standard': 2, 'premium': 3 }; // Ensure this exists in scope

                if (VERIFIED_TIERS[newTier] < VERIFIED_TIERS[currentTier]) {
                    return NextResponse.json({ success: false, error: 'Higher tier active' }, { status: 400 });
                }

                clan.spendablePoints -= price;

                const now = new Date();
                let expiry = (clan.verifiedUntil && clan.verifiedUntil > now) ? new Date(clan.verifiedUntil) : now;
                expiry.setDate(expiry.getDate() + days);

                clan.verifiedUntil = expiry;
                clan.verifiedClan = true;
                clan.activeCustomizations.verifiedTier = newTier;
                clan.activeCustomizations.verifiedBadgeXml = vConfig?.svgCode; // ⚡️ Uses unified vConfig

                // 🎁 INJECT MONTHLY/WEEKLY PERKS & ALLOWANCES
                if (!clan.allowances) {
                    clan.allowances = { freeNameChanges: 0, passiveStreakFreezeActive: false, postResurrections: 0, bonfireActive: false };
                }

                if (newTier === 'basic' && days >= 30) {
                    clan.allowances.freeNameChanges += 1;
                }
                else if (newTier === 'standard') {
                    if (days >= 30) clan.allowances.freeNameChanges += 1;
                    clan.allowances.passiveStreakFreezeActive = true;
                }
                else if (newTier === 'premium') {
                    clan.allowances.bonfireActive = true;
                    if (days >= 30) {
                        clan.allowances.freeNameChanges += 1;
                        clan.allowances.postResurrections += 1;
                        clan.allowances.passiveStreakFreezeActive = true;
                    }
                }

                await clan.save();
                return NextResponse.json({ success: true, newBalance: clan.spendablePoints, newClanBalance: clan.spendablePoints });
            }

            // =======================================================================
            // 🎒 STANDARD CLAN INVENTORY ITEMS (Watermarks, Cosmetics, etc.)
            // =======================================================================
            if ((clan.spendablePoints || 0) < price) return NextResponse.json({ success: false, error: 'Insufficient CC' }, { status: 400 });

            // Unify visual properties from either store format
            const vConfig = visualData || visualConfig || {};
            const daysToAdd = expiresInDays || durationDays;

            const existingItemIndex = clan.specialInventory.findIndex(i => i.itemId === itemId);

            // ⚡️ STACKING LOGIC (Extend expiration if they already own it)
            if (existingItemIndex > -1) {
                const existingItem = clan.specialInventory[existingItemIndex];

                if (daysToAdd) {
                    let newExpiryDate = (existingItem.expiresAt && new Date(existingItem.expiresAt) > new Date())
                        ? new Date(existingItem.expiresAt)
                        : new Date();

                    newExpiryDate.setDate(newExpiryDate.getDate() + parseInt(daysToAdd));
                    existingItem.expiresAt = newExpiryDate;
                } else {
                    existingItem.itemCount = (existingItem.itemCount || 1) + 1;
                }
            } else {
                // ⚡️ NEW ITEM CREATION (Mapped to the updated schema)
                let expiryDate = null;
                if (daysToAdd) {
                    expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + parseInt(daysToAdd));
                }
                console.log(
                    {
                        itemId,
                        name,
                        category,
                        rarity: rarity || 'Common',
                        description: description || null,
                        url: url || null,
                        visualConfig: {
                            svgCode: vConfig.svgCode || '',
                            lottieUrl: vConfig.lottieUrl || '',
                            primaryColor: vConfig.primaryColor || vConfig.color || vConfig.glowColor || null,
                            secondaryColor: vConfig.secondaryColor || null,
                            animationType: vConfig.animationType || null,
                            opacity: vConfig.opacity || null,
                            scale: vConfig.size || vConfig.scale || null, // ⚡️ Maps catalog 'size' to schema 'scale'
                            rotation: vConfig.rotation || null,
                            isAnimated: vConfig.isAnimated || !!vConfig.animationType
                        },
                        itemCount: 1,
                        isConsumable: false, // Update if you introduce consumable clan items
                        acquiredAt: new Date(),
                        expiresAt: expiryDate
                    }, "is the new item"
                )
                clan.specialInventory.push({
                    itemId,
                    name,
                    category,
                    rarity: rarity || 'Common',
                    description: description || null,
                    url: url || null,
                    visualConfig: {
                        svgCode: vConfig.svgCode || '',
                        lottieUrl: vConfig.lottieUrl || '',
                        primaryColor: vConfig.primaryColor || vConfig.color || vConfig.glowColor || null,
                        secondaryColor: vConfig.secondaryColor || null,
                        animationType: vConfig.animationType || null,
                        opacity: vConfig.opacity || null,
                        scale: vConfig.size || vConfig.scale || null, // ⚡️ Maps catalog 'size' to schema 'scale'
                        rotation: vConfig.rotation || null,
                        isAnimated: vConfig.isAnimated || !!vConfig.animationType
                    },
                    itemCount: 1,
                    isConsumable: false, // Update if you introduce consumable clan items
                    acquiredAt: new Date(),
                    expiresAt: expiryDate
                });
            }

            clan.spendablePoints -= price;
            await clan.save();

            return NextResponse.json({ success: true, newBalance: clan.spendablePoints, newClanBalance: clan.spendablePoints });
        }

        // --- ACTION: BUY CC TIERS (Direct IAP for coins) ---
        if (action === 'buy_coins') {
            const { appUserId, transactionId } = payload || body || {};

            if (!appUserId || !transactionId) {
                return NextResponse.json({ success: false, error: "TRANSMISSION REJECTED: Missing receipt tokens." }, { status: 400 });
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
                    return NextResponse.json({ success: false, error: "VERIFICATION FAILURE: Validation server unreachable." }, { status: 400 });
                }

                const rcData = await rcResponse.json();
                const nonSubscriptions = rcData.subscriber?.non_subscriptions || {};

                const productPurchases = nonSubscriptions[type];
                if (!productPurchases || productPurchases.length === 0) {
                    return NextResponse.json({ success: false, error: "VERIFICATION FAILURE: Purchase matching identifier not found." }, { status: 400 });
                }

                const transactionExists = productPurchases.some(p => p.id === transactionId);
                if (!transactionExists) {
                    return NextResponse.json({ success: false, error: "VERIFICATION FAILURE: Malformed purchase transaction token." }, { status: 400 });
                }
            } catch (verificationErr) {
                console.error("RevenueCat transaction authorization failed:", verificationErr);
                return NextResponse.json({ success: false, error: "VERIFICATION OFFLINE: Security processing error." }, { status: 500 });
            }

            const amount = parseInt(type.match(/\d+/)?.[0] || 0);
            const ccGained = amount / 10;
            clan.spendablePoints = (clan.spendablePoints || 0) + ccGained;

            if (clan.totalPurchasedCoins !== undefined) {
                clan.totalPurchasedCoins += ccGained;
            }
            await clan.save();

            try {
                const transporter = nodemailer.createTransport({
                    service: "gmail",
                    auth: { user: process.env.MAILEREMAIL, pass: process.env.MAILERPASS },
                });

                const mailOptions = {
                    from: `"Oreblogda" <${process.env.MAILEREMAIL}>`,
                    to: "Admins",
                    bcc: ["kayteedberserker@gmail.com"],
                    subject: `💰 New Clan Coin (CC) Purchase Alert!`,
                    html: `
<h2>New Clan In-App Purchase!</h2>
<p><strong>User:</strong> ${user.username || 'Unknown User'} (Device ID: ${deviceId})</p>
<p><strong>Clan:</strong> ${clan.name || 'Unknown'} (Tag: ${clan.tag || 'Unknown'})</p>
<p><strong>Package Type:</strong> ${type}</p>
<p><strong>Amount Gained:</strong> ${ccGained} Clan Coins (CC)</p>
`
                };

                await transporter.sendMail(mailOptions);
            } catch (emailErr) {
                console.error("Clan Coin purchase email notification failed:", emailErr);
            }

            return NextResponse.json({ success: true, newBalance: clan.spendablePoints, newClanBalance: clan.spendablePoints });
        }

        // --- ⚡️ ACTION: SPEND CLAN COINS (General Backend Deductions) ---
        if (action === 'spend') {
            const cost = CC_VALUES[type];
            if (!cost) return NextResponse.json({ success: false, error: 'Invalid spend type configured' }, { status: 400 });

            if ((clan.spendablePoints || 0) < cost) {
                return NextResponse.json({ success: false, error: 'Insufficient CC' }, { status: 400 });
            }

            clan.spendablePoints -= cost;
            await clan.save();
            return NextResponse.json({ success: true, newBalance: clan.spendablePoints, newClanBalance: clan.spendablePoints });
        }

        // --- ⚡️ ACTION: REFUND CLAN COINS (Failure Fallbacks) ---
        if (action === 'refund') {
            const cost = CC_VALUES[type];
            if (!cost) return NextResponse.json({ success: false, error: 'Invalid refund type configured' }, { status: 400 });

            clan.spendablePoints = (clan.spendablePoints || 0) + cost;
            await clan.save();
            return NextResponse.json({ success: true, newBalance: clan.spendablePoints, newClanBalance: clan.spendablePoints });
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error("Clan Transaction Error:", error);
        return NextResponse.json({ success: false, error: 'Internal error' }, { status: 500 });
    }
}
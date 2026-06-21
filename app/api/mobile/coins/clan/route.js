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
            visualConfig,
            rewards,
            extraData // Contains rewards and currency type
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

            if (category === "UPGRADE" || type === "UPGRADE" || type === "increase_slot" || type === "increase_slot") {
                if (clan.maxSlots >= 13) return NextResponse.json({ success: false, error: 'Clan Slots full' }, { status: 400 });

                // FORCE secure server configuration value instead of accepting client price parameter
                const cost = CC_VALUES["increase_slot"];
                if ((clan.spendablePoints || 0) < cost) return NextResponse.json({ success: false, error: 'Insufficient CC' }, { status: 400 });

                clan.spendablePoints -= cost;
                clan.maxSlots += 1;
                await clan.save();
                return NextResponse.json({ success: true, newBalance: clan.spendablePoints, newClanBalance: clan.spendablePoints });
            }

            if (category === "VERIFIED") {
                const parts = itemId.split('_');
                const newTier = parts[1];
                const days = parseInt(parts[2]);

                // Fetch the absolute source-of-truth price strictly from the server mapping configuration
                const secureSubscriptionCost = VERIFIED_PRICES[newTier]?.[days];

                // Safety check if an unregistered tier or illegal timeframe is passed manually
                if (secureSubscriptionCost === undefined) {
                    return NextResponse.json({ success: false, error: 'Invalid or unknown subscription item package configuration' }, { status: 400 });
                }

                if ((clan.spendablePoints || 0) < secureSubscriptionCost) return NextResponse.json({ success: false, error: 'Insufficient CC' }, { status: 400 });

                const currentTier = clan.activeCustomizations?.verifiedTier || 'none';

                if (VERIFIED_TIERS[newTier] < VERIFIED_TIERS[currentTier]) {
                    return NextResponse.json({ success: false, error: 'Higher tier active' }, { status: 400 });
                }

                clan.spendablePoints -= secureSubscriptionCost;
                const now = new Date();
                let expiry = (clan.verifiedUntil && clan.verifiedUntil > now) ? new Date(clan.verifiedUntil) : now;
                expiry.setDate(expiry.getDate() + days);
                clan.verifiedUntil = expiry;
                clan.activeCustomizations.verifiedTier = newTier;
                clan.activeCustomizations.verifiedBadgeXml = visualConfig?.svgCode;
                await clan.save();
                return NextResponse.json({ success: true, newBalance: clan.spendablePoints, newClanBalance: clan.spendablePoints });
            }

            // Standard Inventory Items - Left flexible with dynamic pricing per request
            if ((clan.spendablePoints || 0) < price) return NextResponse.json({ success: false, error: 'Insufficient CC' }, { status: 400 });
            clan.spendablePoints -= price;
            clan.specialInventory.push({
                itemId, name, category,
                visualConfig: { ...visualConfig, isAnimated: visualConfig?.isAnimated || !!visualConfig?.animationType }
            });
            await clan.save();
            return NextResponse.json({ success: true, newBalance: clan.spendablePoints, newClanBalance: clan.spendablePoints });
        }

        // --- ACTION: PURCHASE CLAN PACKS (IAP) ---
        if (action === 'purchase_pack') {
            const packRewards = rewards;
            const pId = packId || type; // Safety for identifier
            if (clan.purchasedPacks?.includes(pId)) return NextResponse.json({ success: false, error: 'Already owned' }, { status: 400 });

            packRewards.forEach(reward => {
                if (reward.type === 'CC') {
                    clan.spendablePoints = (clan.spendablePoints || 0) + reward.amount;
                } else if (reward.type === 'UPGRADE') {
                    clan.maxSlots = Math.min(13, (clan.maxSlots || 5) + (reward.value || 0));
                } else if (reward.type === 'MULTIPLIER') {
                    const expiry = new Date();
                    expiry.setDate(expiry.getDate() + (reward.duration || 7));
                    clan.multiplierExpiresAt = expiry;
                    clan.activeMultiplier = reward.value || 2;
                } else if (reward.type === 'VERIFIED') {
                    // Handle Verified Badges inside Packs
                    const parts = reward.id.split('_');
                    const newTier = reward.visualConfig?.tier || parts[1] || 'basic';
                    const days = parseInt(parts[2]) || 7;
                    const currentTier = clan.activeCustomizations?.verifiedTier || 'none';

                    // Only update visual/tier if it's an upgrade or same level
                    if (VERIFIED_TIERS[newTier] >= VERIFIED_TIERS[currentTier]) {
                        clan.activeCustomizations.verifiedTier = newTier;
                        clan.activeCustomizations.verifiedBadgeXml = reward.visualConfig?.svgCode;
                    }

                    // Always stack the duration
                    const now = new Date();
                    let expiry = (clan.verifiedUntil && clan.verifiedUntil > now) ? new Date(clan.verifiedUntil) : now;
                    expiry.setDate(expiry.getDate() + days);
                    clan.verifiedUntil = expiry;
                } else if (reward.type === 'PERK' && reward.value === 'premium') {
                    const expiry = (clan.verifiedUntil && clan.verifiedUntil > new Date()) ? new Date(clan.verifiedUntil) : new Date();
                    expiry.setDate(expiry.getDate() + (reward.duration || 30));
                    clan.verifiedUntil = expiry;
                    clan.activeCustomizations.verifiedTier = 'premium';
                } else {
                    // Visual Items (Borders, Backgrounds, Badges, Watermarks)
                    clan.specialInventory.push({
                        itemId: reward.id,
                        name: reward.name || reward.label,
                        category: reward.type,
                        visualConfig: reward.visualConfig,
                        acquiredAt: new Date()
                    });
                }
            });

            if (!clan.purchasedPacks) clan.purchasedPacks = [];
            clan.purchasedPacks.push(pId);
            await clan.save();
            return NextResponse.json({ success: true, newBalance: clan.spendablePoints, newClanBalance: clan.spendablePoints });
        }

        // --- ACTION: BUY CC TIERS (Direct IAP for coins) ---
        if (action === 'buy_coins') {
            const amount = parseInt(type.match(/\d+/)?.[0] || 0);
            const ccGained = amount / 10;
            clan.spendablePoints = (clan.spendablePoints || 0) + ccGained;
            // Preserving functionality for field tracking
            if (clan.totalPurchasedCoins !== undefined) {
                clan.totalPurchasedCoins += ccGained;
            }
            await clan.save();

            // Notify Admins about the Clan 
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
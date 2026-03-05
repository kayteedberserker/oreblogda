import MobileUser from '@/app/models/MobileUserModel';
import connectDB from '@/app/lib/mongodb';
import { NextResponse } from 'next/server';

const OC_VALUES = {
    'daily_login': 10,
    'daily_login_7': 50,
    'streak_restore': 50,
    'create_clan': 500,
    'extra_slot': 20,
    'clan_war': 20,
};

// We reference this internal catalog to verify rewards during the POST
const INTERNAL_PACK_REWARDS = {
    'chuninpack': { 
        oc: 1500, 
        multiplierDays: 7, 
        items: [
            { id: 'iron_pen_wm', name: 'The Iron Pen', category: 'WATERMARK', visualConfig: { primaryColor: '#808080', isAnimated: false, svgCode: '...' } }
        ] 
    },
    'joninpack': { 
        oc: 5500, 
        multiplierDays: 7, 
        items: [
            { id: 'silver_pen_wm', name: 'The Silver Pen', category: 'WATERMARK', visualConfig: { primaryColor: '#C0C0C0', isAnimated: false, svgCode: '...' } },
            { id: 'green_quill_badge', name: 'The Green Quill', category: 'BADGE', visualConfig: { primaryColor: '#10b981', isAnimated: false, svgCode: '...' } }
        ] 
    },
    'kagepack': { 
        oc: 15000, 
        multiplierDays: 7, 
        items: [
            { id: 'golden_pen_wm', name: 'The Golden Pen', category: 'WATERMARK', visualConfig: { primaryColor: '#FFD700', isAnimated: false, svgCode: '...' } },
            { id: 'uzumaki_swirl_border', name: 'Uzumaki Swirl', category: 'BORDER', visualConfig: { primaryColor: '#FFD700', isAnimated: true, animationType: 'singleSnake', duration: 2500 } },
            { id: 'jade_glow_item', name: 'Jade Glow', category: 'GLOW', visualConfig: { primaryColor: '#00A86B', isAnimated: true, svgCode: '...' } },
            { id: 'red_quill_badge', name: 'The Red Quill', category: 'BADGE', visualConfig: { primaryColor: '#ef4444', isAnimated: false, svgCode: '...' } }
        ] 
    }
};

export async function POST(req) {
    try {
        await connectDB();
        const body = await req.json();
        const { deviceId, action, type, packId, coinType, itemId, price, name, category, visualConfig, rewards } = body;

        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

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
            // In a real app, verify 'rewards' from the client or use the INTERNAL_PACK_REWARDS map
            const packData = rewards; // Sent from the frontend catalog
            console.log(rewards)
            if (!packData) return NextResponse.json({ error: 'Pack data missing' }, { status: 400 });

            if (user.purchasedPacks?.includes(packId)) {
                return NextResponse.json({ error: 'Pack already purchased' }, { status: 400 });
            }

            // 1. Process Coins & Multipliers
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
                
                // 2. Process Inventory Items (Watermarks, Badges, Borders, Glows)
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

            if (type.toLowerCase().includes('clan') || coinType === 'CC') {
                user.clanCoins = (user.clanCoins || 0) + amount;
            } else {
                user.coins = (user.coins || 0) + amount;
                user.totalPurchasedCoins += amount
            }

            await user.save();
            return NextResponse.json({ success: true, newBalance: user.coins, newClanBalance: user.clanCoins });
        }

        // --- ACTION: CLAIM DAILY ---
        if (action === 'claim') {
            const amount = OC_VALUES[type];
            if (!amount) return NextResponse.json({ error: 'Invalid type' }, { status: 400 });

            if (type === 'daily_login' || type === 'daily_login_7') {
                const today = new Date().setHours(0, 0, 0, 0);
                if (user.lastClaimedDate && new Date(user.lastClaimedDate).setHours(0, 0, 0, 0) === today) {
                    return NextResponse.json({ error: 'Already claimed' }, { status: 400 });
                }
                user.lastClaimedDate = new Date();
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

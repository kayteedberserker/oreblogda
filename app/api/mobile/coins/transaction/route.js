import MobileUser from '@/app/models/MobileUserModel';
import connectDB from '@/app/lib/mongodb';
import { NextResponse } from 'next/server';

const OC_VALUES = {
    // Earning / Spending / Internal
    'daily_login': 10,
    'daily_login_7': 50,
    'streak_restore': 50,
    'create_clan': 500, // Cost in OC to start a clan
    'extra_slot': 20,
    'clan_war': 20, // Example CC earning or cost
    
    
    // OC Purchase Tiers (IAP)
    'oc_pack_100': 100,     // $0.10
    'oc_pack_550': 550,     // $0.50
    'oc_pack_1200': 1200,   // $1.00
    'oc_pack_2500': 2500,   // $2.00
    'oc_pack_6500': 6500,   // $5.00
    'oc_pack_12000': 12000, // $8.00
};

const AUTHOR_PACKS = {
    'novice_researcher': { price: 2.00, oc: 2500, badge: 2, inventory: 'Ink-Stained Frame', prev: null },
    'novice_writer': { price: 5.00, oc: 6500, badge: 5, inventory: 'Scholar Chat Bubble', prev: 'novice_researcher' },
    'legendary_writer': { price: 10.00, oc: 13000, badge: 14, inventory: 'Glowing Quill Effect', prev: 'novice_writer' },
};

export async function GET(req) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const deviceId = searchParams.get('deviceId');
        if (!deviceId) return NextResponse.json({ error: 'Device ID required' }, { status: 400 });

        const user = await MobileUser.findOne({ deviceId });
        return NextResponse.json({ 
            success: true, 
            balance: user?.coins || 0,
            consecutiveStreak: user?.consecutiveStreak || 0,
            lastClaimedDate: user?.lastClaimedDate,
            purchasedPacks: user?.purchasedPacks || [],
            inventory: user?.specialInventory || [],
            verifiedUntil: user?.verifiedUntil
        });
    } catch (error) {
        return NextResponse.json({ error: 'Server error' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        await connectDB();
        const body = await req.json();
        const { deviceId, action, type, packId } = body;

        if (!deviceId || !action || !type) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // --- PURCHASE AUTHOR PACKS ---
        if (action === 'purchase_pack') {
            const pack = AUTHOR_PACKS[packId];
            if (!pack) return NextResponse.json({ error: 'Invalid author pack' }, { status: 400 });

            if (user.purchasedPacks?.includes(packId)) return NextResponse.json({ error: 'Already owned' }, { status: 400 });
            if (pack.prev && !user.purchasedPacks?.includes(pack.prev)) return NextResponse.json({ error: `Buy ${pack.prev} first` }, { status: 400 });

            user.coins = (user.coins || 0) + pack.oc;
            if (!user.specialInventory) user.specialInventory = [];
            user.specialInventory.push(pack.inventory);

            const currentVerified = user.verifiedUntil && user.verifiedUntil > new Date() ? new Date(user.verifiedUntil) : new Date();
            currentVerified.setDate(currentVerified.getDate() + pack.badge);
            user.verifiedUntil = currentVerified;

            if (!user.purchasedPacks) user.purchasedPacks = [];
            user.purchasedPacks.push(packId);

            await user.save();
            return NextResponse.json({ success: true, balance: user.coins });
        }

        // --- IAP ORE COINS ---
        if (action === 'buy_coins') {
            const amount = OC_VALUES[type];
            if (!amount || !type.startsWith('oc_')) return NextResponse.json({ error: 'Invalid OC pack' }, { status: 400 });

            user.coins = (user.coins || 0) + amount;
            await user.save();
            return NextResponse.json({ success: true, newBalance: user.coins });
        }

        // --- EARN / SPEND / REFUND ---
        const amount = OC_VALUES[type];
        if (!amount) return NextResponse.json({ error: 'Invalid transaction type' }, { status: 400 });

        if (action === 'claim') {
            if (type === 'daily_login' || type === 'daily_login_7') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const lastClaim = user.lastClaimedDate ? new Date(user.lastClaimedDate) : null;
                
                if (lastClaim && lastClaim.setHours(0,0,0,0) === today.getTime()) {
                    return NextResponse.json({ error: 'Already claimed' }, { status: 400 });
                }
                
                const yesterday = new Date(today);
                yesterday.setDate(yesterday.getDate() - 1);
                user.consecutiveStreak = (lastClaim?.getTime() === yesterday.getTime()) ? (user.consecutiveStreak >= 7 ? 1 : (user.consecutiveStreak || 0) + 1) : 1;
                user.lastClaimedDate = new Date();
            }
            user.coins = (user.coins || 0) + amount;
        } else if (action === 'spend') {
            if (user.coins < amount) return NextResponse.json({ error: 'Insufficient OC' }, { status: 400 });
            user.coins -= amount;
        } else if (action === 'refund') {
            user.coins = (user.coins || 0) + amount;
        }

        await user.save();
        return NextResponse.json({ success: true, newBalance: user.coins, streak: user.consecutiveStreak });

    } catch (error) {
        return NextResponse.json({ error: 'Internal error' }, { status: 500 });
    }
}
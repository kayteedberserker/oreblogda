import MobileUser from '@/app/models/MobileUserModel';
import Clan from '@/app/models/ClanModel';
import connectDB from '@/app/lib/mongodb';
import { NextResponse } from 'next/server';

const CC_VALUES = {
    "increase_slot": 1500, 
    "change_name_desc": 2000,
    "badge_2_days": 1000,
    "badge_5_days": 2000,
    "badge_7_days": 3000,
    "badge_30_days": 10000,
    "bounty_card_1": 2000,
    "bounty_card_2": 5000,
    "bounty_card_3": 10000,
    // CC Purchase Tiers (IAP)
    'cc_pack_1000': 1000,
    'cc_pack_2050': 2050,
    'cc_pack_11000': 11000,
    'cc_pack_23000': 23000,
    'cc_pack_50000': 50000,
    'cc_pack_100000': 100000 
};

const CLAN_PACKS = {
    'wandering_ronins': { price: 1.00, cc: 2500, badge: 3, inventory: 'Straw Hat Frame', prev: null },
    'squad_13': { price: 5.00, cc: 12000, badge: 7, inventory: 'Spirit Pressure Glow', prev: 'wandering_ronins' },
    'upper_moon': { price: 10.00, cc: 25000, badge: 10, inventory: 'Demonic Eyes Border', prev: 'squad_13' },
    'phantom_troupe': { price: 20.00, cc: 55000, badge: 15, inventory: 'Spider Tattoo Badge', prev: 'upper_moon' },
    'the_espada': { price: 35.00, cc: 90000, badge: 20, inventory: 'Hollow Mask Banner', prev: 'phantom_troupe' },
    'the_akatsuki': { price: 50.00, cc: 150000, badge: 30, inventory: 'Red Cloud Theme', prev: 'the_espada' }
};

export async function POST(req) {
    try {
        await connectDB();
        const body = await req.json();
        const { deviceId, action, type, packId, clanTag } = body;
        console.log("Received transaction request:", { deviceId, action, type, packId, clanTag });
        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

        const clan = clanTag 
            ? await Clan.findOne({ tag: clanTag.toUpperCase() })
            : await Clan.findOne({ $or: [{ leader: user._id }, { viceLeader: user._id }] });
        console.log("Clan found for transaction:", clan?.tag, clanTag);
        if (!clan) return NextResponse.json({ success: false, error: 'Clan not found' }, { status: 404 });

        const isAuthorized = clan.leader.equals(user._id) || clan.viceLeader?.equals(user._id);
        if ((action === "increase_slot" || action === "change_name_desc") &&!isAuthorized) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });

        // --- ACTION: PURCHASE CLAN PACKS (IAP) ---
        if (action === 'purchase_pack') {
            const pack = CLAN_PACKS[packId];
            if (!pack) return NextResponse.json({ success: false, error: 'Invalid pack' }, { status: 400 });
            if (clan.purchasedPacks?.includes(packId)) return NextResponse.json({ success: false, error: 'Already owned' }, { status: 400 });
            if (pack.prev && !clan.purchasedPacks?.includes(pack.prev)) return NextResponse.json({ success: false, error: `Unlock ${pack.prev} first` }, { status: 400 });

            clan.spendablePoints = (clan.spendablePoints || 0) + pack.cc;
            
            if (!clan.specialInventory) clan.specialInventory = [];
            clan.specialInventory.push(pack.inventory);

            const now = new Date();
            const currentExpiry = (clan.verifiedUntil && clan.verifiedUntil > now) ? new Date(clan.verifiedUntil) : now;
            currentExpiry.setDate(currentExpiry.getDate() + pack.badge);
            clan.verifiedUntil = currentExpiry;

            if (!clan.purchasedPacks) clan.purchasedPacks = [];
            clan.purchasedPacks.push(packId);

            await clan.save();
            return NextResponse.json({ success: true, newBalance: clan.spendablePoints });
        }

        // --- ACTION: BUY CC TIERS (Direct CC Purchase) ---
        if (action === 'buy_coins') {
            const amount = CC_VALUES[type];
            if (!amount || !type.startsWith('cc_')) return NextResponse.json({ success: false, error: 'Invalid pack' }, { status: 400 });

            clan.spendablePoints = (clan.spendablePoints || 0) + amount;
            await clan.save();
            return NextResponse.json({ success: true, newBalance: clan.spendablePoints });
        }

        // --- ACTION: SPEND (Deduct Money ONLY) ---
        if (action === 'spend') {
            const cost = CC_VALUES[type];
            if (!cost) return NextResponse.json({ success: false, error: 'Invalid item' }, { status: 400 });
            if ((clan.spendablePoints || 0) < cost) return NextResponse.json({ success: false, error: 'Insufficient CC in treasury' }, { status: 400 });

            clan.spendablePoints -= cost;
            await clan.save();
            return NextResponse.json({ success: true, newBalance: clan.spendablePoints });
        }

        // --- ACTION: REFUND (Add Money Back) ---
        if (action === 'refund') {
            const cost = CC_VALUES[type];
            if (!cost) return NextResponse.json({ success: false, error: 'Invalid item to refund' }, { status: 400 });

            clan.spendablePoints = (clan.spendablePoints || 0) + cost;
            await clan.save();
            return NextResponse.json({ success: true, newBalance: clan.spendablePoints });
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
import MobileUser from '@/app/models/MobileUserModel';
import Clan from '@/app/models/ClanModel';
import connectDB from '@/app/lib/mongodb';
import { NextResponse } from 'next/server';

const CC_VALUES = {
    "increase_slot": 1500,
    "change_name_desc": 200,
    "badge_2_days": 1000,
    "badge_5_days": 2000,
    "badge_7_days": 3000,
    "badge_30_days": 10000,
    "bounty_card_1": 2000,
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
        const { 
            deviceId, 
            action, 
            type, 
            packId, 
            clanTag, 
            itemId, 
            price, 
            name, 
            category, 
            visualConfig // This comes from your Catalog GET request
        } = body;
        
        console.log("Clan Transaction Log:", { deviceId, action, type, packId, itemId, visualConfig });
        
        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ success: false, error: 'User not found' }, { status: 404 });

        // Find clan by tag or by user ownership
        const clan = clanTag
            ? await Clan.findOne({ tag: clanTag.toUpperCase() })
            : await Clan.findOne({ $or: [{ leader: user._id }, { viceLeader: user._id }] });

        if (!clan) return NextResponse.json({ success: false, error: 'Clan not found' }, { status: 404 });

        const isAuthorized = clan.leader.equals(user._id) || (clan.viceLeader && clan.viceLeader.equals(user._id));

        // --- 🛒 ACTION: PURCHASE DYNAMIC STORE ITEMS ---
        if (action === 'buy_item') {
            if (!isAuthorized) return NextResponse.json({ success: false, error: 'Only Leaders/Vice-Leaders can buy items' }, { status: 403 });
            if (!itemId || !price || !category) return NextResponse.json({ success: false, error: 'Missing item data' }, { status: 400 });

            if ((clan.spendablePoints || 0) < price) {
                return NextResponse.json({ success: false, error: 'Insufficient CC in Treasury' }, { status: 400 });
            }

            // Avoid duplicates
            if (clan.specialInventory?.some(i => i.itemId === itemId)) {
                return NextResponse.json({ success: false, error: 'Item already in Clan Arsenal' }, { status: 400 });
            }

            // Deduct from Clan Treasury
            clan.spendablePoints -= price;

            // Add to Clan Inventory using updated VisualConfig mapping
            if (!clan.specialInventory) clan.specialInventory = [];
            
            clan.specialInventory.push({
                itemId,
                name: name || 'Unnamed Clan Item',
                category,
                visualConfig: {
                    svgCode: visualConfig?.svgCode || '',
                    primaryColor: visualConfig?.primaryColor || visualConfig?.color || '#3b82f6',
                    secondaryColor: visualConfig?.secondaryColor || null,
                    animationType: visualConfig?.animationType || null,
                    duration: visualConfig?.duration || 3000,
                    snakeLength: visualConfig?.snakeLength || 120,
                    isAnimated: !!(visualConfig?.animated || visualConfig?.animationType)
                },
                acquiredAt: new Date(),
                isEquipped: false
            });

            await clan.save();
            return NextResponse.json({ 
                success: true, 
                newBalance: clan.spendablePoints, 
                inventory: clan.specialInventory 
            });
        }

        // --- ACTION: PURCHASE CLAN PACKS (IAP) ---
        if (action === 'purchase_pack') {
            const pack = CLAN_PACKS[packId];
            if (!pack) return NextResponse.json({ success: false, error: 'Invalid pack' }, { status: 400 });
            if (clan.purchasedPacks?.includes(packId)) return NextResponse.json({ success: false, error: 'Already owned' }, { status: 400 });
            if (pack.prev && !clan.purchasedPacks?.includes(pack.prev)) return NextResponse.json({ success: false, error: `Unlock ${pack.prev} first` }, { status: 400 });

            clan.spendablePoints = (clan.spendablePoints || 0) + pack.cc;

            if (!clan.specialInventory) clan.specialInventory = [];
            clan.specialInventory.push({ 
                itemId: packId, 
                name: pack.inventory, 
                category: 'FUNCTIONAL',
                acquiredAt: new Date(),
                visualConfig: { isAnimated: false }
            });

            const now = new Date();
            const currentExpiry = (clan.verifiedUntil && clan.verifiedUntil > now) ? new Date(clan.verifiedUntil) : now;
            currentExpiry.setDate(currentExpiry.getDate() + pack.badge);
            clan.verifiedUntil = currentExpiry;

            if (!clan.purchasedPacks) clan.purchasedPacks = [];
            clan.purchasedPacks.push(packId);

            await clan.save();
            return NextResponse.json({ success: true, newBalance: clan.spendablePoints });
        }

        // --- ACTION: BUY CC TIERS (IAP Coins) ---
        if (action === 'buy_coins') {
            const matchedNumbers = type.match(/\d+/);
            const amount = matchedNumbers ? parseInt(matchedNumbers[0], 10) : null;

            if (!amount || isNaN(amount)) {
                return NextResponse.json({ success: false, error: 'Invalid CC amount' }, { status: 400 });
            }
            
            clan.spendablePoints = (clan.spendablePoints || 0) + amount/10;
            await clan.save();
            return NextResponse.json({ success: true, newBalance: clan.spendablePoints });
        }

        // --- ACTION: SPEND (Internal Upgrades) ---
        if (action === 'spend') {
            if (!isAuthorized) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 403 });
            
            const cost = CC_VALUES[type];
            if (!cost) return NextResponse.json({ success: false, error: 'Invalid item' }, { status: 400 });
            if ((clan.spendablePoints || 0) < cost) return NextResponse.json({ success: false, error: 'Insufficient CC' }, { status: 400 });

            clan.spendablePoints -= cost;
            await clan.save();
            return NextResponse.json({ success: true, newBalance: clan.spendablePoints });
        }

        // --- ACTION: REFUND ---
        if (action === 'refund') {
            const cost = CC_VALUES[type];
            if (!cost) return NextResponse.json({ success: false, error: 'Invalid refund' }, { status: 400 });

            clan.spendablePoints = (clan.spendablePoints || 0) + cost;
            await clan.save();
            return NextResponse.json({ success: true, newBalance: clan.spendablePoints });
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 });

    } catch (error) {
        console.error("Clan API Internal Error:", error);
        return NextResponse.json({ success: false, error: 'Server error' }, { status: 500 });
    }
}
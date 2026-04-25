import { STICKER_CATALOG } from "@/app/constants/stickers";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

// Helper to determine rent price based on rarity
const getRentPrice = (rarity) => {
    switch (rarity?.toLowerCase()) {
        case 'mythic': return 50;
        case 'legendary': return 30;
        case 'epic': return 15;
        case 'rare': return 10;
        case 'common':
        default: return 5;
    }
};

export async function GET(req) {
    await connectDB();

    const deviceId = req.headers.get("x-user-deviceId");
    if (!deviceId) return NextResponse.json({ error: "Missing Device ID" }, { status: 400 });

    try {
        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        // 1. Get IDs from stickers.owned
        const ownedIds = user.stickers?.owned || [];

        // 2. LEGACY BRIDGE: Sync items from inventory array 
        // (matching your catalog's 'id' field)
        const legacyIds = (user.inventory || [])
            .filter(item => item.category === 'Sticker' || item.category === 'Badge')
            .map(item => item.itemId);

        const allOwnedIds = [...new Set([...ownedIds, ...legacyIds])];

        // 3. Map to FULL OBJECTS from your STICKER_CATALOG
        // This is what gets saved to MMKV on the phone
        const myFullStickers = STICKER_CATALOG.filter(s => allOwnedIds.includes(s.id));

        return NextResponse.json({
            store: STICKER_CATALOG,
            owned: myFullStickers,
            balance: user.coins
        }, { status: 200 });

    } catch (err) {
        console.error("Sticker Fetch Error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}

export async function POST(req) {
    await connectDB();

    const deviceId = req.headers.get("x-user-deviceId") || req.headers.get("deviceid");
    const { action, stickerId } = await req.json();

    if (!deviceId) return NextResponse.json({ error: "Missing Device ID" }, { status: 400 });

    try {
        const user = await MobileUser.findOne({ deviceId });
        const sticker = STICKER_CATALOG.find(s => s.id === stickerId);

        if (!user || !sticker) {
            return NextResponse.json({ error: "User or Sticker not found" }, { status: 404 });
        }

        const buyPrice = sticker.price;
        const rentPrice = getRentPrice(sticker.rarity);

        // --- PURCHASE LOGIC ---
        if (action === "buy") {
            if (user.coins < buyPrice) return NextResponse.json({ error: "Insufficient OC" }, { status: 400 });
            if (user.stickers?.owned.includes(stickerId)) return NextResponse.json({ error: "Already owned" }, { status: 400 });

            // Atomic update: deduct coins and add sticker
            user.coins -= buyPrice;

            if (!user.stickers) user.stickers = { owned: [] };
            user.stickers.owned.push(stickerId);

            await user.save();
            // Return updated balance and full sticker for UI snap
            return NextResponse.json({
                success: true,
                balance: user.coins,
                newSticker: sticker
            }, { status: 200 });
        }

        // --- INSTANT RENT LOGIC ---
        if (action === "rent") {
            if (!sticker.rentable) return NextResponse.json({ error: "Sticker is not rentable" }, { status: 400 });
            if (user.coins < rentPrice) return NextResponse.json({ error: "Insufficient OC" }, { status: 400 });

            user.coins -= rentPrice;

            user.coinTransactionHistory.push({
                action: `Rented Sticker: ${sticker.name}`,
                type: 'debit',
                amount: rentPrice,
                date: new Date()
            });

            await user.save();
            return NextResponse.json({
                success: true,
                balance: user.coins
            }, { status: 200 });
        }

    } catch (err) {
        console.error("Sticker Transaction Error:", err);
        return NextResponse.json({ message: "Server error" }, { status: 500 });
    }
}
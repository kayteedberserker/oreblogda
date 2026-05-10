import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import Sticker from "@/app/models/StickerModel";
import { NextResponse } from "next/server";

export async function GET(req) {
    await connectDB();

    const deviceId = req.headers.get("x-user-deviceId") || req.headers.get("deviceid");
    if (!deviceId) return NextResponse.json({ error: "Missing Device ID" }, { status: 400 });

    try {
        const [user, allStickers] = await Promise.all([
            MobileUser.findOne({ deviceId }),
            Sticker.find({}).lean()
        ]);

        if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

        const ownedIds = user.stickers?.owned || [];
        const legacyIds = (user.inventory || [])
            .filter(item => item.category === 'Sticker')
            .map(item => item.itemId);

        const allOwnedIds = [...new Set([...ownedIds, ...legacyIds])];
        const ownedStickers = allStickers.filter(s => allOwnedIds.includes(s.stickerId));

        // 🚀 SERVER-SIDE GROUPING: Group all stickers by their Pack ID
        const packsMap = allStickers.reduce((acc, sticker) => {
            const pId = sticker.packId || "SYSTEM_DEFAULT";

            if (!acc[pId]) {
                acc[pId] = {
                    packId: pId,
                    coverArt: sticker.url, // Use the first sticker as the pack's icon
                    totalItems: 0,
                    items: []
                };
            }

            acc[pId].items.push(sticker);
            acc[pId].totalItems += 1;
            return acc;
        }, {});

        const storePacks = Object.values(packsMap);

        return NextResponse.json({
            storePacks, // Send the grouped array instead of a flat list
            owned: ownedStickers,
            balance: user.coins
        }, { status: 200 });

    } catch (err) {
        console.error("Sticker Sync Error:", err);
        return NextResponse.json({ message: "Vault synchronization failed" }, { status: 500 });
    }
}

export async function POST(req) {
    await connectDB();

    const deviceId = req.headers.get("x-user-deviceId") || req.headers.get("deviceid");
    const { action, stickerId } = await req.json();

    if (!deviceId) return NextResponse.json({ error: "Missing Device ID" }, { status: 400 });

    try {
        const [user, sticker] = await Promise.all([
            MobileUser.findOne({ deviceId }),
            Sticker.findOne({ stickerId })
        ]);

        if (!user || !sticker) {
            return NextResponse.json({ error: "Resource not found" }, { status: 404 });
        }

        if (action === "buy") {
            if (user.coins < sticker.price) return NextResponse.json({ error: "Insufficient OC" }, { status: 400 });
            if (user.stickers?.owned.includes(stickerId)) {
                return NextResponse.json({ error: "Asset already registered" }, { status: 400 });
            }

            user.coins -= sticker.price;
            if (!user.stickers) user.stickers = { owned: [] };
            user.stickers.owned.push(stickerId);

            await user.save();
            return NextResponse.json({ success: true, balance: user.coins, newSticker: sticker });
        }

        if (action === "rent") {
            if (user.coins < sticker.price) return NextResponse.json({ error: "Insufficient OC" }, { status: 400 });

            user.coins -= sticker.price;
            await user.save();
            return NextResponse.json({ success: true, balance: user.coins });
        }

    } catch (err) {
        console.error("Transaction Error:", err);
        return NextResponse.json({ message: "Protocol error during purchase" }, { status: 500 });
    }
}
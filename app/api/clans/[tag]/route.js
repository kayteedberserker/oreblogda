import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

const getRankDetails = (points) => {
    // Exact thresholds from your handwritten notes
    if (points >= 300000) return { title: "The Akatsuki", next: 1000000, color: "#ef4444" }; // Red
    if (points >= 100000) return { title: "The Espada", next: 300000, color: "#e0f2fe" }; // White
    if (points >= 50000) return { title: "Phantom Troupe", next: 100000, color: "#a855f7" }; // Purple
    if (points >= 20000) return { title: "Upper Moon", next: 50000, color: "#60a5fa" }; // Blue
    if (points >= 5000) return { title: "Squad 13", next: 20000, color: "#10b981" }; // Green
    return { title: "Wandering Ronin", next: 5000, color: "#94a3b8" }; // Grey
};

export async function GET(req, { params }) {
    await connectDB();
    const _registerUser = MobileUser.modelName; 
    const { tag } = await params;
    const { searchParams } = new URL(req.url);
    const deviceId = searchParams.get("deviceId");

    try {
        const clan = await Clan.findOne({ tag: tag.toUpperCase() })
            .populate({ path: "leader", model: MobileUser, select: "username profilePic" })
            .populate({ path: "viceLeader", model: MobileUser, select: "username profilePic" })
            .populate({ path: "members", model: MobileUser, select: "username profilePic lastActive" })
            .populate({ path: "joinRequests.userId", model: MobileUser, select: "username profilePic" });

        if (!clan) return NextResponse.json({ message: "Clan not found" }, { status: 404 });

        const user = deviceId ? await MobileUser.findOne({ deviceId }) : null;
        const rank = getRankDetails(clan.totalPoints || 0);

        const responseData = clan.toObject();
        const isAdmin = clan.leader?._id.toString() === user?._id.toString() || 
                        clan.viceLeader?._id.toString() === user?._id.toString();

        return NextResponse.json({
            ...responseData,
            rankTitle: rank.title,
            nextThreshold: rank.next,
            rankColor: rank.color,
            isAdmin,
            role: clan.leader?._id.toString() === user?._id.toString() ? "leader" : 
                  (clan.viceLeader?._id.toString() === user?._id.toString() ? "viceLeader" : "member")
        });
    } catch (err) {
        return NextResponse.json({ message: "Error", error: err.message }, { status: 500 });
    }
}


export async function PATCH(req, { params }) {
    await connectDB();
    const { tag } = await params;
    const { deviceId, action, payload } = await req.json();

    try {
        const user = await MobileUser.findOne({ deviceId });
        const clan = await Clan.findOne({ tag: tag.toUpperCase() });
        const affectedUser = payload?.userId ? await MobileUser.findById(payload.userId) : null;

        if (!clan || !user) return NextResponse.json({ message: "Not found" }, { status: 404 });

        const isAdmin = clan.leader.toString() === user._id.toString() || clan.viceLeader?.toString() === user._id.toString();
        
        // 🔹 Handle Purchases
        if (action === "BUY_STORE_ITEM") {
            const { itemId, itemName } = payload;
            
            if (itemId === "increase_slot") {
                if (!isAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
                if (clan.maxSlots >= 13) {
                    return NextResponse.json({ message: "Barracks already at maximum capacity (13)" }, { status: 400 });
                }
                clan.maxSlots += 1;
            } 
            
            else if (itemId.startsWith('badge_')) {
                const daysStr = itemId.split('_')[1];
                const days = parseInt(daysStr);
                
                const now = new Date();
                const currentExpiry = (clan.verifiedUntil && clan.verifiedUntil > now) 
                    ? new Date(clan.verifiedUntil) 
                    : now;
                
                currentExpiry.setDate(currentExpiry.getDate() + days);
                clan.verifiedUntil = currentExpiry;

                // Also save to Inventory as requested
                if (!clan.specialInventory) clan.specialInventory = [];
                
                // Check if a "Verified" badge entry already exists
                let badgeItem = clan.specialInventory.find(i => i.category === 'BADGE' && i.itemId.includes('badge'));
                
                if (badgeItem) {
                    badgeItem.expiresAt = clan.verifiedUntil;
                    badgeItem.name = itemName || "Verified Badge";
                } else {
                    clan.specialInventory.push({
                        itemId: itemId,
                        name: itemName || "Verified Badge",
                        category: "BADGE",
                        isEquipped: true,
                        acquiredAt: new Date(),
                        expiresAt: clan.verifiedUntil
                    });
                }
            }
            
            else if (itemId.startsWith('bounty_card_')) {
                if (!clan.specialInventory) clan.specialInventory = [];
                clan.specialInventory.push({
                    itemId: itemId,
                    name: itemName || "Bounty Card", 
                    category: "FUNCTIONAL",
                    isEquipped: false,
                    acquiredAt: new Date(),
                    expiresAt: null 
                });
            }
        }

        // 🔹 Equip Items from Inventory
        if (action === "EQUIP_ITEM") {
            if (!isAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
            
            const item = clan.specialInventory.id(payload.itemId);
            if (!item) return NextResponse.json({ message: "Item not found" }, { status: 404 });

            // Unique logic: Only one frame/theme can be active
            if (['FRAME', 'THEME'].includes(item.category)) {
                clan.specialInventory.forEach(i => {
                    if (i.category === item.category) i.isEquipped = false;
                });
            }

            item.isEquipped = true;

            // Sync with Quick-Access
            if (item.category === 'FRAME') clan.activeCustomizations.frame = item.itemId;
            if (item.category === 'THEME') clan.activeCustomizations.theme = item.itemId;
            if (item.category === 'EFFECT') clan.activeCustomizations.effect = item.itemId;
        }

        // 🔹 Standard Clan Management
        if (action === "EDIT_CLAN") {
            if (!isAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
            clan.description = payload.description;
            clan.name = payload.name;
        }

        if (action === "TOGGLE_RECRUIT") {
            if (!isAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
            clan.isRecruiting = !clan.isRecruiting;
        }

        if (action === "APPROVE_MEMBER") {
            if (!isAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
            if (clan.members.length >= clan.maxSlots) {
                return NextResponse.json({ message: "Barracks full" }, { status: 400 });
            }
            clan.members.push(payload.userId);
            clan.joinRequests = clan.joinRequests.filter(r => r.userId.toString() !== payload.userId);
        }

        if (action === "KICK_MEMBER") {
            if (!isAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
            if (payload.userId === clan.leader.toString()) return NextResponse.json({ message: "Cannot kick leader" }, { status: 400 });
            clan.members = clan.members.filter(m => m.toString() !== payload.userId);
        }

        if (action === "LEAVE_CLAN") {
            if (clan.leader.toString() === user._id.toString()) return NextResponse.json({ message: "Transfer leadership first" }, { status: 403 });
            clan.members = clan.members.filter(m => m.toString() !== user._id.toString());
        }

        // 🔹 FINAL SAVE
        // We use markModified because we are updating nested objects and arrays
        clan.markModified('specialInventory');
        clan.markModified('activeCustomizations');
        
        const savedClan = await clan.save();
        
        return NextResponse.json({ 
            success: true, 
            clan: savedClan 
        });

    } catch (err) {
        console.error("Clan PATCH Error:", err);
        return NextResponse.json({ message: "Update failed", error: err.message }, { status: 500 });
    }
}
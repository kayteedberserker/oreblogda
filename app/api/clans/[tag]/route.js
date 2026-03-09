import connectDB from "@/app/lib/mongodb";
import { sendMultiplePushNotifications } from "@/app/lib/pushNotifications";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel"; // 🔹 Added Post model import
import { NextResponse } from "next/server";

const getRankDetails = (points) => {
    if (points >= 300000) return { title: "The Akatsuki", next: 1000000, color: "#ef4444" };
    if (points >= 100000) return { title: "The Espada", next: 300000, color: "#e0f2fe" };
    if (points >= 50000) return { title: "Phantom Troupe", next: 100000, color: "#a855f7" };
    if (points >= 20000) return { title: "Upper Moon", next: 50000, color: "#60a5fa" };
    if (points >= 5000) return { title: "Squad 13", next: 20000, color: "#10b981" };
    return { title: "Wandering Ronin", next: 5000, color: "#94a3b8" };
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

        if (!clan || !user) return NextResponse.json({ message: "Not found" }, { status: 404 });

        const isLeader = clan.leader.toString() === user._id.toString();
        const isVice = clan.viceLeader?.toString() === user._id.toString();
        const isAdmin = isLeader || isVice;

        // 🔹 1. APPOINT VICE LEADER (Leader Only)
        if (action === "APPOINT_VICE") {
            if (!isLeader) return NextResponse.json({ message: "Forbidden: Leader access required" }, { status: 403 });
            
            // If userId is provided, appoint them. If null, demote current vice.
            clan.viceLeader = payload.userId || null;
        }

        // 🔹 2. DELETE POST (Admin Only)
        if (action === "DELETE_POST") {
            if (!isAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

            // We find the post globally but verify it belongs to this clan
            const postToDelete = await Post.findById(payload.postId);
            
            if (!postToDelete) {
                return NextResponse.json({ message: "Post already deleted or not found" }, { status: 404 });
            }

            // Security check: Ensure this post actually belongs to the clan being managed
            // We use tag or _id depending on how clanId is stored in your Post model
            if (postToDelete.clanId !== clan.tag && postToDelete.clanId !== clan._id.toString()) {
                return NextResponse.json({ message: "Unauthorized post deletion" }, { status: 403 });
            }

            await Post.findByIdAndDelete(payload.postId);
            
            return NextResponse.json({ success: true, message: "Post deleted successfully" });
        }
        
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

                if (!clan.specialInventory) clan.specialInventory = [];
                let badgeItem = clan.specialInventory.find(i => i.category === 'BADGE' && i.itemId.includes('badge'));
                
                if (badgeItem) {
                    badgeItem.expiresAt = clan.verifiedUntil;
                    badgeItem.name = "Verified Badge";
                } else {
                    clan.specialInventory.push({
                        itemId: itemId,
                        name: "Verified Badge",
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
            
            const item = clan.specialInventory.find(i => i.itemId === payload.itemId);
            if (!item) return NextResponse.json({ message: "Item not found" }, { status: 404 });

            const isEquipping = !item.isEquipped;
            
            if (isEquipping && item.category !== 'BADGE') {
                clan.specialInventory.forEach(i => {
                    if (i.category === item.category) i.isEquipped = false;
                });
            }

            item.isEquipped = isEquipping;

            if (!clan.activeCustomizations) clan.activeCustomizations = {};
            if (item.category === 'FRAME') clan.activeCustomizations.frame = isEquipping ? item.itemId : null;
            if (item.category === 'THEME') clan.activeCustomizations.theme = isEquipping ? item.itemId : null;
            if (item.category === 'EFFECT') clan.activeCustomizations.effect = isEquipping ? item.itemId : null;
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
            
            if (payload.userId === clan.viceLeader?.toString()) clan.viceLeader = null;

            clan.members = clan.members.filter(m => m.toString() !== payload.userId);
        }

        if (action === "LEAVE_CLAN") {
            if (clan.leader.toString() === user._id.toString()) return NextResponse.json({ message: "Transfer leadership first" }, { status: 403 });
            if (user._id.toString() === clan.viceLeader?.toString()) clan.viceLeader = null;
            
            clan.members = clan.members.filter(m => m.toString() !== user._id.toString());
        }

        // 💬 🔹 NEW: HANDLE CLAN CHAT MESSAGES
        if (action === "SEND_MESSAGE") {
            const isMember = clan.members.some(m => m.toString() === user._id.toString()) || isLeader || isVice;
            
            if (!isMember) {
                return NextResponse.json({ message: "Forbidden: Not a clan member" }, { status: 403 });
            }

            if (!clan.messages) clan.messages = [];

            clan.messages.push({
                authorId: user.deviceId,
                authorUserId: user._id,
                authorName: user.username,
                text: payload.text,
                date: new Date()
            });

            if (clan.messages.length > 250) {
                clan.messages = clan.messages.slice(-250);
            }

            // 🔔 --- PUSH NOTIFICATION LOGIC ---
            try {
                // 1. Get all clan members except the sender
                const memberIds = [clan.leader, clan.viceLeader, ...clan.members].filter(
                    id => id && id.toString() !== user._id.toString()
                );

                // 2. Fetch their Expo Push Tokens
                const recipients = await MobileUser.find({
                    _id: { $in: memberIds },
                    pushToken: { $exists: true, $ne: null }
                }).select("pushToken");

                const tokens = recipients.map(r => r.pushToken);

                if (tokens.length > 0) {
                    // 3. Send the broadcast
                    await sendMultiplePushNotifications(
                        tokens,
                        `${clan.name} Hall`,
                        `${user.username}: ${payload.text}`,
                        { 
                            screen: "/clanprofile", // Ensure this matches your Expo Router path
                            clanTag: clan.tag,
                            type: "CLAN_CHAT"
                        },
                        `clan_chat_${clan.tag}` // Group messages by clan hall
                    );
                }
            } catch (pushErr) {
                console.error("🔔 Push Notification Error:", pushErr);
                // We don't return an error response here because the message was successfully saved
            }
        }

        // 🔹 FINAL SAVE
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
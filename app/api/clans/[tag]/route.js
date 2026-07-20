import { sendPillParallel } from "@/app/lib/messagePillService";
import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel";
import { NextResponse } from "next/server";

const getRankDetails = (points) => {
    console.log("Im collecting points: ", points);

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

        // ⚡️ NEW: Check if the requesting user has blocked this clan
        let hasBlockedClan = false;
        if (user && user.blockedClans) {
            hasBlockedClan = user.blockedClans.some(
                (blockedId) => blockedId.toString() === clan._id.toString()
            );
        }

        const responseData = clan.toObject();
        const isAdmin = clan.leader?._id.toString() === user?._id.toString() ||
            clan.viceLeader?._id.toString() === user?._id.toString();

        return NextResponse.json({
            ...responseData,
            rankTitle: rank.title,
            nextThreshold: rank.next,
            rankColor: rank.color,
            isAdmin,
            hasBlockedClan, // ⚡️ Passed to the frontend
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

            if (payload.userId) {
                const isMember = clan.members.some(m => m.toString() === payload.userId);
                if (!isMember) return NextResponse.json({ message: "User must be a clan member first" }, { status: 400 });

                clan.viceLeader = payload.userId;

                try {
                    const targetUser = await MobileUser.findById(payload.userId).select("pushToken username");
                    if (targetUser?.pushToken) {
                        await sendPillParallel(
                            [targetUser.pushToken],
                            "Promotion! 🎖️",
                            `You have been appointed as Vice Leader of [${clan.name}]!`,
                            { screen: "/clanprofile", clanTag: clan.tag },
                            { type: 'clan_alert', targetAudience: 'user', targetId: targetUser._id.toString(), link: `/clanprofile`, priority: 3 }
                        );
                    }
                } catch (e) { console.error("Notification Error:", e); }
            } else {
                clan.viceLeader = null;
            }
        }

        // 🔹 2. DELETE POST (Admin Only)
        if (action === "DELETE_POST") {
            if (!isAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

            const postToDelete = await Post.findById(payload.postId);
            if (!postToDelete) return NextResponse.json({ message: "Post not found" }, { status: 404 });

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

            else if (itemId === 'clan_name_lock') {
                const lockExpiry = new Date();
                lockExpiry.setFullYear(lockExpiry.getFullYear() + 1); // 1 Year lock
                clan.nameLockedUntil = lockExpiry;

                if (!clan.specialInventory) clan.specialInventory = [];
                clan.specialInventory.push({
                    itemId: itemId,
                    name: itemName || "1-Year Name Lock",
                    category: "FUNCTIONAL",
                    isEquipped: false,
                    acquiredAt: new Date(),
                    expiresAt: lockExpiry
                });
            }

            else if (itemId.startsWith('badge_')) {
                const days = parseInt(itemId.split('_')[1]);
                const now = new Date();
                const currentExpiry = (clan.verifiedUntil && clan.verifiedUntil > now) ? new Date(clan.verifiedUntil) : now;

                currentExpiry.setDate(currentExpiry.getDate() + days);
                clan.verifiedUntil = currentExpiry;

                if (!clan.specialInventory) clan.specialInventory = [];
                let badgeItem = clan.specialInventory.find(i => i.category === 'BADGE');

                if (badgeItem) {
                    badgeItem.expiresAt = clan.verifiedUntil;
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

        // 🔹 Equip Items
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

        // ============================================================================
        // 🔹 ⚡️ CLAN PROFILE EDITOR ACTIONS (WITH CANONICAL & INVENTORY LOGIC)
        // ============================================================================
        if (action === "EDIT_CLAN") {
            if (!isAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

            if (payload.newName && payload.newName !== clan.name) {
                // 🛑 1. HARD LOCK CHECK: Prohibit change if clan lock is active
                if (clan.nameLockedUntil && new Date(clan.nameLockedUntil) > new Date()) {
                    return NextResponse.json({
                        message: "Access Denied: Faction Identity is currently hard-locked. Re-branding protocols are prohibited until the lock expires."
                    }, { status: 403 });
                }

                const normalizedNewName = payload.newName.trim();
                const cleanNewName = normalizedNewName.toUpperCase().replace(/[^A-Z0-9]/g, "");
                const safeRegexName = normalizedNewName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

                // 🛡️ 2. CANONICAL COLLISION CHECK (Premium Factions with Active Locks)
                // If a faction paid for a lock, NO ONE can use a variation of their core name.
                const activeClanLock = await Clan.findOne({
                    _id: { $ne: clan._id },
                    $or: [
                        { nameLockedUntil: { $gt: new Date() } },
                        { verifiedClan: true, primeLevel: { $in: [2, 3] } }
                    ],
                    canonicalName: cleanNewName
                });

                if (activeClanLock) {
                    return NextResponse.json({
                        message: `Identity lock active. A variation of '${normalizedNewName}' is reserved by a premium faction.`
                    }, { status: 403 });
                }

                // 🛡️ 4. STANDARD EXACT MATCH CHECK (For Unlocked Names)
                // If it's NOT locked, users can use variations (like The_System), but NOT the exact same string (The System).
                const nameExists = await Clan.findOne({
                    _id: { $ne: clan._id },
                    name: { $regex: new RegExp(`^${safeRegexName}$`, "i") }
                });

                if (nameExists) {
                    return NextResponse.json({ message: "This exact name is already claimed by an active faction." }, { status: 409 });
                }

                // 🛡️ 5. CONSUME ECONOMY ASSET (Allowance OR Re-brand Chip)
                let isAuthorized = false;

                if (payload.usingFreeChange) {
                    // Using Verified Monthly Allowance
                    if (clan.allowances?.freeNameChanges > 0) {
                        clan.allowances.freeNameChanges -= 1;
                        isAuthorized = true;
                    } else {
                        return NextResponse.json({ message: "No Free Name Changes available in Clan Allowances." }, { status: 400 });
                    }
                }
                else if (payload.usingNameChangeCard) {
                    // Using Inventory Asset
                    const cardIndex = clan.specialInventory?.findIndex(item => item.itemId === "clan_name_change");

                    if (cardIndex !== undefined && cardIndex !== -1) {
                        if (clan.specialInventory[cardIndex].itemCount > 1) {
                            clan.specialInventory[cardIndex].itemCount -= 1;
                        } else {
                            clan.specialInventory.splice(cardIndex, 1);
                        }
                        isAuthorized = true;
                    } else {
                        return NextResponse.json({
                            message: "Profile update blocked: A Clan Re-brand Protocol Chip is required to change faction identity."
                        }, { status: 400 });
                    }
                }
                else {
                    // Request sent name change without auth flags
                    return NextResponse.json({
                        message: "Profile updated, but a Clan Re-brand Chip or Free Allowance is required to alter faction identity."
                    }, { status: 400 });
                }

                // ⚡️ APPLY NAME AND CANONICAL CHANGES
                if (isAuthorized) {
                    clan.name = normalizedNewName;
                    clan.canonicalName = cleanNewName;
                }
            }

            // Always update description if provided
            if (payload.description !== undefined) {
                clan.description = payload.description;
            }
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

            try {
                const targetUser = await MobileUser.findById(payload.userId).select("pushToken _id");
                if (targetUser?.pushToken) {
                    await sendPillParallel(
                        [targetUser.pushToken],
                        "Application Accepted! ⚔️",
                        `You are now a member of [${clan.name}]!`,
                        { screen: "/clanprofile", clanTag: clan.tag },
                        { type: 'clan_alert', targetAudience: 'user', targetId: targetUser._id.toString(), link: `/clanprofile`, priority: 3 }
                    );
                }
            } catch (e) { console.error("Notification Error:", e); }
        }

        if (action === "DECLINE_MEMBER") {
            if (!isAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
            clan.joinRequests = clan.joinRequests.filter(r => r.userId.toString() !== payload.userId);

            try {
                const targetUser = await MobileUser.findById(payload.userId).select("pushToken _id");
                if (targetUser?.pushToken) {
                    await sendPillParallel(
                        [targetUser.pushToken],
                        "Application Declined",
                        `[${clan.name}] has declined your request to join.`,
                        { screen: "/clanprofile?tab=shinobi" },
                        { type: 'clan_alert', targetAudience: 'user', targetId: targetUser._id.toString(), link: `/clanprofile?tab=shinobi`, priority: 3 }
                    );
                }
            } catch (e) { console.error("Notification Error:", e); }
        }

        if (action === "KICK_MEMBER") {
            if (!isAdmin) return NextResponse.json({ message: "Forbidden" }, { status: 403 });
            if (payload.userId === clan.leader.toString()) return NextResponse.json({ message: "Cannot kick leader" }, { status: 400 });

            if (payload.userId === clan.viceLeader?.toString()) clan.viceLeader = null;
            clan.members = clan.members.filter(m => m.toString() !== payload.userId);

            try {
                const targetUser = await MobileUser.findById(payload.userId).select("pushToken _id");
                if (targetUser?.pushToken) {
                    await sendPillParallel(
                        [targetUser.pushToken],
                        "Removed from Clan",
                        `You have been removed from [${clan.name}].`,
                        { screen: "/clans" },
                        { type: 'clan_alert', targetAudience: 'user', targetId: targetUser._id.toString(), priority: 3 }
                    );
                }
            } catch (e) { console.error("Notification Error:", e); }
        }

        if (action === "LEAVE_CLAN") {
            if (clan.leader.toString() === user._id.toString()) return NextResponse.json({ message: "Transfer leadership first" }, { status: 403 });
            if (user._id.toString() === clan.viceLeader?.toString()) clan.viceLeader = null;
            clan.members = clan.members.filter(m => m.toString() !== user._id.toString());
        }

        if (action === "SEND_MESSAGE") {
            const isMember = clan.members.some(m => m.toString() === user._id.toString()) || isLeader || isVice;
            if (!isMember) return NextResponse.json({ message: "Forbidden" }, { status: 403 });

            if (!clan.messages) clan.messages = [];
            clan.messages.push({
                authorId: user.deviceId,
                authorUserId: user._id,
                authorName: user.username,
                text: payload.text,
                date: new Date()
            });

            if (clan.messages.length > 250) clan.messages = clan.messages.slice(-250);

            try {
                const memberIds = [clan.leader, clan.viceLeader, ...clan.members].filter(
                    id => id && id.toString() !== user._id.toString()
                );

                const recipients = await MobileUser.find({
                    _id: { $in: memberIds },
                    pushToken: { $exists: true, $ne: null }
                }).select("pushToken");

                const tokens = [...new Set(recipients.map(r => r.pushToken))];

                if (tokens.length > 0) {
                    await sendPillParallel(
                        tokens,
                        `${clan.name} Hall`,
                        `${user.username}: ${payload.text.slice(0, 100)}`,
                        { screen: "/clanprofile?tab=hall", clanTag: clan.tag, type: "CLAN_CHAT" },
                        { type: 'clan_message', targetAudience: 'clan', targetId: clan.tag, link: `/clanprofile?tab=hall`, priority: 4 }
                    );
                }
            } catch (pushErr) { console.error("Push Error:", pushErr); }
        }

        clan.markModified('allowances');
        clan.markModified('specialInventory');
        clan.markModified('activeCustomizations');
        const savedClan = await clan.save();

        return NextResponse.json({ success: true, clan: savedClan });

    } catch (err) {
        console.error("Clan PATCH Error:", err);
        return NextResponse.json({ message: "Update failed", error: err.message }, { status: 500 });
    }
}
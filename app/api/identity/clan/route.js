import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        await connectDB();

        const body = await req.json();
        const { deviceId, clanId, actionType } = body;

        if (!deviceId || !clanId || !actionType) {
            return NextResponse.json({ message: "Missing network identifiers or clan targets." }, { status: 400 });
        }

        const validActions = ['name_change', 'name_lock'];
        if (!validActions.includes(actionType)) {
            return NextResponse.json({ message: "Invalid action protocol." }, { status: 400 });
        }

        // 🛡️ 1. IDENTIFY USER OPERATOR
        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ message: "User matrix not found." }, { status: 404 });

        // 🛡️ 2. IDENTIFY CLAN TARGET (Supports Tag string or ObjectId string)
        const queryFilter = clanId.length === 24
            ? { _id: clanId }
            : { tag: clanId.toUpperCase() };

        const clan = await Clan.findOne(queryFilter);
        if (!clan) return NextResponse.json({ message: "Clan network parameters not found." }, { status: 404 });

        // 🛡️ 3. SECURITY AUTHORITY VERIFICATION (Leader or Vice Leader required)
        const isAuthorizedAdmin =
            clan.leader?.toString() === user._id.toString() ||
            clan.viceLeader?.toString() === user._id.toString();

        if (!isAuthorizedAdmin) {
            return NextResponse.json({
                message: "Access Denied: Only Clan Leaders or Vice Leaders can authorize vault expenditures."
            }, { status: 403 });
        }

        const now = new Date();

        // ============================================================================
        // 🛑 ACTION-SPECIFIC GUARDS & PRICING CONFIGURATION
        // ============================================================================
        let clanCostCC = 0;
        let paymentMessage = "";
        let calculatedLockExpiry = null;

        if (actionType === 'name_change') {
            // 🛑 CLAN IDENTITY HARD-LOCK GUARD
            if (clan.nameLockedUntil && new Date(clan.nameLockedUntil) > now) {
                return NextResponse.json({
                    message: "Access Denied: Faction Identity is currently hard-locked. Re-branding protocols are prohibited until the lock window expires."
                }, { status: 403 });
            }

            clanCostCC = 300;
        }
        else if (actionType === 'name_lock') {
            clanCostCC = 1000; // 500 CC / Year

            const currentLock = clan.nameLockedUntil ? new Date(clan.nameLockedUntil) : null;

            if (currentLock && currentLock > now) {
                const daysRemaining = (currentLock.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

                if (daysRemaining > 30) {
                    return NextResponse.json({
                        message: `Identity is already locked. Faction defenses cannot be extended until less than 30 days remain (Current: ${Math.floor(daysRemaining)} days).`
                    }, { status: 400 });
                }
                calculatedLockExpiry = new Date(currentLock.getTime() + 365 * 24 * 60 * 60 * 1000);
            } else {
                calculatedLockExpiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            }
        }

        // ============================================================================
        // 🧠 ECONOMY ENGINE (CLAN TREASURY VAULT)
        // ============================================================================
        if ((clan.spendablePoints || 0) < clanCostCC) {
            return NextResponse.json({
                message: `Insufficient Clan Coins. Treasury requires ${clanCostCC} CC for item clearance.`
            }, { status: 400 });
        }

        clan.spendablePoints -= clanCostCC;
        paymentMessage = `${clanCostCC} CC deducted from your Faction Vault.`;

        // ============================================================================
        // ⚡ dependency inject flag setup
        // ============================================================================
        if (!clan.specialInventory) {
            clan.specialInventory = [];
        }

        if (actionType === 'name_change') {
            const existingItemIndex = clan.specialInventory.findIndex(i => i.itemId === 'clan_name_change');

            if (existingItemIndex > -1) {
                clan.specialInventory[existingItemIndex].itemCount = (clan.specialInventory[existingItemIndex].itemCount || 1) + 1;
            } else {
                clan.specialInventory.push({
                    itemId: 'clan_name_change',
                    name: 'Clan Re-brand Protocol',
                    category: 'IDENTITY',
                    rarity: 'Epic',
                    isConsumable: true,
                    description: "Authorizes the Clan Leader to securely change the Clan Name and Tag across the global database.",
                    itemCount: 1,
                    visualConfig: { primaryColor: '#8b5cf6', secondaryColor: '#c084fc' },
                    acquiredAt: now,
                    expiresAt: null
                });
            }
            paymentMessage += " Faction Re-brand Protocol Chip delivered to layout vault!";
        }
        else if (actionType === 'name_lock') {
            clan.nameLockedUntil = calculatedLockExpiry;

            // ⚡️ CRITICAL CLAN OPTIMIZATION: Save Canonical Core strings for ultra-fast indexing lookups!
            const cleanNameCore = clan.name.toUpperCase().replace(/[^A-Z0-9]/g, "");
            const cleanTagCore = clan.tag.toUpperCase().replace(/[^A-Z0-9]/g, "");

            clan.canonicalName = cleanNameCore;
            clan.canonicalTag = cleanTagCore;

            console.log("🔒 Saved Clan Canonical Fields:", { name: clan.canonicalName, tag: clan.canonicalTag });

            const existingLockIndex = clan.specialInventory.findIndex(i => i.itemId === 'clan_name_lock');
            if (existingLockIndex > -1) {
                clan.specialInventory[existingLockIndex].expiresAt = calculatedLockExpiry;
            } else {
                clan.specialInventory.push({
                    itemId: 'clan_name_lock',
                    name: 'Absolute Tag Lock',
                    category: 'IDENTITY',
                    rarity: 'Legendary',
                    isConsumable: false,
                    itemCount: 1,
                    acquiredAt: now,
                    expiresAt: calculatedLockExpiry
                });
            }
            paymentMessage += " 365-day Faction Identity protection matrix activated!";
        }

        clan.markModified('specialInventory');

        // Save documents
        await clan.save();

        return NextResponse.json({
            success: true,
            message: paymentMessage,
            clanBalance: clan.spendablePoints,
            specialInventory: clan.specialInventory,
            lockedUntil: actionType === 'name_lock' ? calculatedLockExpiry : undefined
        }, { status: 200 });

    } catch (err) {
        console.error("Critical Clan Identity Purchase Failure:", err);
        return NextResponse.json({ message: "Server error", error: "Faction transaction matrix routing failed." }, { status: 500 });
    }
}
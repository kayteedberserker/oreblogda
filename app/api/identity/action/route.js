import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        await connectDB();

        const body = await req.json();
        const { deviceId, actionType } = body;

        if (!deviceId || !actionType) {
            return NextResponse.json({ message: "Missing system identifiers." }, { status: 400 });
        }

        const validActions = ['name_change', 'name_lock'];
        if (!validActions.includes(actionType)) {
            return NextResponse.json({ message: "Invalid action protocol." }, { status: 400 });
        }

        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ message: "User matrix not found." }, { status: 404 });

        const now = new Date();

        // ============================================================================
        // 🛑 ACTION-SPECIFIC GUARDS & PRICING CONFIGURATION
        // ============================================================================
        let userCostOC = 0;
        let paymentMessage = "";
        let calculatedLockExpiry = null;

        if (actionType === 'name_change') {
            // 🛑 OPTION 1 STRICT LOCK CHECK: Prevent purchasing a name change if identity is hard-locked
            if (user.nameLockedUntil && new Date(user.nameLockedUntil) > now) {
                return NextResponse.json({
                    message: "Access Denied: Your Identity is currently hard-locked. Name changes are prohibited until the lock expires."
                }, { status: 403 });
            }

            userCostOC = 200;
        }
        else if (actionType === 'name_lock') {
            userCostOC = 1000;

            const currentLock = user.nameLockedUntil ? new Date(user.nameLockedUntil) : null;

            if (currentLock && currentLock > now) {
                const daysRemaining = (currentLock.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);

                if (daysRemaining > 30) {
                    return NextResponse.json({
                        message: `Identity is already locked. You cannot extend it until less than 30 days remain (Current: ${Math.floor(daysRemaining)} days).`
                    }, { status: 400 });
                }
                calculatedLockExpiry = new Date(currentLock.getTime() + 365 * 24 * 60 * 60 * 1000);
            } else {
                calculatedLockExpiry = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);
            }
        }

        // ============================================================================
        // 🧠 ECONOMY TRANSACTION ENGINE
        // ============================================================================
        if ((user.coins || 0) < userCostOC) {
            return NextResponse.json({ message: `Insufficient OC. ${userCostOC} OC required.` }, { status: 400 });
        }

        user.coins -= userCostOC;
        user.coinTransactionHistory = user.coinTransactionHistory || [];
        user.coinTransactionHistory.push({
            action: "SPENT",
            type: `BUY_${actionType.toUpperCase()}`,
            amount: userCostOC,
            date: now
        });
        paymentMessage = `${userCostOC} OC spent.`;

        // ============================================================================
        // ⚡️ APPLY TO INVENTORY / IDENTITY FLAGS
        // ============================================================================
        if (!user.inventory) {
            user.inventory = [];
        }

        if (actionType === 'name_change') {
            const existingItemIndex = user.inventory.findIndex(i => i.itemId === 'name_change_card');
            if (existingItemIndex > -1) {
                user.inventory[existingItemIndex].itemCount = (user.inventory[existingItemIndex].itemCount || 1) + 1;
            } else {
                user.inventory.push({
                    itemId: 'name_change_card',
                    name: 'ID Modification Chip',
                    category: 'IDENTITY',
                    rarity: 'Rare',
                    isConsumable: true,
                    description: "Grants authorization to securely clear and update your profile username across the network.",
                    itemCount: 1,
                    visualData: { primaryColor: '#8b5cf6', secondaryColor: '#c084fc' }, // Cyberpunk Purple
                    acquiredAt: now,
                    expiresAt: null
                });
            }
            paymentMessage += " Name Change Card added to inventory!";
        }
        else if (actionType === 'name_lock') {
            user.nameLockedUntil = calculatedLockExpiry;

            // ⚡️ CRITICAL OPTIMIZATION: Save Canonical Core for fast MongoDB indexing
            const cleanCore = user.username.toUpperCase().replace(/[^A-Z0-9]/g, "");
            user.canonicalUsername = cleanCore;
            const existingLockIndex = user.inventory.findIndex(i => i.itemId === 'name_lock');
            if (existingLockIndex > -1) {
                user.inventory[existingLockIndex].expiresAt = calculatedLockExpiry;
            } else {
                user.inventory.push({
                    itemId: 'name_lock',
                    name: 'Identity Lock',
                    category: 'SPECIAL',
                    rarity: 'Legendary',
                    isConsumable: false,
                    itemCount: 1,
                    acquiredAt: now,
                    expiresAt: calculatedLockExpiry
                });
            }
            paymentMessage += " Identity locked for 1 Year!";
        }

        user.markModified('inventory');

        // Save document
        await user.save();

        // =======================================================================
        // ⚡️ CRITICAL PAYLOAD OPTIMIZATION: UNCONDITIONALLY STRIP SVGS TO PREVENT CRASHES
        // =======================================================================
        const safeInventoryPayload = user.inventory.map(item => {
            const safeItem = item.toObject ? item.toObject() : { ...item };

            if (safeItem.visualConfig) {
                safeItem.visualConfig = { ...safeItem.visualConfig };
                delete safeItem.visualConfig.svgCode;
            }
            if (safeItem.visualData) {
                safeItem.visualData = { ...safeItem.visualData };
                delete safeItem.visualData.svgCode;
            }
            return safeItem;
        });

        return NextResponse.json({
            success: true,
            message: paymentMessage,
            balance: user.coins,
            inventory: safeInventoryPayload,
            lockedUntil: actionType === 'name_lock' ? calculatedLockExpiry : undefined
        }, { status: 200 });

    } catch (err) {
        console.error("Critical Identity Purchase Error:", err);
        return NextResponse.json({ message: "Server error", error: "Transaction processing failed." }, { status: 500 });
    }
}
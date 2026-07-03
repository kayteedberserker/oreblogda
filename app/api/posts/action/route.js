import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        await connectDB();

        const { deviceId, postId, context = 'user', actionType } = await req.json();

        if (!deviceId || !postId || !actionType) {
            return NextResponse.json({ message: "Missing system identifiers or action type." }, { status: 400 });
        }

        const validActions = ['resurrect', 'boost'];
        if (!validActions.includes(actionType)) {
            return NextResponse.json({ message: "Invalid action protocol." }, { status: 400 });
        }

        const [user, post] = await Promise.all([
            MobileUser.findOne({ deviceId }),
            Post.findById(postId)
        ]);

        if (!user || !post) {
            return NextResponse.json({ message: "Target parameters not found in matrix." }, { status: 404 });
        }

        const isClanPost = !!post.clanId;
        let clan = null;
        let isClanAdmin = false;

        // 🛡️ FETCH CLAN & VERIFY ADMIN
        if (isClanPost) {
            clan = await Clan.findOne({ tag: post.clanId.toUpperCase() }).select("leader viceLeader allowances spendablePoints");
            if (!clan) return NextResponse.json({ message: "Clan network not found." }, { status: 404 });

            isClanAdmin = clan.leader?.toString() === user._id.toString() || clan.viceLeader?.toString() === user._id.toString();
        }

        // 🛡️ SECURITY & AUTHORIZATION CHECKS
        const isAuthor = post.authorUserId?.toString() === user._id.toString() || post.authorId === deviceId;

        if (context === 'clan') {
            if (!isClanPost) return NextResponse.json({ message: "Cannot use Clan resources for a personal transmission." }, { status: 400 });
            if (!isClanAdmin) return NextResponse.json({ message: "Access Denied: Only Clan Leaders can authorize vault expenditures." }, { status: 403 });
        } else {
            // If paying from personal wallet, they must be the author OR a clan admin covering the cost for a clan post
            if (!isAuthor && !isClanAdmin) {
                return NextResponse.json({ message: "Access Denied: You do not control this transmission." }, { status: 403 });
            }
        }

        const now = new Date();

        // ============================================================================
        // 🛑 ACTION-SPECIFIC GUARDS & CONFIGURATION
        // ============================================================================
        let targetInventoryItem = '';
        let userCostOC = 0;
        let clanCostCC = 0;
        let clanAllowanceField = null;

        if (actionType === 'resurrect') {
            const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);
            if (post.resurrectedAt && post.resurrectedAt > twelveHoursAgo) {
                return NextResponse.json({ message: "Anomalous energy level. This transmission has already been revived, wait 24 hours to try again." }, { status: 400 });
            }

            targetInventoryItem = 'post_resurrection';
            clanCostCC = 200;
            clanAllowanceField = 'postResurrections';
            // ⚡️ PRICING RULE: 150 OC for Personal Post, 300 OC to resurrect a Clan Post from a personal wallet
            userCostOC = isClanPost ? 300 : 150;
        }
        else if (actionType === 'boost') {
            if (post.boostedUntil && new Date(post.boostedUntil) > now) {
                return NextResponse.json({ message: "This transmission is already boosted." }, { status: 400 });
            }

            targetInventoryItem = 'post_boost';
            clanCostCC = 100;
            // ⚡️ UPDATED PRICING RULE (1 CC = 2 OC parity): 
            // 100 OC for Personal Post, 200 OC to boost a Clan Post from a personal wallet
            userCostOC = isClanPost ? 200 : 100;
        }

        // ============================================================================
        // 🧠 CONTEXTUAL ECONOMY TRANSACTION
        // ============================================================================
        let paymentMessage = "";

        if (context === 'clan') {
            // 1. Try Clan Allowance 
            if (clanAllowanceField && clan.allowances?.[clanAllowanceField] > 0) {
                clan.allowances[clanAllowanceField] -= 1;
                paymentMessage = `Clan Allowance consumed. Transmission ${actionType}ed!`;
            }
            // 2. Charge Clan Vault (CC)
            else {
                if ((clan.spendablePoints || 0) < clanCostCC) {
                    return NextResponse.json({ message: `Insufficient Clan Coins. ${clanCostCC} CC required in vault.` }, { status: 400 });
                }
                clan.spendablePoints -= clanCostCC;
                paymentMessage = `${clanCostCC} CC spent from Clan vault. Transmission ${actionType}ed!`;
            }
        }
        else {
            // 1. Try Personal Inventory Pass
            const itemIndex = user.inventory?.findIndex(i => i.itemId === targetInventoryItem);

            if (itemIndex !== undefined && itemIndex > -1) {
                if (user.inventory[itemIndex].itemCount > 1) {
                    user.inventory[itemIndex].itemCount -= 1;
                } else {
                    user.inventory.splice(itemIndex, 1);
                }
                user.markModified('inventory');
                paymentMessage = `Inventory Scroll consumed. Transmission ${actionType}ed!`;
            }
            // 2. Charge Personal Wallet (OC)
            else {
                if ((user.coins || 0) < userCostOC) {
                    return NextResponse.json({ message: `Insufficient OC. Scroll or ${userCostOC} OC required.` }, { status: 400 });
                }
                user.coins -= userCostOC;
                user.coinTransactionHistory = user.coinTransactionHistory || [];
                user.coinTransactionHistory.push({
                    action: "SPENT",
                    type: `POST_${actionType.toUpperCase()}`,
                    amount: userCostOC,
                    date: now
                });
                paymentMessage = `${userCostOC} OC spent. Transmission ${actionType}ed!`;
            }
        }

        // ============================================================================
        // ⚡️ APPLY THE EFFECT
        // ============================================================================
        if (actionType === 'resurrect') {
            post.resurrectedAt = now;
        } else if (actionType === 'boost') {
            post.boostedUntil = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24-hour boost
        }

        // Save all modified documents concurrently
        const savePromises = [user.save(), post.save()];
        if (isClanPost && clan) savePromises.push(clan.save());

        await Promise.all(savePromises);

        return NextResponse.json({
            success: true,
            message: paymentMessage,
            resurrectedAt: post.resurrectedAt,
            boostedUntil: post.boostedUntil
        }, { status: 200 });

    } catch (err) {
        console.error(`Critical Post ${req.body?.actionType || 'Action'} Error:`, err);
        return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
    }
}
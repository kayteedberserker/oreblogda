import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import UserStreak from "@/app/models/UserStreak";
import { NextResponse } from "next/server";

export async function POST(req) {
    try {
        await connectDB();
        const { deviceId } = await req.json();
        const now = new Date();
        const standardExpiryMs = 48 * 60 * 60 * 1000; // 48 hours grace period

        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

        let streakDoc = await UserStreak.findOne({ userId: user._id });

        // ⚡ Determine Boost Amount
        const isBoosted = user.doubleStreakUntil && new Date(user.doubleStreakUntil) > now;
        const incrementAmount = isBoosted ? 2 : 1;

        // =======================================================================
        // INITIAL STREAK CREATION / AUTO-RESTORE
        // =======================================================================
        if (!streakDoc) {
            let isAutoRestored = false;
            let finalStreakValue = incrementAmount;
            let userUpdateQuery = { $set: {} };

            if (user.lastStreak > 0 && user.inventory) {
                const itemIndex = user.inventory.findIndex(i => i.itemId === 'streak_restore');

                if (itemIndex > -1) {
                    if (user.inventory[itemIndex].itemCount > 1) {
                        user.inventory[itemIndex].itemCount -= 1;
                    } else {
                        user.inventory.splice(itemIndex, 1);
                    }

                    finalStreakValue = user.lastStreak + incrementAmount;
                    isAutoRestored = true;

                    userUpdateQuery.$set.inventory = user.inventory;
                }
            }

            // Check if user is entering a protected clan right at creation
            const clan = await Clan.findOne({
                $or: [{ leader: user._id }, { viceLeader: user._id }, { members: user._id }]
            }).select("verifiedUntil allowances.passiveStreakFreezeActive").lean();

            const hasClanFreeze = clan && clan.verifiedUntil && new Date(clan.verifiedUntil) > now && clan.allowances?.passiveStreakFreezeActive;

            // Calculate dynamic initial TTL
            let initialExpiry = new Date(now.getTime() + standardExpiryMs);
            if (hasClanFreeze) {
                initialExpiry = new Date(new Date(clan.verifiedUntil).getTime() + standardExpiryMs);
            }

            streakDoc = await UserStreak.create({
                userId: user._id,
                streak: finalStreakValue,
                lastPostDate: now,
                expiresAt: initialExpiry,
            });

            userUpdateQuery.$set.lastStreak = streakDoc.streak;
            await MobileUser.updateOne({ _id: user._id }, userUpdateQuery);

            let returnMessage = isBoosted ? "First post! 2X Referral Boost applied!" : "First post, streak started!";
            if (isAutoRestored) {
                returnMessage = `Auto-Restored! Pass consumed. +${incrementAmount} gained.`;
            }

            return NextResponse.json({
                streak: streakDoc.streak,
                isBoosted,
                message: returnMessage,
            });
        }

        // =======================================================================
        // EXISTING STREAK INCREMENT
        // =======================================================================
        const lastPost = new Date(streakDoc.lastPostDate);
        const hoursSinceLastPost = (now - lastPost) / (1000 * 60 * 60);

        if (hoursSinceLastPost < 12) {
            return NextResponse.json({
                streak: streakDoc.streak,
                message: "Neural link cooling down. Try again later.",
            });
        }

        // Apply increment
        streakDoc.streak += incrementAmount;
        streakDoc.lastPostDate = now;

        // Fetch Clan status for JIT Evaluation
        const clan = await Clan.findOne({
            $or: [{ leader: user._id }, { viceLeader: user._id }, { members: user._id }]
        }).select("verifiedUntil allowances.passiveStreakFreezeActive").lean();

        const hasClanFreeze = clan && clan.verifiedUntil && new Date(clan.verifiedUntil) > now && clan.allowances?.passiveStreakFreezeActive;
        const hasConsumableFreeze = streakDoc.frozenUntil && new Date(streakDoc.frozenUntil) > now;

        // ⚡️ DYNAMIC TTL EVALUATION (Never set to null)
        let maxProtectionTime = now.getTime();

        if (hasClanFreeze) {
            maxProtectionTime = Math.max(maxProtectionTime, new Date(clan.verifiedUntil).getTime());
        }
        if (hasConsumableFreeze) {
            maxProtectionTime = Math.max(maxProtectionTime, new Date(streakDoc.frozenUntil).getTime());
        }

        // Add the 48 hour grace period to the absolute end of their protection window
        streakDoc.expiresAt = new Date(maxProtectionTime + standardExpiryMs);

        await Promise.all([
            streakDoc.save(),
            MobileUser.updateOne({ _id: user._id }, { $set: { lastStreak: streakDoc.streak } }),
        ]);

        // TRIGGER BONFIRE
        if (clan && clan.allowances?.bonfireActive) {
            await triggerClanBonfire(clan, now, incrementAmount, user._id);
        }

        return NextResponse.json({
            streak: streakDoc.streak,
            isBoosted,
            message: isBoosted ? `Double Streak Active! +${incrementAmount} gained.` : "Streak increased!",
        });

    } catch (err) {
        return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
    }
}

// =======================================================================
// 🔥 CLAN BONFIRE HELPER WITH SMART TTL
// =======================================================================
async function triggerClanBonfire(clan, now, incrementAmount, triggeringUserId) {
    const membersToIgnite = clan.members.filter(id => id.toString() !== triggeringUserId.toString());
    if (membersToIgnite.length === 0) return;

    const [allMemberStreaks, allUsers] = await Promise.all([
        UserStreak.find({ userId: { $in: membersToIgnite } }),
        MobileUser.find({ _id: { $in: membersToIgnite } }).select("lastStreak")
    ]);

    const memberMap = new Map(allMemberStreaks.map(s => [s.userId.toString(), s]));
    const userMap = new Map(allUsers.map(u => [u._id.toString(), u]));

    const updates = [];
    const standardExpiryMs = 48 * 60 * 60 * 1000;

    // Cache clan protection date if active
    const hasClanFreeze = clan.verifiedUntil && new Date(clan.verifiedUntil) > now && clan.allowances?.passiveStreakFreezeActive;
    const clanFreezeEndMs = hasClanFreeze ? new Date(clan.verifiedUntil).getTime() : now.getTime();

    for (const memberId of membersToIgnite) {
        const streakDoc = memberMap.get(memberId.toString());
        const user = userMap.get(memberId.toString());

        if (streakDoc && (now - new Date(streakDoc.lastPostDate)) / (1000 * 60 * 60) < 12) continue;

        if (streakDoc && streakDoc.streak > 0) {
            // INCREMENT logic
            streakDoc.streak += incrementAmount;
            streakDoc.lastPostDate = now;

            // Compute structural maximum protection for this specific teammate
            const hasConsumableFreeze = streakDoc.frozenUntil && new Date(streakDoc.frozenUntil) > now;
            const consumableFreezeEndMs = hasConsumableFreeze ? new Date(streakDoc.frozenUntil).getTime() : now.getTime();

            const maxProtectionTime = Math.max(now.getTime(), clanFreezeEndMs, consumableFreezeEndMs);
            streakDoc.expiresAt = new Date(maxProtectionTime + standardExpiryMs);

            updates.push(streakDoc.save());
            updates.push(MobileUser.updateOne({ _id: memberId }, { $set: { lastStreak: streakDoc.streak } }));
        }
        else if ((!streakDoc || streakDoc.streak === 0) && user?.lastStreak > 0) {
            // RESTORE logic
            const maxProtectionTime = Math.max(now.getTime(), clanFreezeEndMs);
            const newExpiresAt = new Date(maxProtectionTime + standardExpiryMs);

            const restoredStreak = await UserStreak.create({
                userId: memberId,
                streak: user.lastStreak,
                lastPostDate: now,
                expiresAt: newExpiresAt
            });
            updates.push(Promise.resolve(restoredStreak));
        }
    }

    await Promise.all(updates);
}
import { createMessagePill } from '@/app/lib/messagePillService'; // ⚡️ IMPORT PILL SERVICE
import Clan from '@/app/models/ClanModel';
import { updateWarProgress } from './warService';

/**
 * Award points, increment stats, and check for real-time badges like One-Shot
 * Now includes stacking logic for Verified status and Item Multipliers.
 */
export async function awardClanPoints(post, actionPoints, type = null) {
    if (!post || (!post.clanId && !post.category?.startsWith("Clan:"))) return;

    const clanTag = post.clanId || (post.category.split(":")[2]);
    if (!clanTag) return;

    // --- 💎 MULTIPLIER LOGIC (VERIFIED + ITEM) ---
    const clanDoc = await Clan.findOne({ tag: clanTag })
        .select('totalPoints verifiedUntil activeMultiplier multiplierExpiresAt badges consecutiveWeeksNoDerank');

    if (!clanDoc) return;

    let totalMultiplier = 1;
    const now = new Date();

    // 1. Check if the clan is verified (1.5x boost)
    if (clanDoc.verifiedUntil && new Date(clanDoc.verifiedUntil) > now) {
        totalMultiplier += 0.5;
    }

    // 2. Check for an active item multiplier (e.g., 2x, 3x)
    if (
        clanDoc.activeMultiplier > 1 &&
        clanDoc.multiplierExpiresAt &&
        clanDoc.multiplierExpiresAt > now
    ) {
        totalMultiplier += (clanDoc.activeMultiplier - 1);
    }

    const finalPoints = Math.round(actionPoints * totalMultiplier);

    // --- 🛡️ DEBT FORGIVENESS & REDEMPTION LOGIC ---
    const isNegative = (clanDoc.totalPoints || 0) < 0;

    let updateQuery = {
        $set: { lastActive: new Date() }
    };

    if (isNegative) {
        // 🔥 Instant recovery: Reset debt to 0 and add new points
        updateQuery.$set.totalPoints = finalPoints;
        updateQuery.$set.currentWeeklyPoints = finalPoints;

        // 🎖️ Grant Redemption badge for clearing the debt
        updateQuery.$addToSet = { badges: "Redemption" };

        // ⚡️ SEND REDEMPTION PILL
        await createMessagePill({
            text: `DEBT CLEARED: YOUR CLAN HAS EARNED THE "REDEMPTION" BADGE. RISING FROM THE ASHES!`,
            type: 'achievement',
            targetAudience: 'clan',
            link: "/clanprofile",
            targetId: clanTag,
            priority: 10, // High Priority
            expiresInHours: 24,
            replaceExistingType: false
        });

    } else {
        // Normal behavior for positive or zero point clans
        updateQuery.$inc = {
            totalPoints: finalPoints,
            currentWeeklyPoints: finalPoints
        };
    }

    // Initialize $inc if it doesn't exist yet
    if (!updateQuery.$inc) updateQuery.$inc = {};

    // Increment specific stats
    if (type === 'like') updateQuery.$inc['stats.likes'] = 1;
    if (type === 'view') updateQuery.$inc['stats.views'] = 5;
    if (type === 'comment') updateQuery.$inc['stats.comments'] = 1;
    if (type === 'share') updateQuery.$inc['stats.shares'] = 1;

    // Clean up empty $inc if necessary
    if (Object.keys(updateQuery.$inc).length === 0) delete updateQuery.$inc;

    // 2. Update the clan in the database
    const updatedClan = await Clan.findOneAndUpdate(
        { tag: clanTag },
        updateQuery,
        { new: true }
    );

    if (!updatedClan) return;

    // --- ⚔️ UPDATE WAR SCORE ---
    await updateWarProgress(clanTag, finalPoints, type);

    // --- 🏅 ONE-SHOT BADGE CHECK (Only on likes) ---
    if (type === 'like' && !updatedClan.badges.includes("One-Shot") && post.likes) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

        const recentLikes = post.likes.filter(l => {
            const likeDate = l.date ? new Date(l.date) : new Date();
            return likeDate > oneHourAgo;
        });

        if (recentLikes.length >= 500) {
            await Clan.updateOne(
                { _id: updatedClan._id },
                { $addToSet: { badges: "One-Shot" } }
            );

            // ⚡️ SEND ONE-SHOT PILL
            await createMessagePill({
                text: `VIRAL ANOMALY: YOUR CLAN UNLOCKED THE "ONE-SHOT" BADGE (500+ LIKES IN 1 HOUR)!`,
                type: 'achievement',
                targetAudience: 'clan',
                link: "/clanprofile",
                targetId: clanTag,
                priority: 10, // Max Priority
                expiresInHours: 24,
                replaceExistingType: false
            });
        }
    }

    // ====================================================================
    // ⚡️ SEND CLAN POINTS ACCUMULATOR PILL
    // ====================================================================
    if (finalPoints > 0 && !isNegative) {
        await createMessagePill({
            text: `+${finalPoints} Clan Points Gained.`,
            type: 'clan_points', // ⚡️ New type
            targetAudience: 'clan',
            targetId: clanTag,
            link: "/clanprofile",
            priority: 2, // Low priority so it doesn't block major Event/Achievement pills
            expiresInHours: 24,
            replaceExistingType: true
        });
    }
}
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
    // Fetch the clan with all multiplier-related fields
    const clanDoc = await Clan.findOne({ tag: clanTag })
        .select('verifiedUntil activeMultiplier multiplierExpiresAt');
    
    let totalMultiplier = 1;
    const now = new Date();

    if (clanDoc) {
        // 1. Check if the clan is verified (1.5x boost)
        if (clanDoc.verifiedUntil && new Date(clanDoc.verifiedUntil) > now) {
            totalMultiplier += 0.5;
        }

        // 2. Check for an active item multiplier (e.g., 2x, 3x)
        if (
            clanDoc.activeMultiplier > 1 && 
            clanDoc.multiplierExpiresAt && 
            new Date(clanDoc.multiplierExpiresAt) > now
        ) {
            // If activeMultiplier is 2, we add 1 to the base multiplier
            totalMultiplier += (clanDoc.activeMultiplier - 1);
        }
    }

    const finalPoints = Math.round(actionPoints * totalMultiplier);

    // 1. Build the dynamic increment query based on action type
    const incQuery = { 
        totalPoints: finalPoints,
        currentWeeklyPoints: finalPoints 
    };

    // Increment the specific stats based on your ClanModel schema
    if (type === 'like') incQuery['stats.likes'] = 1;
    if (type === 'view') incQuery['stats.views'] = 5;
    if (type === 'comment') incQuery['stats.comments'] = 1;
    if (type === 'share') incQuery['stats.shares'] = 1;

    const updateQuery = { 
        $inc: incQuery,
        $set: { lastActive: new Date() }
    };
    
    // 2. Update the clan in the database
    const updatedClan = await Clan.findOneAndUpdate(
        { tag: clanTag }, 
        updateQuery,
        { new: true }
    );

    if (!updatedClan) return;

    // --- ⚔️ UPDATE WAR SCORE ---
    // We pass finalPoints (boosted) so the war score reflects multipliers
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
        }
    }
}
import Clan from '@/app/models/ClanModel';
import { updateWarProgress } from './warService'; // Import the new war helper

/**
 * Award points, increment stats, and check for real-time badges like One-Shot
 */
export async function awardClanPoints(post, actionPoints, type = null) {
    if (!post || (!post.clanId && !post.category?.startsWith("Clan:"))) return;

    const clanTag = post.clanId || (post.category.split(":")[2]); 
    if (!clanTag) return;

    // 1. Build the dynamic increment query based on action type
    const incQuery = { 
        totalPoints: actionPoints,
        currentWeeklyPoints: actionPoints 
    };

    // Increment the specific stats based on your ClanModel schema
    if (type === 'like') incQuery['stats.likes'] = 1;
    if (type === 'view') incQuery['stats.views'] = 1;
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
    // This happens in the background every time points/stats are awarded
    await updateWarProgress(clanTag, actionPoints, type);

    // --- 🏅 ONE-SHOT BADGE CHECK (Only on likes) ---
    if (type === 'like' && !updatedClan.badges.includes("One-Shot") && post.likes) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        
        // Ensure we handle the likes array safely
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

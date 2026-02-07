import Clan from '@/app/models/ClanModel';

/**
 * Award points and check for real-time badges like One-Shot
 */
// lib/clanService.js
import { updateWarProgress } from './warService'; // Import the new war helper

export async function awardClanPoints(post, actionPoints, type = null) {
    if (!post || (!post.clanId && !post.category?.startsWith("Clan:"))) return;

    const clanTag = post.clanId || (post.category.split(":")[2]); 
    if (!clanTag) return;

    // ... (All your existing updateQuery logic stays exactly the same)
    const updateQuery = { 
        $inc: { 
            totalPoints: actionPoints,
            currentWeeklyPoints: actionPoints 
        },
        $set: { lastActive: new Date() }
    };
    
    // ... handle stats (likes, views, etc) ...

    const updatedClan = await Clan.findOneAndUpdate(
        { tag: clanTag }, 
        updateQuery,
        { new: true }
    );

    if (!updatedClan) return;

    // --- NEW: UPDATE WAR SCORE ---
    // This happens in the background every time points are awarded
    await updateWarProgress(clanTag, actionPoints, type);
    // --- ONE-SHOT BADGE CHECK (Only on likes) ---
    if (type === 'like' && !updatedClan.badges.includes("One-Shot")) {
        const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
        const recentLikes = post.likes.filter(l => new Date(l.date) > oneHourAgo);
        
        if (recentLikes.length >= 500) {
            await Clan.updateOne(
                { _id: updatedClan._id }, 
                { $addToSet: { badges: "One-Shot" } }
            );
        }
    }
}
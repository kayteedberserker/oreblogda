import ClanWar from '@/app/models/ClanWar';
import Clan from '@/app/models/ClanModel';
import MobileUser from '@/app/models/MobileUserModel'; 
import { sendMultiplePushNotifications } from '@/app/lib/pushNotifications'; 

/**
 * Updates the war progress if the clan is currently in an ACTIVE war.
 * Checks for expiration before every update.
 */
export async function updateWarProgress(clanTag, actionPoints, type) {
    // 1. Find if this clan is in an ACTIVE war
    const activeWar = await ClanWar.findOne({
        status: "ACTIVE",
        $or: [{ challengerTag: clanTag }, { defenderTag: clanTag }]
    });

    if (!activeWar) return;

    // 2. CHECK EXPIRATION: Passive Settlement
    const now = new Date();
    if (activeWar.endTime && now > activeWar.endTime) {
        await completeWar(activeWar);
        return; // Stop point calculation
    }

    // 3. Map the interaction type to categories
    const isPointsMatch = activeWar.warType === "POINTS" || activeWar.warType === "ALL";
    const isLikesMatch = (type === 'like' && activeWar.warType === "LIKES") || activeWar.warType === "ALL";
    const isCommentsMatch = (type === 'comment' && activeWar.warType === "COMMENTS") || activeWar.warType === "ALL";

    if (isPointsMatch || isLikesMatch || isCommentsMatch) {
        const isChallenger = activeWar.challengerTag === clanTag;
        const updateField = isChallenger ? 'currentProgress.challengerScore' : 'currentProgress.defenderScore';

        // Update the War Record
        await ClanWar.updateOne(
            { _id: activeWar._id },
            { $inc: { [updateField]: actionPoints } }
        );

        // Update Cumulative Clan War Stats in Clan Model
        const clanStatsUpdate = {};
        if (type === 'like') clanStatsUpdate['stats.warLikes'] = 1;
        if (type === 'comment') clanStatsUpdate['stats.warComments'] = 1;

        if (Object.keys(clanStatsUpdate).length > 0) {
            await Clan.updateOne({ tag: clanTag }, { $inc: clanStatsUpdate });
        }
    }
}

/**
 * Handles logic for ending a war, distributing points, and notifying all members.
 */
async function completeWar(war) {
    const { challengerScore, defenderScore } = war.currentProgress;
    const stake = war.prizePool;
    const totalPrize = stake * 2;
    let winner = null;

    // Determine Winner
    if (challengerScore > defenderScore) {
        winner = war.challengerTag;
    } else if (defenderScore > challengerScore) {
        winner = war.defenderTag;
    } else {
        winner = "DRAW";
    }

    // 1. GET CLAN DATA & MEMBERS
    const challengerClan = await Clan.findOne({ tag: war.challengerTag });
    const defenderClan = await Clan.findOne({ tag: war.defenderTag });

    if (!challengerClan || !defenderClan) return;

    /**
     * Helper to finalize clan stats using Total Points
     * @param {Object} clan - The clan document
     * @param {Number} share - The total amount to return/award to TotalPoints
     */
    const finalizeClan = async (clan, share) => {
        await Clan.updateOne(
            { _id: clan._id },
            { 
                $set: { isInWar: false, activeWarId: null },
                $inc: { 
                    lockedPoints: -stake, // Clear the escrow
                    totalPoints: share    // Add the winnings/refund back to Total Points
                } 
            }
        );
    };

    // 2. DISTRIBUTION LOGIC (Total Points based)
    if (winner === "DRAW") {
        // Refund original stakes to Total Points
        await finalizeClan(challengerClan, stake);
        await finalizeClan(defenderClan, stake);
    } else if (war.winCondition === "FULL") {
        // Winner gets the whole pot (2x stake) added to Total Points, Loser gets 0
        await finalizeClan(challengerClan, winner === war.challengerTag ? totalPrize : 0);
        await finalizeClan(defenderClan, winner === war.defenderTag ? totalPrize : 0);
    } else if (war.winCondition === "PERCENTAGE") {
        const totalScore = challengerScore + defenderScore;
        if (totalScore > 0) {
            const cShare = Math.floor((challengerScore / totalScore) * totalPrize);
            const dShare = totalPrize - cShare;
            await finalizeClan(challengerClan, cShare);
            await finalizeClan(defenderClan, dShare);
        } else {
            // No activity: Refund original stakes
            await finalizeClan(challengerClan, stake);
            await finalizeClan(defenderClan, stake);
        }
    }

    // 3. SEND PUSH NOTIFICATIONS
    const notifyMembers = async (memberIds, title, message) => {
        const users = await MobileUser.find({ _id: { $in: memberIds } }).select('pushToken');
        const tokens = users.map(u => u.pushToken).filter(t => t);
        if (tokens.length > 0) {
            await sendMultiplePushNotifications(
                tokens, 
                title, 
                message, 
                { screen: 'ClanWarDetails', warId: war.warId }, 
                war.warId
            );
        }
    };

    const drawMsg = `The war between ${war.challengerTag} and ${war.defenderTag} ended in a Draw! Total Points returned.`;
    const winMsg = `VICTORY! Your clan won the war against ${winner === war.challengerTag ? war.defenderTag : war.challengerTag}!`;
    const loseMsg = `DEFEAT. Your clan lost the war against ${winner}.`;

    if (winner === "DRAW") {
        await notifyMembers(challengerClan.members, "War Ended: Draw", drawMsg);
        await notifyMembers(defenderClan.members, "War Ended: Draw", drawMsg);
    } else {
        const winningMembers = winner === war.challengerTag ? challengerClan.members : defenderClan.members;
        const losingMembers = winner === war.challengerTag ? defenderClan.members : challengerClan.members;
        
        await notifyMembers(winningMembers, "War Victory! ⚔️", winMsg);
        await notifyMembers(losingMembers, "War Defeat 🛡️", loseMsg);
    }

    // 4. UPDATE WAR DOCUMENT STATUS & HISTORY
    war.status = "COMPLETED";
    war.winner = winner;
    war.finalSnapshot = { ...war.currentProgress };
    
    // EXTEND EXPIRY: Ensure the record is kept for 30 days history
    war.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 
    
    await war.save();
}
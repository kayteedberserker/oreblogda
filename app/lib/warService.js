import ClanWar from '@/app/models/ClanWar';
import Clan from '@/app/models/ClanModel';
import MobileUser from '@/app/models/MobileUserModel'; 
import { sendMultiplePushNotifications } from '@/app/lib/pushNotifications'; 
import { createMessagePill } from '@/app/lib/messagePillService'; // ⚡️ IMPORT THE PILL SERVICE

/**
 * Updates the war progress if the clan is currently in an ACTIVE war.
 * Checks for expiration before every update.
 */
export async function updateWarProgress(clanTag, actionPoints, type) {
    const activeWar = await ClanWar.findOne({
        status: "ACTIVE",
        $or: [{ challengerTag: clanTag }, { defenderTag: clanTag }]
    });

    if (!activeWar) return;

    const now = new Date();
    if (activeWar.endTime && now > activeWar.endTime) {
        await completeWar(activeWar);
        return; 
    }

    const isPointsMatch = activeWar.warType === "POINTS" || activeWar.warType === "ALL";
    const isLikesMatch = (type === 'like' && activeWar.warType === "LIKES") || activeWar.warType === "ALL";
    const isCommentsMatch = (type === 'comment' && activeWar.warType === "COMMENTS") || activeWar.warType === "ALL";

    if (isPointsMatch || isLikesMatch || isCommentsMatch) {
        const isChallenger = activeWar.challengerTag === clanTag;
        const updateField = isChallenger ? 'currentProgress.challengerScore' : 'currentProgress.defenderScore';

        // ⚡️ UPDATED: Use findOneAndUpdate to get the fresh scores instantly
        const updatedWar = await ClanWar.findOneAndUpdate(
            { _id: activeWar._id },
            { $inc: { [updateField]: actionPoints } },
            { new: true } // Returns the document AFTER the points were added
        );

        // Update Cumulative Clan War Stats in Clan Model
        const clanStatsUpdate = {};
        if (type === 'like') clanStatsUpdate['stats.warLikes'] = 1;
        if (type === 'comment') clanStatsUpdate['stats.warComments'] = 1;

        if (Object.keys(clanStatsUpdate).length > 0) {
            await Clan.updateOne({ tag: clanTag }, { $inc: clanStatsUpdate });
        }

        // ====================================================================
        // ⚡️ THE LIVE SCOREBOARD PILL SYSTEM
        // ====================================================================
        if (updatedWar) {
            const { challengerScore, defenderScore } = updatedWar.currentProgress;
            const diff = Math.abs(challengerScore - defenderScore);
            
            let challengerMsg, defenderMsg;

            // Generate dynamic, competitive messages based on who is winning
            if (challengerScore === defenderScore) {
                challengerMsg = `WAR UPDATE: TIED with ${activeWar.defenderTag} at ${challengerScore} PTS!`;
                defenderMsg = `WAR UPDATE: TIED with ${activeWar.challengerTag} at ${defenderScore} PTS!`;
            } else if (challengerScore > defenderScore) {
                challengerMsg = `WAR UPDATE: 🟢 Dominating ${activeWar.defenderTag} by ${diff} PTS!`;
                defenderMsg = `WAR UPDATE: 🔴 Falling behind ${activeWar.challengerTag} by ${diff} PTS. FIGHT BACK!`;
            } else {
                challengerMsg = `WAR UPDATE: 🔴 Falling behind ${activeWar.defenderTag} by ${diff} PTS. FIGHT BACK!`;
                defenderMsg = `WAR UPDATE: 🟢 Dominating ${activeWar.challengerTag} by ${diff} PTS!`;
            }

            // NOTE: We strictly use type: 'event' so the `replaceExistingType` logic successfully 
            // wipes the old score pill and replaces it with this fresh one, preventing spam.
            
            // Dispatch to Challenger
            await createMessagePill({
                text: challengerMsg,
                type: 'event', 
                targetAudience: 'clan',
                targetId: activeWar.challengerTag,
                priority: 8, // High priority so they see the score instantly
                expiresInHours: 2, // Short lifespan, war scores change fast
                replaceExistingType: true 
            });

            // Dispatch to Defender
            await createMessagePill({
                text: defenderMsg,
                type: 'event',
                targetAudience: 'clan',
                targetId: activeWar.defenderTag,
                priority: 8,
                expiresInHours: 2,
                replaceExistingType: true
            });
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

    if (challengerScore > defenderScore) {
        winner = war.challengerTag;
    } else if (defenderScore > challengerScore) {
        winner = war.defenderTag;
    } else {
        winner = "DRAW";
    }

    const challengerClan = await Clan.findOne({ tag: war.challengerTag });
    const defenderClan = await Clan.findOne({ tag: war.defenderTag });

    if (!challengerClan || !defenderClan) return;

    const finalizeClan = async (clan, share) => {
        await Clan.updateOne(
            { _id: clan._id },
            { 
                $set: { isInWar: false, activeWarId: null },
                $inc: { 
                    lockedPoints: -stake, 
                    totalPoints: share    
                } 
            }
        );
    };

    let cShare = 0;
    let dShare = 0;

    if (winner === "DRAW") {
        cShare = stake; dShare = stake;
        await finalizeClan(challengerClan, stake);
        await finalizeClan(defenderClan, stake);
    } else if (war.winCondition === "FULL") {
        cShare = winner === war.challengerTag ? totalPrize : 0;
        dShare = winner === war.defenderTag ? totalPrize : 0;
        await finalizeClan(challengerClan, cShare);
        await finalizeClan(defenderClan, dShare);
    } else if (war.winCondition === "PERCENTAGE") {
        const totalScore = challengerScore + defenderScore;
        if (totalScore > 0) {
            cShare = Math.floor((challengerScore / totalScore) * totalPrize);
            dShare = totalPrize - cShare;
            await finalizeClan(challengerClan, cShare);
            await finalizeClan(defenderClan, dShare);
        } else {
            cShare = stake; dShare = stake;
            await finalizeClan(challengerClan, stake);
            await finalizeClan(defenderClan, stake);
        }
    }

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
        
        // ⚡️ DRAW PILLS
        await createMessagePill({ text: `WAR CONCLUDED: DRAW AGAINST ${war.defenderTag}`, type: 'event', targetAudience: 'clan', targetId: war.challengerTag, priority: 10, expiresInHours: 24, replaceExistingType: true });
        await createMessagePill({ text: `WAR CONCLUDED: DRAW AGAINST ${war.challengerTag}`, type: 'event', targetAudience: 'clan', targetId: war.defenderTag, priority: 10, expiresInHours: 24, replaceExistingType: true });

    } else {
        const winningMembers = winner === war.challengerTag ? challengerClan.members : defenderClan.members;
        const losingMembers = winner === war.challengerTag ? defenderClan.members : challengerClan.members;
        
        await notifyMembers(winningMembers, "War Victory! ⚔️", winMsg);
        await notifyMembers(losingMembers, "War Defeat 🛡️", loseMsg);

        // ⚡️ VICTORY & DEFEAT PILLS
        const loser = winner === war.challengerTag ? war.defenderTag : war.challengerTag;
        const winnerShare = winner === war.challengerTag ? cShare : dShare;

        // Give the winner an Achievement Pill
        await createMessagePill({
            text: `VICTORY! CRUSHED ${loser} AND SECURED +${winnerShare} POINTS!`,
            type: 'achievement',
            targetAudience: 'clan',
            targetId: winner,
            priority: 10,
            expiresInHours: 24,
            replaceExistingType: true 
        });

        // Give the loser a Warning Pill
        await createMessagePill({
            text: `DEFEAT: LOST THE WAR AGAINST ${winner}. REGROUP AND PREPARE.`,
            type: 'warning',
            targetAudience: 'clan',
            targetId: loser,
            priority: 10,
            expiresInHours: 24,
            replaceExistingType: true 
        });
    }

    war.status = "COMPLETED";
    war.winner = winner;
    war.finalSnapshot = { ...war.currentProgress };
    war.expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); 
    
    await war.save();
}
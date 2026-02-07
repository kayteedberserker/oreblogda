// lib/clanAuth.js (or similar utility file)
import Clan from "@/app/models/ClanModel";

/**
 * Validates if a user is the leader or a member of a specific clan.
 * @param {string} userId - The MongoDB ID of the user
 * @param {string} clanTag - The unique tag of the clan
 * @returns {Object} { isAuthorized: boolean, role: 'leader' | 'member' | null }
 */
export async function checkClanAuth(userId, clanTag) {
    const clan = await Clan.findOne({ tag: clanTag });

    if (!clan) return { isAuthorized: false, role: null };

    if (clan.leader.toString() === userId.toString()) {
        return { isAuthorized: true, role: 'leader' };
    }

    if (clan.members.includes(userId)) {
        return { isAuthorized: true, role: 'member' };
    }

    return { isAuthorized: false, role: null };
}
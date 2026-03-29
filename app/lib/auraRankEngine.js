// The Master Tier List
export const AURA_TIERS = [
  { level: 1, req: 0, title: "E-Rank Novice", icon: "🌱", postLimit: 2 },
  { level: 2, req: 100, title: "D-Rank Operative", icon: "⚔️", postLimit: 3 },
  { level: 3, req: 300, title: "C-Rank Awakened", icon: "🔥", postLimit: 3 },
  { level: 4, req: 700, title: "B-Rank Elite", icon: "⚡", postLimit: 4 },
  { level: 5, req: 1500, title: "A-Rank Champion", icon: "🛡️", postLimit: 4 },
  { level: 6, req: 3000, title: "S-Rank Legend", icon: "🌟", postLimit: 5 },
  { level: 7, req: 6000, title: "SS-Rank Mythic", icon: "🌀", postLimit: 5 },
  { level: 8, req: 12000, title: "Monarch", icon: "👑", postLimit: 6 }, // Unlimited/Max
];

/**
 * Pass in a user's total Aura, and this returns their complete rank profile.
 */
export const calculateAuraRank = (auraPoints) => {
  // Guard against negative or undefined aura
  const points = Math.max(0, auraPoints || 0);

  let currentTier = AURA_TIERS[0];
  let nextTier = AURA_TIERS[1];

  for (let i = 0; i < AURA_TIERS.length; i++) {
    if (points >= AURA_TIERS[i].req) {
      currentTier = AURA_TIERS[i];
      nextTier = AURA_TIERS[i + 1] || null; // Null if they hit max rank
    } else {
      break;
    }
  }

  return {
    ...currentTier,
    currentAura: points,
    nextRankReq: nextTier ? nextTier.req : null,
    auraToNextRank: nextTier ? nextTier.req - points : 0,
    progressPercent: nextTier ? ((points - currentTier.req) / (nextTier.req - currentTier.req)) * 100 : 100
  };
};
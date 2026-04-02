"use client";

import PostCard from "@/app/components/PostCard";
import { motion } from "framer-motion";
import { Flame, Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useState } from "react";

// Web versions of the custom components we built
import AuraAvatar from "@/app/components/AuraAvatar";

// Dynamic Ad Component
const FeedAd = dynamic(() => import("@/app/components/FeedAd"), { ssr: false });

const API_BASE = "https://oreblogda.com/api";

// 🔹 EXACT COPY FROM MOBILE
const getAuraTier = (rank) => {
  const MONARCH_GOLD = '#fbbf24';
  const CRIMSON_RED = '#ef4444';
  const SHADOW_PURPLE = '#a855f7';
  const STEEL_BLUE = '#3b82f6';
  const REI_WHITE = '#e0f2fe';

  if (!rank || rank > 10 || rank <= 0) {
    return { color: '#3b82f6', label: 'ACTIVE', icon: 'radar' }; // We'll just map 'radar' to a generic SVG below if needed
  }

  switch (rank) {
    case 1: return { color: MONARCH_GOLD, label: 'MONARCH', icon: '👑' };
    case 2: return { color: CRIMSON_RED, label: 'YONKO', icon: '☄️' };
    case 3: return { color: SHADOW_PURPLE, label: 'KAGE', icon: '🌙' };
    case 4: return { color: STEEL_BLUE, label: 'SHOGUN', icon: '🛡️' };
    case 5: return { color: REI_WHITE, label: 'ESPADA 0', icon: '💀' };
    case 6: return { color: '#cbd5e1', label: 'ESPADA 1', icon: '⚔️' };
    case 7: return { color: '#94a3b8', label: 'ESPADA 2', icon: '⚔️' };
    case 8: return { color: '#64748b', label: 'ESPADA 3', icon: '⚔️' };
    case 9: return { color: '#475569', label: 'ESPADA 4', icon: '⚔️' };
    case 10: return { color: '#334155', label: 'ESPADA 5', icon: '⚔️' };
    default: return { color: '#1e293b', label: 'VANGUARD', icon: '🛡️' };
  }
};

const AURA_TIERS = [
  { level: 1, req: 0, title: "E-Rank Novice", icon: "🌱", color: "#94a3b8" },
  { level: 2, req: 100, title: "D-Rank Operative", icon: "⚔️", color: "#34d399" },
  { level: 3, req: 300, title: "C-Rank Awakened", icon: "🔥", color: "#f87171" },
  { level: 4, req: 700, title: "B-Rank Elite", icon: "⚡", color: "#a78bfa" },
  { level: 5, req: 1500, title: "A-Rank Champion", icon: "🛡️", color: "#60a5fa" },
  { level: 6, req: 3000, title: "S-Rank Legend", icon: "🌟", color: "#fcd34d" },
  { level: 7, req: 6000, title: "SS-Rank Mythic", icon: "🌀", color: "#f472b6" },
  { level: 8, req: 12000, title: "Monarch", icon: "👑", color: "#fbbf24" },
];

const resolveUserRank = (level, currentAura) => {
  const safeLevel = Math.max(1, Math.min(8, level || 1));
  const currentTier = AURA_TIERS[safeLevel - 1];
  const nextTier = AURA_TIERS[safeLevel] || currentTier;

  let progress = 100;
  if (safeLevel < 8) {
    progress = ((currentAura - currentTier.req) / (nextTier.req - currentTier.req)) * 100;
  }

  return {
    title: currentTier.title.toUpperCase().replace(/ /g, "_"),
    icon: currentTier.icon,
    color: currentTier.color,
    progress: Math.min(Math.max(progress, 0), 100),
    req: currentTier.req,
    nextReq: nextTier.req
  };
};

// SVG Icon for the "GOAT" shield
const ShieldStarIcon = ({ color }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path>
    <polygon points="12 13 14 14.5 13.5 12 15 10.5 13 10.5 12 8.5 11 10.5 9 10.5 10.5 12 10 14.5"></polygon>
  </svg>
);


export default function AuthorPageClient({ author: initialAuthor, initialPosts = [], total: initialTotal = 0 }) {
  const [author, setAuthor] = useState(initialAuthor);
  const [posts, setPosts] = useState(initialPosts);
  const [totalPosts, setTotalPosts] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialPosts.length === 6);
  const [loading, setLoading] = useState(false);

  const fetchMorePosts = useCallback(async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/posts?author=${author._id || author.id}&page=${page + 1}&limit=6`);
      const data = await res.json();
      if (res.ok && data.posts.length > 0) {
        setPosts((prev) => [...prev, ...data.posts]);
        setTotalPosts(data.total);
        setPage((prev) => prev + 1);
        setHasMore(data.posts.length >= 6); // Matched mobile threshold logic
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [author, page, hasMore, loading]);


  // --- APP EXACT DATA PARSING ---
  const totalAura = author?.aura || 0;
  const auraRank = author?.previousRank || null;
  const rankLevel = author?.currentRankLevel || 1;
  const writerRank = resolveUserRank(rankLevel, totalAura);
  const aura = getAuraTier(auraRank);

  const equippedGlow = author?.inventory?.find(i => i.category === 'GLOW' && i.isEquipped);
  const activeGlowColor = equippedGlow?.visualConfig?.primaryColor || null;
  const themeColor = activeGlowColor || aura.color;

  const favoriteCharacter = author?.preferences?.favCharacter || "NONE_SET";
  const isTop10 = auraRank > 0 && auraRank <= 10;

  return (
    <div className="max-w-4xl mx-auto px-4 mt-20 min-h-screen pb-20 font-sans transition-colors duration-500">

      {/* --- HEADER BLOCK --- */}
      {author && (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative p-6 md:p-10 bg-app-card dark:bg-app-dark-card border border-app-border dark:border-app-dark-border shadow-2xl overflow-hidden mb-12 transition-colors duration-500"
          style={{ borderRadius: 25 }}
        >

          <div className="flex flex-col items-center gap-6">

            {/* ⚡️ The New Avatar Setup */}
            <div className="relative items-center justify-center flex flex-col">
              <div className="absolute flex items-center justify-center pointer-events-none">
                <motion.div
                  style={{ width: 140, height: 140, borderRadius: 100, backgroundColor: themeColor, opacity: activeGlowColor ? 0.25 : 0.1 }}
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
              </div>
              <div className="absolute flex items-center justify-center pointer-events-none">
                <motion.div
                  className="border border-dashed rounded-full"
                  style={{ width: 160, height: 160, borderColor: `${themeColor}40` }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                />
              </div>

              <AuraAvatar
                author={{ ...author, rank: auraRank, image: author.profilePic?.url, name: author.username }}
                aura={aura}
                glowColor={activeGlowColor}
                isTop10={isTop10}
                size={130}
              />

              {auraRank > 0 && (
                <div
                  className="absolute -bottom-3 px-4 py-1 rounded-full border-2 border-white dark:border-black shadow-lg flex items-center gap-1 z-20"
                  style={{ backgroundColor: themeColor }}
                >
                  <span style={{ color: auraRank === 5 || activeGlowColor ? "black" : "white", fontSize: '10px' }}>{aura.icon}</span>
                  <span
                    className="text-[9px] font-black uppercase tracking-widest"
                    style={{ color: auraRank === 5 || activeGlowColor ? "black" : "white" }}
                  >
                    {aura.label} #{auraRank}
                  </span>
                </div>
              )}
            </div>

            <div className="items-center w-full mt-2 text-center">

              {/* Name and Streak */}
              <div className="flex flex-col md:flex-row items-center justify-center gap-3 mb-3">
                <h1
                  className="text-2xl md:text-3xl font-black uppercase text-app-text dark:text-app-dark-text transition-colors"
                  style={{ color: themeColor }}
                >
                  {author.username}
                </h1>
                <div className="flex items-center bg-app-streak/10 px-2 py-1 rounded-lg border border-app-streak/20">
                  <Flame size={16} className="text-app-streak" />
                  <span className="text-app-streak font-black ml-1 text-xs">{author.streak || "0"}</span>
                </div>
              </div>

              {/* Description */}
              <p className="text-sm text-app-textSecondary dark:text-app-dark-textSecondary max-w-lg mx-auto leading-relaxed font-medium italic px-8 mb-4 transition-colors">
                "{author.description || "This operator is a ghost in the machine..."}"
              </p>

              {/* GOAT Tag */}
              <div className="bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-2xl px-5 py-2 flex inline-flex items-center mb-1">
                <ShieldStarIcon color={themeColor} />
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400 ml-2">GOAT:</span>
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-900 dark:text-white ml-2 italic">{favoriteCharacter}</span>
              </div>

              {/* STATS ROW */}
              <div className="flex justify-center gap-8 mt-6 border-y border-app-border dark:border-app-dark-border w-full py-4 transition-colors">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-app-textSecondary dark:text-app-dark-textSecondary uppercase tracking-widest">Aura</span>
                  <span className="text-lg font-black" style={{ color: themeColor }}>{totalAura.toLocaleString()}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-app-textSecondary dark:text-app-dark-textSecondary uppercase tracking-widest">Glory</span>
                  <span className="text-lg font-black" style={{ color: '#ec4899' }}>+{author.weeklyAura || 0}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-app-textSecondary dark:text-app-dark-textSecondary uppercase tracking-widest">Logs</span>
                  <span className="text-lg font-black text-app-text dark:text-app-dark-text">{totalPosts}</span>
                </div>
              </div>

              {/* PROGRESS BAR BLOCK */}
              <div className="mt-8 w-full max-w-md mx-auto px-2 text-left">
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{writerRank.icon}</span>
                    <div>
                      <p style={{ color: writerRank.color }} className="text-[8px] font-mono uppercase tracking-[0.2em] leading-none mb-1">Class</p>
                      <p className="text-sm font-black uppercase tracking-tighter text-app-text dark:text-app-dark-text">{writerRank.title}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* --- FEED SECTION --- */}
      <div className="relative">
        <div className="flex items-center gap-4 mt-10 mb-4 px-2">
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-app-text dark:text-app-dark-text transition-colors">
            Diary <span style={{ color: themeColor }}>Archives</span>
          </h2>
          <div className="h-[1px] flex-1 bg-app-border dark:bg-app-dark-border transition-colors" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {posts.map((post, index) => (
            <div key={post._id || index}>
              <PostCard post={post} isFeed />
              {(index + 1) % 4 === 0 && (
                <div className="my-10 w-full p-8 border border-dashed border-app-border dark:border-app-dark-border rounded-[32px] bg-gray-50/50 dark:bg-white/5 flex flex-col items-center justify-center transition-colors">
                  <span className="text-[10px] font-bold text-app-textSecondary dark:text-app-dark-textSecondary uppercase tracking-[0.2em] italic mb-4">Sponsored Transmission</span>
                  <FeedAd />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* --- LOAD MORE --- */}
        {hasMore && (
          <div className="flex flex-col items-center justify-center my-16">
            <button
              onClick={fetchMorePosts}
              disabled={loading}
              className="px-12 py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-2xl flex items-center gap-3 transition-transform active:scale-95 disabled:opacity-70 cursor-pointer"
            >
              {loading && <Loader2 className="animate-spin" size={16} />}
              <span className="text-xs font-black uppercase tracking-[0.2em]">
                {loading ? "Syncing_Data..." : "Fetch_More_Intel"}
              </span>
            </button>
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="text-center py-10 opacity-30">
            <div className="h-[1px] w-24 bg-gray-500 dark:bg-gray-400 mx-auto mb-4" />
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] text-app-text dark:text-app-dark-text">End_Of_Transmission</p>
          </div>
        )}
      </div>
    </div>
  );
}
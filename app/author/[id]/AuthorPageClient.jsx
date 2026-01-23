"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import PostCard from "@/app/components/PostCard";
import { motion } from "framer-motion";
import Image from "next/image";
import FeedAd from "@/app/components/FeedAd";
import { Flame, Crown, Zap, Shield, Moon, Ghost, Swords, Activity, Loader2 } from "lucide-react";

const API_BASE = "https://oreblogda.com/api";

// 🔹 AURA TIER LOGIC (EXACT COPY FROM MOBILE)
const getAuraTier = (rank) => {
    const AURA_PURPLE = '#a78bfa'; 
    const MONARCH_GOLD = '#fbbf24'; 
    const YONKO_BLUE = '#60a5fa';   

    if (!rank || rank > 10 || rank <= 0) {
        return { color: '#3b82f6', label: 'ACTIVE', icon: <Activity size={14}/> };
    }

    switch (rank) {
        case 1: return { color: MONARCH_GOLD, label: 'MONARCH', icon: <Crown size={14}/> };
        case 2: return { color: YONKO_BLUE, label: 'YONKO', icon: <Zap size={14}/> };
        case 3: return { color: AURA_PURPLE, label: 'KAGE', icon: <Moon size={14}/> };
        case 4: return { color: AURA_PURPLE, label: 'SHOGUN', icon: <Shield size={14}/> };
        case 5: return { color: '#ffffff', label: 'ESPADA 0', icon: <Ghost size={14}/> };
        case 6: case 7: case 8: case 9: case 10:
            return { color: '#e5e7eb', label: `ESPADA ${rank - 5}`, icon: <Swords size={14}/> };
        default: return { color: '#34d399', label: 'VANGUARD', icon: <Shield size={14}/> };
    }
};

export default function AuthorPageClient({ author: initialAuthor, initialPosts = [], total: initialTotal = 0 }) {
  const [author, setAuthor] = useState(initialAuthor);
  const [posts, setPosts] = useState(initialPosts);
  const [totalPosts, setTotalPosts] = useState(initialTotal);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialPosts.length === 6);
  const [loading, setLoading] = useState(false);

  // 🔹 FETCH MORE LOGIC (EXACT SYNC)
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
        setHasMore(data.posts.length === 6);
      } else {
        setHasMore(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [author, page, hasMore, loading]);

  // 🔹 RANK LOGIC (EXACT THRESHOLDS FROM MOBILE)
  const { rankTitle, rankIcon, nextMilestone } = useMemo(() => {
    const count = totalPosts;
    if (count > 200) return { rankTitle: "Master_Writer", rankIcon: "👑", nextMilestone: 500 };
    if (count > 150) return { rankTitle: "Elite_Writer", rankIcon: "💎", nextMilestone: 200 };
    if (count > 100) return { rankTitle: "Senior_Writer", rankIcon: "🔥", nextMilestone: 150 };
    if (count > 50)  return { rankTitle: "Novice_Writer", rankIcon: "⚔️", nextMilestone: 100 };
    if (count > 25)  return { rankTitle: "Senior_Researcher", rankIcon: "📜", nextMilestone: 50 };
    return { rankTitle: "Novice_Researcher", rankIcon: "🛡️", nextMilestone: 25 };
  }, [totalPosts]);

  const progress = Math.min((totalPosts / nextMilestone) * 100, 100);
  const auraRank = author?.previousRank || 0;
  const aura = getAuraTier(auraRank);

  // 🔹 BADGE STYLES (EXACT FROM MOBILE)
  const getBadgeClass = () => {
    if (auraRank === 1) return "rounded-[45px] rotate-45";
    if (auraRank === 2) return "rounded-[60px]";
    if (auraRank === 3) return "rounded-[35px]";
    return "rounded-full";
  };

  return (
    <div className="max-w-4xl mx-auto px-4 mt-20 min-h-screen pb-20 font-sans">
      
      {/* --- HEADER BLOCK --- */}
      {author && (
        <motion.div 
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative p-6 md:p-10 bg-white dark:bg-[#0a0a0a] border border-gray-100 dark:border-zinc-800 shadow-2xl overflow-hidden mb-12"
          style={{ borderRadius: 40 }}
        >
          {/* Rank Glow Background */}
          <div 
            className="absolute -top-10 -right-10 w-60 h-60 opacity-10 rounded-full blur-3xl pointer-events-none" 
            style={{ backgroundColor: aura.color }}
          />
          
          <div className="flex flex-col items-center gap-6">
            <div className="relative flex items-center justify-center">
              
              {/* ROTATING OUTER FRAME (Monarch & Yonko only) */}
              {auraRank > 0 && auraRank <= 2 && (
                <motion.div 
                  animate={{ rotate: 360 }}
                  transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                  className={`absolute w-[170px] h-[170px] border border-dashed opacity-50 ${getBadgeClass()}`}
                  style={{ borderColor: aura.color }}
                />
              )}

              {/* PULSING GLOW FRAME */}
              {auraRank > 0 && (
                <motion.div 
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 5, repeat: Infinity }}
                  className={`absolute w-[155px] h-[155px] border-[3px] opacity-40 ${getBadgeClass()}`}
                  style={{ borderColor: aura.color, borderStyle: auraRank <= 3 ? 'solid' : 'dashed' }}
                />
              )}

              <div 
                className={`w-32 h-32 md:w-36 md:h-36 bg-zinc-900 overflow-hidden border-4 ${getBadgeClass()}`}
                style={{ borderColor: auraRank > 0 ? aura.color : '#27272a' }}
              >
                <Image
                  src={author.profilePic?.url || "/default-avatar.png"}
                  alt={author.username}
                  fill
                  className={`object-cover ${auraRank === 1 ? "-rotate-45" : ""}`}
                />
              </div>

              {auraRank > 0 && (
                <div 
                  className="absolute -bottom-3 px-4 py-1 rounded-full border-2 border-white dark:border-black shadow-lg flex items-center gap-1.5"
                  style={{ backgroundColor: aura.color }}
                >
                  <span style={{ color: auraRank === 5 ? "black" : "white" }}>{aura.icon}</span>
                  <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: auraRank === 5 ? "black" : "white" }}>
                    {aura.label} #{auraRank}
                  </span>
                </div>
              )}
            </div>

            <div className="items-center w-full mt-2 text-center">
              <div className="flex flex-col md:flex-row items-center justify-center gap-3 mb-2">
                <h1 
                  className="text-4xl font-black italic tracking-tighter uppercase text-zinc-900 dark:text-white"
                  style={{ textShadow: auraRank <= 2 ? `0 0 10px ${aura.color}44` : 'none' }}
                >
                  {author.username}
                </h1>
                <div className="flex items-center bg-orange-500/10 px-2 py-1 rounded-lg border border-orange-500/20">
                  <Flame size={16} className="text-orange-500"/>
                  <span className="text-orange-500 font-black ml-1 text-xs">{author.lastStreak || "0"}</span>
                </div>
              </div>
              
              <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-lg mx-auto leading-relaxed font-medium italic px-4">
                "{author.description || "This operator is a ghost in the machine..."}"
              </p>

              {/* STATS ROW */}
              <div className="flex justify-center gap-8 mt-6 border-y border-zinc-100 dark:border-zinc-800 w-full py-4">
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Aura</span>
                  <span className="text-lg font-black" style={{ color: aura.color }}>+{author.weeklyAura || 0}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Logs</span>
                  <span className="text-lg font-black dark:text-white">{totalPosts}</span>
                </div>
                <div className="flex flex-col items-center">
                  <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Rank</span>
                  <span className="text-lg font-black" style={{ color: auraRank > 0 ? aura.color : '#52525b' }}>#{auraRank || '??'}</span>
                </div>
              </div>

              {/* PROGRESS BAR BLOCK */}
              <div className="mt-8 w-full max-w-md mx-auto px-2 text-left">
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">{rankIcon}</span>
                    <div>
                      <p style={{ color: aura.color }} className="text-[8px] font-mono uppercase tracking-[0.2em] leading-none mb-1">Writer_Class</p>
                      <p className="text-sm font-black uppercase tracking-tighter dark:text-white">{rankTitle}</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-zinc-500">EXP: {totalPosts} / {nextMilestone}</span>
                </div>

                <div className="h-1.5 w-full bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className="h-full shadow-lg transition-all duration-1000"
                    style={{ backgroundColor: aura.color }}
                  />
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* --- FEED SECTION --- */}
      <div className="relative">
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white">
            Mission <span style={{ color: aura.color }}>History</span>
          </h2>
          <div className="h-[1px] flex-1 bg-zinc-100 dark:bg-zinc-800" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {posts.map((post, index) => (
            <div key={post._id || index}>
              <PostCard post={post} isFeed />
              {(index + 1) % 4 === 0 && (
                <div className="my-10 w-full p-8 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-[32px] bg-zinc-50/50 dark:bg-white/5 flex flex-col items-center justify-center">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] italic mb-4">Sponsored Transmission</span>
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
              className="px-12 py-4 bg-zinc-900 dark:bg-white text-white dark:text-black rounded-2xl flex items-center gap-3 transition-transform active:scale-95 disabled:opacity-70"
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
            <div className="h-[1px] w-24 bg-zinc-500 mx-auto mb-4" />
            <p className="text-[10px] font-mono uppercase tracking-[0.4em] dark:text-white">End_Of_Transmission</p>
          </div>
        )}
      </div>
    </div>
  );
}

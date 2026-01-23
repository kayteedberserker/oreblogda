"use client";

import React, { useState, useMemo } from 'react';
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  Flame, 
  CloudOff, 
  Trophy,
  Activity
} from 'lucide-react';
import Link from 'next/link';

const API_URL = "https://oreblogda.com";
const fetcher = (url) => fetch(url).then((res) => res.json());

// ----------------------
// ✨ AURA UTILITY HELPER
// ----------------------
const getAuraTier = (rank) => {
  if (!rank || rank > 10 || rank <= 0) return null;
  switch (rank) {
    case 1: return { color: '#fbbf24', label: 'MONARCH', border: 'border-yellow-500' };
    case 2: return { color: '#ef4444', label: 'YONKO', border: 'border-red-500' };
    case 3: return { color: '#a855f7', label: 'KAGE', border: 'border-purple-500' };
    case 4: return { color: '#3b82f6', label: 'SHOGUN', border: 'border-blue-500' };
    case 5: return { color: '#ffffff', label: 'ESPADA 0', border: 'border-white' };
    default: return { color: '#e5e7eb', label: `ESPADA ${rank - 4}`, border: 'border-gray-300' };
  }
};

const resolveUserRank = (totalPosts) => {
  const count = totalPosts || 0;
  if (count >= 200) return { title: "MASTER_WRITER", icon: "👑", color: "#fbbf24", next: 500 };
  if (count > 150) return { title: "ELITE_WRITER", icon: "💎", color: "#60a5fa", next: 200 };
  if (count > 100) return { title: "SENIOR_WRITER", icon: "🔥", color: "#f87171", next: 150 };
  if (count > 50) return { title: "NOVICE_WRITER", icon: "⚔️", color: "#a78bfa", next: 100 };
  if (count > 25) return { title: "RESEACHER_SR", icon: "📜", color: "#34d399", next: 50 };
  return { title: "RESEACHER_JR", icon: "🛡️", color: "#94a3b8", next: 25 };
};

export default function LeaderboardPage() {
  const [type, setType] = useState("posts"); // posts, streak, aura

  const { data, error, isLoading } = useSWR(
    `${API_URL}/api/leaderboard?type=${type}&limit=50`,
    fetcher
  );

  const leaderboard = data?.leaderboard || [];

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-blue-500/30">
      <div className="max-w-2xl mx-auto px-4 pt-12 pb-24">
        
        {/* HEADER */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Link href="/" className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-blue-500 transition-colors">
              <ChevronLeft size={20} className="text-blue-400" />
            </Link>
            <div>
              <h1 className="text-2xl font-black tracking-tighter uppercase italic">COMMAND_CENTER</h1>
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] font-bold tracking-[0.2em] text-blue-500/80">
                  LIVE_OPERATIONS // GLOBAL
                </span>
              </div>
            </div>
          </div>
        </header>

        {/* TOGGLE SWITCH */}
        <div className="relative flex p-1 bg-zinc-900/50 border border-zinc-800 rounded-2xl mb-8">
          {/* Animated Slider */}
          <motion.div 
            layoutId="slider"
            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
            className={`absolute h-[calc(100%-8px)] rounded-xl border ${
                type === 'posts' ? 'bg-blue-600/20 border-blue-500' :
                type === 'streak' ? 'bg-orange-600/20 border-orange-500' :
                'bg-purple-600/20 border-purple-500'
            }`}
            style={{ 
              width: 'calc(33.33% - 4px)',
              left: type === 'posts' ? '4px' : type === 'streak' ? '33.33%' : '66.66%'
            }}
          />
          {['posts', 'streak', 'aura'].map((tab) => (
            <button
              key={tab}
              onClick={() => setType(tab)}
              className={`relative z-10 flex-1 py-3 text-[10px] font-black tracking-widest uppercase transition-colors ${
                type === tab ? 'text-white' : 'text-zinc-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* LIST HEADER */}
        <div className="flex px-4 py-3 border-b border-zinc-800 text-[10px] font-bold text-zinc-500 tracking-widest uppercase">
          <span className="w-10">POS</span>
          <span className="flex-1">OPERATIVE_NAME</span>
          <span className="w-24 text-center">PERFORMANCE</span>
        </div>

        {/* CONTENT */}
        <div className="mt-4 space-y-2">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-50">
              <Activity className="animate-spin mb-4 text-blue-500" />
              <p className="text-[10px] font-black tracking-widest uppercase italic">Scanning Neural Core...</p>
            </div>
          ) : leaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 opacity-30">
              <CloudOff size={40} className="mb-4" />
              <p className="text-[10px] font-black tracking-widest uppercase italic">No Data Available</p>
            </div>
          ) : (
            leaderboard.map((item, index) => {
              const writerRank = resolveUserRank(item.postCount);
              const aura = getAuraTier(item.previousRank);
              const isTop3 = index < 3;
              const progress = Math.min((item.postCount / writerRank.next) * 100, 100);

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  key={item.userId || index}
                  className={`group relative flex items-center p-4 rounded-2xl border transition-all ${
                    isTop3 
                      ? 'bg-zinc-900/40 border-zinc-800' 
                      : 'bg-transparent border-transparent hover:bg-zinc-900/20'
                  } ${aura ? `border-l-2` : ''}`}
                  style={{ borderLeftColor: aura?.color }}
                >
                  {/* Rank Number */}
                  <div className="w-10 font-black italic text-lg opacity-20 group-hover:opacity-100 transition-opacity">
                    {String(index + 1).padStart(2, '0')}
                  </div>

                  {/* Info */}
                  <div className="flex-1 px-2">
                    <div className="flex items-center gap-2">
                      <Link 
                        href={`/author/${item.userId}`}
                        className="font-black text-sm tracking-tight hover:text-blue-400 transition-colors uppercase italic"
                        style={{ color: aura?.color }}
                      >
                        {item.username || "GUEST"}
                      </Link>
                      {aura && (
                        <span 
                          className="px-1.5 py-0.5 rounded text-[8px] font-black text-black"
                          style={{ backgroundColor: aura.color }}
                        >
                          {aura.label}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[9px] font-bold" style={{ color: writerRank.color }}>
                        {writerRank.icon} {writerRank.title}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-4/5 h-1 bg-zinc-800 rounded-full mt-3 overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        className="h-full"
                        style={{ backgroundColor: writerRank.color }}
                      />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 text-center">
                    <div>
                      <p className="text-[7px] font-black text-zinc-500 uppercase">Docs</p>
                      <p className="text-xs font-black">{item.postCount || 0}</p>
                    </div>
                    <div>
                      <Flame size={10} className="text-orange-500 mx-auto" />
                      <p className="text-xs font-black text-orange-500">{item.streak || 0}</p>
                    </div>
                    <div>
                      <p className="text-[7px] font-black text-purple-400 uppercase">Aura</p>
                      <p className="text-xs font-black text-purple-400">{item.weeklyAura || 0}</p>
                    </div>
                  </div>
                </motion.div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}


"use client";

import React, { useEffect, useMemo, useState } from "react";
import useSWR from 'swr';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronLeft, 
  Flame, 
  CloudOff, 
  Activity 
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from "next/navigation";

const API_URL = "https://oreblogda.com";

// Same fetcher logic
const fetcher = (url) => fetch(url).then((res) => res.json());

// ----------------------
// ✨ EXACT AURA UTILITY HELPER (Mirrored from Mobile)
// ----------------------
const getAuraTier = (rank) => {
    if (!rank || rank > 10 || rank <= 0) return null;
    switch (rank) {
        case 1: return { color: '#fbbf24', label: 'MONARCH' };
        case 2: return { color: '#ef4444', label: 'YONKO' };
        case 3: return { color: '#a855f7', label: 'KAGE' };
        case 4: return { color: '#3b82f6', label: 'SHOGUN' };
        case 5: return { color: '#ffffff', label: 'ESPADA 0' };
        case 6: case 7: case 8: case 9: case 10:
            return { color: '#e5e7eb', label: `ESPADA ${rank - 5}` };
        default: return { color: '#94a3b8', label: 'OPERATIVE' };
    }
};

// ----------------------
// ✨ EXACT RANK RESOLVER (Mirrored from Mobile)
// ----------------------
const resolveUserRank = (totalPosts) => {
    const count = totalPosts || 0;
    if (count >= 200) return { title: "MASTER_WRITER", icon: "👑", color: "#fbbf24", next: 500 };
    if (count > 150) return { title: "ELITE_WRITER", icon: "💎", color: "#60a5fa", next: 200 };
    if (count > 100) return { title: "SENIOR_WRITER", icon: "🔥", color: "#f87171", next: 150 };
    if (count > 50) return { title: "NOVICE_WRITER", icon: "⚔️", color: "#a78bfa", next: 100 };
    if (count > 25) return { title: "RESEACHER_SR", icon: "📜", color: "#34d399", next: 50 };
    return { title: "RESEACHER_JR", icon: "🛡️", color: "#94a3b8", next: 25 };
};

export default function Leaderboard() {
    const router = useRouter();
    const [type, setType] = useState("posts");
    const [cachedData, setCachedData] = useState(null);
    const [isOfflineMode, setIsOfflineMode] = useState(false);

    const CACHE_KEY = `LEADERBOARD_CACHE_${type.toUpperCase()}`;

    // Web version of Cache Loading
    useEffect(() => {
        const local = localStorage.getItem(CACHE_KEY);
        if (local) setCachedData(JSON.parse(local));
    }, [type]);

    const { data: swrData, isLoading } = useSWR(
        `${API_URL}/api/leaderboard?type=${type}&limit=50`,
        fetcher,
        {
            dedupingInterval: 1000 * 60,
            revalidateOnFocus: true,
            onSuccess: (newData) => {
                setIsOfflineMode(false);
                localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
            },
            onError: () => setIsOfflineMode(true)
        }
    );

    const leaderboardData = useMemo(() => {
        return swrData?.leaderboard || cachedData?.leaderboard || [];
    }, [swrData, cachedData]);

    const statusColor = isOfflineMode ? "#f59e0b" : "#60a5fa";

    return (
        <div className="min-h-screen bg-black text-white selection:bg-blue-500/30 font-sans">
            <div className="max-w-2xl mx-auto px-4 pt-12 pb-24">
                
                {/* Header (Exact UI Logic) */}
                <div className="flex items-center justify-between mb-8">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => router.back()}
                            className="p-2.5 rounded-xl bg-zinc-900 border border-zinc-800 hover:border-zinc-700 transition-all"
                        >
                            <ChevronLeft size={20} style={{ color: statusColor }} />
                        </button>
                        <div>
                            <h1 className="text-2xl font-black italic tracking-tighter uppercase leading-none">COMMAND_CENTER</h1>
                            <div className="flex items-center gap-2 mt-1">
                                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ backgroundColor: statusColor }} />
                                <span className="text-[8px] font-bold tracking-[0.15em]" style={{ color: statusColor }}>
                                    {isOfflineMode ? "OFFLINE_MODE // ARCHIVED" : "LIVE_OPERATIONS // GLOBAL"}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Three-Way Toggle (Mirrored Reanimated Logic with Framer Motion) */}
                <div className="relative flex p-1 bg-zinc-900 border border-zinc-800 rounded-2xl mb-6 h-14 items-center">
                    <motion.div 
                        layoutId="activeTab"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                        className={`absolute h-[46px] rounded-xl border z-0`}
                        style={{ 
                            width: 'calc(33.33% - 4px)',
                            left: type === 'posts' ? '4px' : type === 'streak' ? '33.33%' : '66.66%',
                            backgroundColor: type === "posts" ? '#1e293b' : type === "streak" ? '#f59e0b' : '#8b5cf6',
                            borderColor: type === "posts" ? '#60a5fa' : type === "streak" ? '#fbbf24' : '#a78bfa',
                        }}
                    />
                    {["posts", "streak", "aura"].map((t) => (
                        <button
                            key={t}
                            onClick={() => setType(t)}
                            className={`relative z-10 flex-1 text-[10px] font-black tracking-widest uppercase transition-colors ${
                                type === t ? 'text-white' : 'text-zinc-500'
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>

                {/* List Header */}
                <div className="flex px-3 py-3 border-b border-zinc-800 text-[10px] font-black text-zinc-600 tracking-widest uppercase mb-2">
                    <span className="w-10">POS</span>
                    <span className="flex-1 px-2">OPERATIVE_NAME</span>
                    <span className="w-32 text-center">PERFORMANCE</span>
                </div>

                {/* Content Rendering */}
                <div className="space-y-1">
                    {isLoading && leaderboardData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 animate-pulse">
                             <Activity className="text-blue-500 mb-4" />
                             <p className="text-[10px] font-black tracking-widest uppercase italic text-zinc-500">Scanning Neural Core</p>
                        </div>
                    ) : leaderboardData.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-20 opacity-30">
                            <CloudOff size={40} className="mb-4" />
                            <p className="text-[10px] font-black tracking-widest uppercase italic">No Data Available</p>
                        </div>
                    ) : (
                        leaderboardData.map((item, index) => {
                            const writerRank = resolveUserRank(item.postCount);
                            const aura = getAuraTier(item.previousRank);
                            const isTop3 = index < 3;
                            const progress = Math.min(((item.postCount || 0) / writerRank.next) * 100, 100);
                            
                            const highlightColor = 
                                index === 0 ? "#fbbf24" : 
                                index === 1 ? "#94a3b8" : 
                                index === 2 ? "#cd7f32" : "transparent";

                            return (
                                <motion.div
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: index * 0.02 }}
                                    key={item.userId || index}
                                    className={`relative flex items-center p-4 transition-all rounded-2xl border-l-4 ${
                                        isTop3 ? 'bg-zinc-900/40 border-zinc-800 mb-2' : 'bg-transparent border-transparent'
                                    }`}
                                    style={{ borderLeftColor: isTop3 ? highlightColor : (aura ? aura.color : 'transparent') }}
                                >
                                    {/* POS */}
                                    <div className="w-10 text-center">
                                        <span className={`text-sm font-black italic ${isTop3 ? '' : 'text-zinc-700'}`} style={{ color: isTop3 ? highlightColor : undefined }}>
                                            {String(index + 1).padStart(2, '0')}
                                        </span>
                                    </div>

                                    {/* USER INFO */}
                                    <div className="flex-1 px-3">
                                        <div className="flex items-center gap-2">
                                            <Link 
                                                href={`/author/${item.userId}`}
                                                className="text-[15px] font-black tracking-tight uppercase italic hover:underline"
                                                style={{ color: aura ? aura.color : '#fff' }}
                                            >
                                                {item.username || "GUEST"}
                                            </Link>
                                            {aura && (
                                                <span className="px-1.5 py-0.5 rounded text-[7px] font-black text-black leading-none" style={{ backgroundColor: aura.color }}>
                                                    {aura.label}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="text-[9px] font-black tracking-widest mt-1" style={{ color: writerRank.color }}>
                                            {writerRank.icon} {writerRank.title}
                                        </div>

                                        {/* Progress Bar */}
                                        <div className="w-4/5 h-[3px] bg-zinc-900 rounded-full mt-2.5 overflow-hidden">
                                            <div 
                                                className="h-full transition-all duration-1000" 
                                                style={{ width: `${progress}%`, backgroundColor: writerRank.color }} 
                                            />
                                        </div>
                                    </div>

                                    {/* PERFORMANCE STATS */}
                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="text-center w-8">
                                            <p className="text-[7px] font-black text-zinc-500">DOCS</p>
                                            <p className="text-xs font-black">{item.postCount || 0}</p>
                                        </div>
                                        <div className="text-center w-8">
                                            <Flame size={10} className="text-orange-500 mx-auto" />
                                            <p className="text-xs font-black text-orange-500">{item.streak || 0}</p>
                                        </div>
                                        <div className="text-center w-8">
                                            <p className="text-[7px] font-black text-purple-400">AURA</p>
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

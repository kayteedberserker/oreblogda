"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import useSWR from "swr";

const API_URL = "https://oreblogda.com";

// Assuming you have a standard fetcher setup, or fallback to native fetch
const fetcher = (url) => fetch(API_URL + url).then((res) => res.json());

// --- Constants & Helpers (Unchanged) ---
const CLAN_TIERS = {
    6: { label: 'VI', color: '#ef4444', title: "The Akatsuki" },
    5: { label: 'V', color: '#e0f2fe', title: "The Espada" },
    4: { label: 'IV', color: '#a855f7', title: "Phantom Troupe" },
    3: { label: 'III', color: '#60a5fa', title: "Upper Moon" },
    2: { label: 'II', color: '#10b981', title: "Squad 13" },
    1: { label: 'I', color: '#94a3b8', title: "Wandering Ronin" },
};

const getAuraTier = (rank) => {
    if (!rank || rank > 10 || rank <= 0) return null;
    switch (rank) {
        case 1: return { color: '#fbbf24', label: 'MONARCH' };
        case 2: return { color: '#ef4444', label: 'YONKO' };
        case 3: return { color: '#a855f7', label: 'KAGE' };
        case 4: return { color: '#3b82f6', label: 'SHOGUN' };
        case 5: return { color: '#e0f2fe', label: 'ESPADA 0' };
        case 6: return { color: '#cbd5e1', label: 'ESPADA 1' };
        case 7: return { color: '#94a3b8', label: 'ESPADA 2' };
        case 8: return { color: '#64748b', label: 'ESPADA 3' };
        case 9: return { color: '#475569', label: 'ESPADA 4' };
        case 10: return { color: '#334155', label: 'ESPADA 5' };
        default: return { color: '#1e293b', label: 'OPERATIVE' };
    }
};

const resolveClanTier = (rank) => {
    if (rank === 1) return CLAN_TIERS[1];
    if (rank <= 3) return CLAN_TIERS[2];
    if (rank <= 10) return CLAN_TIERS[3];
    if (rank <= 25) return CLAN_TIERS[4];
    if (rank <= 50) return CLAN_TIERS[5];
    return CLAN_TIERS[6];
};

const formatCoins = (num) => {
    if (!num) return "0";
    if (num >= 1000000) return Math.floor(num / 1000000) + 'M+';
    if (num >= 1000) return Math.floor(num / 1000) + 'k+';
    return num.toString();
};

export const AURA_TIERS = [
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
        progress: Math.min(Math.max(progress, 0), 100)
    };
};

// --- Web Icons (Replacing Expo Vector Icons) ---
const LockIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400 dark:text-slate-600">
        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
    </svg>
);

const CloudOffIcon = () => (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500">
        <path d="M22.61 16.95A5 5 0 0 0 18 10h-1.26a8 8 0 0 0-7.05-6M5 5a8 8 0 0 0 4 15h9a5 5 0 0 0 1.7-.3"></path>
        <line x1="1" y1="1" x2="23" y2="23"></line>
    </svg>
);

const ChevronBackIcon = ({ color }) => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
    </svg>
);

// --- Main Component ---
export default function WebLeaderboard() {
    const router = useRouter();
    const [category, setCategory] = useState("authors");
    const [type, setType] = useState("level");
    const [cachedData, setCachedData] = useState(null);
    const [isOfflineMode, setIsOfflineMode] = useState(false);
    // Safe dark mode checking for web
    const [isDark, setIsDark] = useState(false);

    const CACHE_KEY = `LB_CACHE_${category.toUpperCase()}_${type.toUpperCase()}`;

    // Handle dark mode check safely on client
    useEffect(() => {
        if (typeof window !== 'undefined') {
            setIsDark(window.matchMedia('(prefers-color-scheme: dark)').matches);
            const matcher = window.matchMedia('(prefers-color-scheme: dark)');
            matcher.addEventListener('change', e => setIsDark(e.matches));
            return () => matcher.removeEventListener('change', e => setIsDark(e.matches));
        }
    }, []);

    useEffect(() => {
        if (category === "clans") {
            setType("points");
        } else {
            setType("level");
        }
    }, [category]);

    // Load from local storage
    useEffect(() => {
        try {
            const local = localStorage.getItem(CACHE_KEY);
            if (local) setCachedData(JSON.parse(local));
        } catch (e) { console.error(e); }
    }, [type, category, CACHE_KEY]);

    const { data: swrData, isLoading } = useSWR(
        `/leaderboard?category=${category}&type=${type}&limit=200`,
        fetcher,
        {
            dedupingInterval: 1000 * 60,
            revalidateOnFocus: true,
            onSuccess: (newData) => {
                setIsOfflineMode(false);
                localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
            },
            onError: () => {
                setIsOfflineMode(true);
            }
        }
    );

    const leaderboardData = useMemo(() => {
        return swrData?.leaderboard || cachedData?.leaderboard || [];
    }, [swrData, cachedData]);

    const authorTabs = ["level", "aura", "posts", "streak", "peak"];
    const clanTabs = ["points", "followers", "weekly", "badges"];
    const currentTabs = category === "authors" ? authorTabs : clanTabs;

    // Dynamic Slider Colors based on your original RN code
    const getSliderColor = () => {
        if (category === "clans") return isDark ? '#1e293b' : '#3b82f6';
        switch (type) {
            case "level": return isDark ? '#1e293b' : '#3b82f6';
            case "aura": return '#ec4899';
            case "posts": return '#8b5cf6';
            case "streak": return '#f59e0b';
            case "peak": return '#10b981';
            default: return isDark ? '#1e293b' : '#3b82f6';
        }
    };

    const getSliderBorderColor = () => {
        if (category === "clans") return '#60a5fa';
        switch (type) {
            case "level": return '#60a5fa';
            case "aura": return '#f472b6';
            case "posts": return '#a78bfa';
            case "streak": return '#fbbf24';
            case "peak": return '#34d399';
            default: return '#60a5fa';
        }
    };

    const statusColor = isOfflineMode ? "#f59e0b" : "#60a5fa";

    const renderItem = (item, index) => {
        if (!item) return null;
        const isTop3 = index < 3;
        const highlightColor = index === 0 ? "#fbbf24" : index === 1 ? "#94a3b8" : index === 2 ? "#cd7f32" : "transparent";

        if (category === "authors") {
            const postCount = item.postCount || 0;
            const streakCount = item.streak || 0;
            const peakLvl = item.peakLevel || 0;
            const purchasedCoins = item.totalPurchasedCoins || 0;
            const totalAura = item.aura || 0;
            const rankLevel = item.currentRankLevel || 1;

            const writerRank = resolveUserRank(rankLevel, totalAura);
            const weeklyAuraRank = getAuraTier(item.previousRank);

            return (
                <div
                    key={item.userId || index}
                    className={`flex flex-row items-center p-3 mb-2 transition-all ${isTop3
                            ? 'bg-blue-50/50 dark:bg-slate-800/40 rounded-2xl border-l-4'
                            : 'border-b border-gray-200 dark:border-slate-800'
                        }`}
                    style={{
                        borderLeftColor: isTop3 ? highlightColor : (weeklyAuraRank ? weeklyAuraRank.color : 'transparent'),
                        borderLeftWidth: isTop3 ? '4px' : (weeklyAuraRank ? '2px' : '0px')
                    }}
                >
                    {/* Position */}
                    <div className="w-8 flex justify-center shrink-0">
                        <span className="font-black" style={{ fontSize: isTop3 ? '18px' : '14px', color: isTop3 ? highlightColor : (isDark ? '#475569' : '#94a3b8') }}>
                            {String(index + 1).padStart(2, '0')}
                        </span>
                    </div>

                    {/* Peak Badge / Lock */}
                    <div className="w-8 flex justify-center items-center mr-2 shrink-0">
                        {peakLvl > 0 ? (
                            <span className="text-xl">🏔️</span> /* Fallback if PeakBadge is missing on web */
                        ) : (
                            <LockIcon />
                        )}
                    </div>

                    {/* Player Info (Link) */}
                    <Link href={`/author/${item.userId}`} className="flex-1 min-w-0 pr-4 hover:opacity-80 transition-opacity block">
                        {/* Fallback Nameplate if component doesn't exist */}
                        <div className="flex flex-col">
                            <span className="font-bold text-sm truncate" style={{ color: weeklyAuraRank ? weeklyAuraRank.color : (isDark ? '#fff' : '#000') }}>
                                {item.name || item.username || "Unknown Player"}
                            </span>

                            {weeklyAuraRank && (
                                <div className="mt-0.5 inline-block px-1 rounded self-start" style={{ backgroundColor: weeklyAuraRank.color }}>
                                    <span className="text-[9px] font-bold text-black uppercase">{weeklyAuraRank.label}</span>
                                </div>
                            )}

                            <div className="flex items-center mt-1">
                                <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: writerRank.color }}>
                                    {writerRank.icon} {writerRank.title}
                                </span>
                            </div>

                            {/* Progress Bar using Framer Motion */}
                            <div className="h-[3px] w-4/5 rounded-full mt-2 overflow-hidden bg-slate-200 dark:bg-slate-900">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${writerRank.progress}%` }}
                                    transition={{ duration: 0.8, delay: 0.3 }}
                                    className="h-full rounded-full"
                                    style={{ backgroundColor: writerRank.color }}
                                />
                            </div>
                        </div>
                    </Link>

                    {/* Stats */}
                    <div className="flex flex-row items-center justify-end gap-1 w-36 shrink-0">
                        <div className="flex flex-col items-center w-7">
                            <span className="text-[6px] font-bold text-blue-500">AURA</span>
                            <span className="text-[11px] font-black text-blue-500">{formatCoins(totalAura)}</span>
                        </div>
                        <div className="flex flex-col items-center w-7">
                            <span className="text-[6px] font-bold text-pink-500">GLRY</span>
                            <span className="text-[11px] font-black text-pink-500">{formatCoins(item.weeklyAura || 0)}</span>
                        </div>
                        <div className="flex flex-col items-center w-7">
                            <span className="text-[6px] font-bold text-purple-500">DOCS</span>
                            <span className="text-[11px] font-black dark:text-white text-black">{formatCoins(postCount)}</span>
                        </div>
                        <div className="flex flex-col items-center w-7">
                            <span className="text-[6px] font-bold text-amber-500">STRK</span>
                            <span className="text-[11px] font-black text-amber-500">{streakCount}</span>
                        </div>
                        <div className="flex flex-col items-center w-7">
                            <span className="text-[6px] font-bold text-emerald-500">PEAK</span>
                            <span className="text-[11px] font-black text-emerald-500">{formatCoins(purchasedCoins)}</span>
                        </div>
                    </div>
                </div>
            );
        } else {
            // Clan Item Render
            const clanTier = resolveClanTier(item.rank || index + 1);
            return (
                <div
                    key={item.clanId || item.tag || index}
                    className={`flex flex-row items-center p-3 mb-2 transition-all ${isTop3
                            ? 'bg-blue-50/50 dark:bg-slate-800/40 rounded-2xl border-l-4'
                            : 'border-b border-gray-200 dark:border-slate-800 border-l-2'
                        }`}
                    style={{ borderLeftColor: isTop3 ? highlightColor : clanTier.color }}
                >
                    <div className="w-9 flex justify-center shrink-0">
                        <span className="font-black" style={{ fontSize: isTop3 ? '18px' : '14px', color: isTop3 ? highlightColor : (isDark ? '#475569' : '#94a3b8') }}>
                            {String(index + 1).padStart(2, '0')}
                        </span>
                    </div>

                    <Link href={`/clans/${item.tag}`} className="flex-1 min-w-0 pl-2 hover:opacity-80 block">
                        <span className="font-bold text-[15px] truncate block" style={{ color: clanTier.color }}>
                            {item.name || "Unknown Clan"}
                        </span>

                        <div className="mt-0.5 inline-block px-1.5 py-0.5 rounded border self-start bg-black" style={{ borderColor: clanTier.color }}>
                            <span className="text-[7px] font-bold uppercase" style={{ color: clanTier.color }}>{item.tag}</span>
                        </div>

                        <div className="flex items-center mt-1">
                            <span className="text-[9px] font-bold tracking-widest uppercase" style={{ color: clanTier.color }}>
                                {clanTier.label} // {clanTier.title}
                            </span>
                        </div>
                    </Link>

                    <div className="flex flex-row items-center justify-end gap-2 w-36 shrink-0">
                        <div className="flex flex-col items-center w-8">
                            <span className="text-[6px] font-bold text-slate-500">PTS</span>
                            <span className="text-[11px] font-black dark:text-white text-black">{item.totalPoints || 0}</span>
                        </div>
                        <div className="flex flex-col items-center w-8">
                            <span className="text-[6px] font-bold text-blue-400">FOL</span>
                            <span className="text-[11px] font-black text-blue-400">{item.followerCount || 0}</span>
                        </div>
                        <div className="flex flex-col items-center w-8">
                            <span className="text-[6px] font-bold text-amber-500">WEEK</span>
                            <span className="text-[11px] font-black text-amber-500">{item.currentWeeklyPoints || 0}</span>
                        </div>
                        <div className="flex flex-col items-center w-8">
                            <span className="text-[6px] font-bold text-red-500">BDG</span>
                            <span className="text-[11px] font-black text-red-500">{item.badgeCount || 0}</span>
                        </div>
                    </div>
                </div>
            );
        }
    };

    return (
        <div className="flex flex-col w-full max-w-4xl mx-auto min-h-screen bg-white dark:bg-black px-4 pt-10 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="flex items-center">
                    <button
                        onClick={() => router.back()}
                        className="p-2.5 rounded-xl border bg-slate-50 dark:bg-[#111] border-gray-200 dark:border-[#222] hover:bg-gray-100 dark:hover:bg-[#222] transition-colors"
                    >
                        <ChevronBackIcon color={statusColor} />
                    </button>
                    <div className="ml-4">
                        <h1 className="text-[22px] font-black text-black dark:text-white tracking-wide uppercase">COMMAND_CENTER</h1>
                        <div className="flex items-center">
                            <div className="w-1.5 h-1.5 rounded-full mr-2" style={{ backgroundColor: statusColor }} />
                            <span className="text-[8px] font-bold tracking-[1.5px] uppercase" style={{ color: statusColor }}>
                                {category === "authors" ? "PLAYER_INTEL" : "CLAN_HIERARCHY"}
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Category Toggle (Authors vs Clans) */}
            <div className="flex flex-row gap-2 mb-4">
                {["authors", "clans"].map((cat) => (
                    <button
                        key={cat}
                        onClick={() => setCategory(cat)}
                        className={`flex-1 h-10 rounded-xl flex items-center justify-center border transition-all ${category === cat
                                ? 'bg-blue-500 border-blue-400 dark:bg-slate-800 dark:border-blue-400'
                                : 'bg-slate-100 border-slate-200 dark:bg-[#0a0a0a] dark:border-slate-800'
                            }`}
                    >
                        <span className={`text-[10px] font-black uppercase tracking-wider ${category === cat ? 'text-white' : 'text-slate-500'}`}>
                            {cat === "authors" ? "PLAYERS" : "CLANS"}
                        </span>
                    </button>
                ))}
            </div>

            {/* Sub-Category Sliding Tabs */}
            <div className="relative bg-slate-100 dark:bg-[#0a0a0a] rounded-[18px] p-1 mb-4 border border-slate-200 dark:border-slate-800 h-14 flex items-center shadow-inner">
                <div className="relative w-full h-full flex">
                    {currentTabs.map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setType(tab)}
                            className="relative flex-1 flex items-center justify-center z-10"
                        >
                            {/* Animated Background Pill */}
                            {type === tab && (
                                <motion.div
                                    layoutId="activeTabPill"
                                    className="absolute inset-0 rounded-[14px] border border-transparent shadow-sm"
                                    style={{
                                        backgroundColor: getSliderColor(),
                                        borderColor: getSliderBorderColor()
                                    }}
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                />
                            )}
                            <span className={`relative z-20 font-black text-[10px] uppercase tracking-wider transition-colors duration-200 ${type === tab ? 'text-white' : 'text-slate-500'}`}>
                                {tab === "aura" ? "GLORY" : tab}
                            </span>
                        </button>
                    ))}
                </div>
            </div>

            {/* List Header */}
            <div className="flex flex-row px-3 py-3 border-b border-gray-200 dark:border-slate-800 mb-2">
                <span className="w-8 text-[10px] font-bold text-slate-500 uppercase text-center">POS</span>
                <span className="flex-1 text-[10px] font-bold text-slate-500 uppercase pl-10">
                    {category === "authors" ? "PLAYER_NAME" : "CLAN_NAME"}
                </span>
                <span className="w-36 text-[10px] font-bold text-slate-500 uppercase text-center">PERFORMANCE</span>
            </div>

            {/* List Content */}
            {(isLoading && leaderboardData.length === 0) ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <span className="text-sm font-bold text-slate-500 uppercase tracking-widest animate-pulse">Scanning Neural Core...</span>
                </div>
            ) : leaderboardData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20">
                    <CloudOffIcon />
                    <span className="text-slate-500 font-black mt-4 tracking-widest uppercase">NO DATA AVAILABLE</span>
                </div>
            ) : (
                <div className="flex flex-col">
                    {leaderboardData.map((item, index) => renderItem(item, index))}
                </div>
            )}
        </div>
    );
}
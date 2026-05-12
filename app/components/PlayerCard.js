import {
    Crown,
    Moon,
    ShieldCheck,
    Skull,
    Sparkles,
    Star,
    Swords
} from 'lucide-react';

// --- ⚡️ SKELETON COMPONENT ---
export function PlayerCardSkeleton({ isDark = true }) {
    return (
        <div
            className={`relative p-8 overflow-hidden animate-pulse ${isDark ? 'bg-[#0a0a0a] border-gray-800' : 'bg-white border-gray-100'} border`}
            style={{ borderRadius: 27, width: 372, height: 550 }}
        >
            <div className="flex flex-col items-center h-full w-full">
                <div className="flex justify-between items-center w-full mb-6 opacity-20">
                    <div className={`h-3 w-24 rounded ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                    <div className="flex gap-1">
                        <div className={`w-1.5 h-1.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                        <div className={`w-8 h-1.5 rounded-full ${isDark ? 'bg-gray-700' : 'bg-gray-200'}`} />
                    </div>
                </div>
                <div className={`w-[140px] h-[140px] rounded-full mb-4 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                <div className={`h-6 w-32 rounded-full mb-8 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                <div className={`h-8 w-56 rounded-lg mb-3 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                <div className={`h-5 w-36 rounded-xl mb-12 ${isDark ? 'bg-gray-800' : 'bg-gray-200'}`} />
                <div className="flex justify-around w-full border-t border-gray-100 dark:border-gray-800 pt-8 mt-auto">
                    <div className="h-10 w-20 rounded bg-gray-800/50" />
                    <div className="h-10 w-20 rounded bg-gray-800/50" />
                </div>
            </div>
        </div>
    );
}

// --- 🛰️ AURA ENGINE ---
const getAuraTier = (rank) => {
    const MONARCH_GOLD = '#fbbf24';
    const JADE_GREEN = '#10b981';
    const SHADOW_PURPLE = '#a855f7';
    const STEEL_BLUE = '#3b82f6';
    const ESPADA_COLORS = ['#f43f5e', '#e11d48', '#be123c', '#9f1239', '#881337', '#4c0519'];

    const fallback = { color: '#64748b', label: 'PLAYER', icon: <ShieldCheck size={16} /> };
    if (!rank || rank > 10 || rank <= 0) return fallback;

    switch (rank) {
        case 1: return { color: MONARCH_GOLD, label: 'MONARCH', icon: <Crown size={16} /> };
        case 2: return { color: JADE_GREEN, label: 'YONKO', icon: <Sparkles size={16} /> };
        case 3: return { color: SHADOW_PURPLE, label: 'KAGE', icon: <Moon size={16} /> };
        case 4: return { color: STEEL_BLUE, label: 'SHOGUN', icon: <Star size={16} /> };
        default:
            return {
                color: ESPADA_COLORS[rank - 5] || '#1e293b',
                label: `ESPADA ${rank - 5}`,
                icon: rank === 5 ? <Skull size={16} /> : <Swords size={16} />
            };
    }
};

// --- 🃏 MAIN COMPONENT ---
export default function PlayerCard({
    username = "OPERATOR",
    profilePic,
    backgroundImg,
    watermarkImg,
    wmRotation = "-15deg",
    wmOpacity = 0.4,
    wmScale = 1,
    isDark = true,
    rank = 1,
    isLoading = false
}) {
    const weeklyAuraTier = getAuraTier(rank);
    const themeColor = weeklyAuraTier.color;

    if (isLoading) return <PlayerCardSkeleton isDark={isDark} />;

    return (
        <div
            className={`relative p-8 overflow-hidden shadow-2xl transition-all duration-500 ${isDark ? 'bg-[#0a0a0a] border-gray-800 text-white' : 'bg-white border-gray-100 text-gray-900'
                } border`}
            style={{ borderRadius: 27, width: 372, height: 650 }}
        >
            {/* 🖼️ LAYER 0: BACKGROUND ASSET */}
            {backgroundImg && (
                <div
                    className="absolute inset-0 z-0 pointer-events-none"
                    style={{
                        backgroundImage: `url(${backgroundImg})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        opacity: 0.3 // Lowered slightly to let content pop
                    }}
                />
            )}

            {/* 🏷️ LAYER 1: WATERMARK ENGINE (NEW WEBP LOGIC) */}
            {watermarkImg && (
                <div
                    className="absolute inset-0 z-0 pointer-events-none overflow-hidden"
                    style={{ borderRadius: 27 }}
                >
                    <img
                        src={watermarkImg}
                        alt="Watermark"
                        className="absolute transition-transform duration-300 ease-out"
                        style={{
                            // Mimicking your React Native "bottom: -20, right: -20" bleed
                            bottom: '-30px',
                            right: '-30px',
                            width: '220px', // Matches your iconSize constant
                            height: '220px',
                            objectContain: 'contain',
                            opacity: Number(wmOpacity),
                            transform: `rotate(${wmRotation}) scale(${wmScale})`,
                            // Hardware acceleration for the "WebP" smoothness
                            transformOrigin: 'bottom right',
                            filter: 'contrast(1.1)'
                        }}
                    />
                </div>
            )}

            {/* 🌌 LAYER 2: CONTENT WRAPPER */}
            <div className="flex flex-col items-center w-full h-full relative z-10">
                <div className="flex justify-between items-center w-full mb-6 opacity-40">
                    <span className="text-[11px] font-black tracking-[0.5em] text-gray-400">PLAYER CARD</span>
                    <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-gray-400" />
                        <div className="w-8 h-1.5 rounded-full bg-gray-400" />
                    </div>
                </div>

                {/* AVATAR SECTION */}
                <div className="relative mb-4 group">
                    <div
                        className="w-[140px] h-[140px] rounded-full overflow-hidden border-4 transition-transform group-hover:scale-105"
                        style={{
                            borderColor: themeColor,
                            boxShadow: `0 0 25px ${themeColor}55`
                        }}
                    >
                        <img
                            src={profilePic || '/default-avatar.png'}
                            className="w-full h-full object-cover bg-gray-900"
                            alt="Profile"
                        />
                    </div>
                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-black border border-white/20 px-4 py-1 rounded-full whitespace-nowrap shadow-lg z-20">
                        <span className="text-white text-[10px] font-black italic tracking-widest flex items-center gap-2">
                            {weeklyAuraTier.icon} {weeklyAuraTier.label}
                        </span>
                    </div>
                </div>

                {/* IDENTITY BLOCK */}
                <div className="text-center w-full mt-2">
                    <h2 className="text-2xl font-black italic tracking-tighter mb-1 uppercase">
                        {username}
                    </h2>
                    <div className="inline-flex items-center bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/10 rounded-xl px-4 py-1.5 mb-6">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">STATUS:</span>
                        <span className="text-[9px] font-black uppercase tracking-widest ml-2 italic text-blue-500">ACTIVE_OPERATOR</span>
                    </div>

                    {/* STATS FOOTER */}
                    <div className="flex justify-around w-full border-t border-gray-100 dark:border-gray-800 pt-6 mt-12">
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">RANK</p>
                            <p className="text-lg font-black" style={{ color: themeColor }}>#{rank}</p>
                        </div>
                        <div className="text-center">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">AURA</p>
                            <p className="text-lg font-black text-blue-500">MAX</p>
                        </div>
                    </div>
                </div>

                {/* SYSTEM TAG */}
                <div className="w-full mt-auto pt-4 border-t border-dashed border-gray-200 dark:border-gray-800 flex justify-between items-center opacity-50">
                    <div className="flex gap-1">
                        <div className="w-3 h-1 bg-gray-400 rounded-full" />
                        <div className="w-1.5 h-1 bg-gray-400 rounded-full" />
                    </div>
                    <span className="text-[9px] font-mono text-gray-400 uppercase tracking-tighter">VAULT_STAMP_v2.6</span>
                </div>
            </div>
        </div>
    );
}
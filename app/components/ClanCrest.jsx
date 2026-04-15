"use client";

import { motion } from "framer-motion";

const CLAN_TIERS = {
    6: { label: 'VI', color: '#ef4444', icon: 'cloud', title: "The Akatsuki" },
    5: { label: 'V', color: '#e0f2fe', icon: 'skull', title: "The Espada" },
    4: { label: 'IV', color: '#a855f7', icon: 'spider', title: "Phantom Troupe" },
    3: { label: 'III', color: '#60a5fa', icon: 'eye', title: "Upper Moon" },
    2: { label: 'II', color: '#10b981', icon: 'sword-cross', title: "Squad 13" },
    1: { label: 'I', color: '#94a3b8', icon: 'weather-windy', title: "Wandering Ronin" },
};

// Inline SVG renderer for the crest background icons
const CrestIcon = ({ name, size, color }) => {
    const iconProps = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: color,
        strokeWidth: "1.5",
        strokeLinecap: "round",
        strokeLinejoin: "round"
    };

    switch (name) {
        case 'cloud':
            return (
                <svg {...iconProps}>
                    <path d="M17.5 19c.4 0 .8-.1 1.1-.3 1.4-.7 2.4-2.1 2.4-3.7 0-2.1-1.6-3.9-3.7-4.3-.1-.4-.2-.8-.2-1.2 0-2.5-2-4.5-4.5-4.5-2 0-4 1.5-4.5 3.8-.5-.5-1.2-.8-2-.8-2.5 0-4.5 2-4.5 4.5 0 .7.1 1.4.4 2.1-.6.2-1 .8-1 1.4 0 1.1.9 2 2 2h14.5Z" />
                </svg>
            );
        case 'skull':
            return (
                <svg {...iconProps}>
                    <path d="M12 4C7.58 4 4 7.58 4 12v4c0 2.21 1.79 4 4 4h8c2.21 0 4-1.79 4-4v-4c0-4.42-3.58-8-8-8Z" />
                    <path d="M9 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM15 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2ZM8 15h8M10 18v2M12 18v2M14 18v2" />
                </svg>
            );
        case 'spider':
            return (
                <svg {...iconProps}>
                    <circle cx="12" cy="9" r="2" />
                    <path d="M12 11c-2 0-4 2-4 5s2 4 4 4 4-1 4-4-2-5-4-5ZM8 10L3 7M8 12L3 12M8 14l-5 3M16 10l5-3M16 12l5 0M16 14l5 3M10 8L7 4M14 8l3-4M10 18l-3 4M14 18l3 4" />
                </svg>
            );
        case 'eye':
            return (
                <svg {...iconProps}>
                    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                    <circle cx="12" cy="12" r="3" />
                </svg>
            );
        case 'sword-cross':
            return (
                <svg {...iconProps}>
                    <path d="m3 21 18-18M3 3l18 18M12 12l-2-2M12 12l2 2M12 12l-2 2M12 12l2-2" />
                </svg>
            );
        case 'weather-windy':
            return (
                <svg {...iconProps}>
                    <path d="M17.5 8H3M21 12H3M17.5 16H3M17.5 8a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0-2.5 2.5M21 12a2.5 2.5 0 1 1 0 5 2.5 2.5 0 0 1-2.5-2.5M17.5 16a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0-2.5-2.5" />
                </svg>
            );
        default:
            return null;
    }
};

const ClanCrest = ({ rank = 1, size = 120, isFeed = false, glowColor = null }) => {
    // Determine the configuration based on rank
    const config = CLAN_TIERS[rank] || CLAN_TIERS[1];

    // Use glowColor if provided, otherwise fallback to rank color
    const displayColor = glowColor || config.color;

    return (
        <div style={{ width: size, height: size }} className="flex items-center justify-center relative">

            {/* Background Symbol Icon */}
            <div className="absolute opacity-20 pointer-events-none">
                <CrestIcon name={config.icon} size={size * 0.7} color={displayColor} />
            </div>

            {/* Energy Wave Pulse (Framer Motion) */}
            <motion.div
                className="absolute border-solid"
                style={{
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    borderColor: displayColor,
                    boxShadow: `0 0 15px ${displayColor}`,
                }}
                animate={{
                    scale: [0.6, 1.4],
                    opacity: [0, 0.6, 0],
                    borderWidth: ['4px', '1px']
                }}
                transition={{
                    duration: 3,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />

            {/* Roman Numeral Figure */}
            <span
                className="font-black italic tracking-tighter z-10 select-none"
                style={{
                    fontSize: size * 0.35,
                    color: displayColor,
                    textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
                }}
            >
                {config.label}
            </span>

            {/* Rank Title (Hidden if in feed) */}
            {!isFeed && (
                <div className="absolute -bottom-2 whitespace-nowrap">
                    <span
                        className="font-black uppercase tracking-[0.2em] text-[8px]"
                        style={{ color: displayColor }}
                    >
                        {config.title}
                    </span>
                </div>
            )}
        </div>
    );
};

export default ClanCrest;
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
                    <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
                </svg>
            );
        case 'skull':
            return (
                <svg {...iconProps}>
                    <circle cx="9" cy="12" r="1" fill={color} />
                    <circle cx="15" cy="12" r="1" fill={color} />
                    <path d="M8 20v2 M12 20v2 M16 20v2 M12 4a8 8 0 0 0-8 8v4a4 4 0 0 0 4 4h8a4 4 0 0 0 4-4v-4a8 8 0 0 0-8-8Z" />
                </svg>
            );
        case 'spider':
            return (
                <svg {...iconProps}>
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 8L7 3 M12 8L17 3 M8 12H2 M16 12H22 M12 16L7 21 M12 16L17 21" />
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
                    <path d="M14.5 17.5L3 6l1.5-1.5L16 16m-8 0L21 4.5 19.5 3 8 14.5m4 4l-3-3m0-6l3-3" />
                </svg>
            );
        case 'weather-windy':
            return (
                <svg {...iconProps}>
                    <path d="M17.5 8H3 M21 12H3 M17.5 16H3 M17.5 8a2.5 2.5 0 0 0 0-5 2.5 2.5 0 0 0-2.5 2.5 M21 12a2.5 2.5 0 0 1 0 5 2.5 2.5 0 0 1-2.5-2.5 M17.5 16a2.5 2.5 0 0 0 0 5 2.5 2.5 0 0 0-2.5-2.5" />
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
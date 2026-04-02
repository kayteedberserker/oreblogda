"use client";

import { motion } from "framer-motion";
import dynamic from 'next/dynamic';
import { useMemo, useState } from "react";

// ⚡️ Dynamically import Lottie for Next.js to prevent SSR issues
const Lottie = dynamic(() => import('lottie-react'), { ssr: false });

export default function AuraAvatar({
    author,
    aura,
    isTop10,
    onPress,
    size = 44,
    glowColor = null
}) {
    const [imageLoading, setImageLoading] = useState(true);

    const displayColor = glowColor || aura?.color || '#3b82f6';
    const rank = author?.rank || 100;
    const hasPremiumAura = isTop10 || glowColor;

    // --- CHECK FOR AVATAR VFX (Fire, Lightning, etc.) ---
    const equippedVfx = useMemo(() => {
        return author?.inventory?.find(i => i.category === 'AVATAR_VFX' && i.isEquipped);
    }, [author?.inventory]);

    const vfxUrl = equippedVfx?.visualConfig?.lottieUrl || null;

    // --- CHECK FOR PREMIUM AVATAR (Lottie or SVG) ---
    const equippedAnimatedAvatar = useMemo(() => {
        return author?.inventory?.find(i => i.category === 'AVATAR' && i.isEquipped);
    }, [author?.inventory]);

    const animatedAvatarUrl = equippedAnimatedAvatar?.visualConfig?.lottieUrl || null;
    const rawSvgAvatarCode = equippedAnimatedAvatar?.visualConfig?.svgCode || null;

    // --- STATIC SHAPES BASED ON RANK ---
    const frameStyle = useMemo(() => {
        const base = { borderRadius: size / 2, borderWidth: 1.5 };
        if (rank === 1) return { borderRadius: size * 0.25, transform: 'rotate(45deg)', borderWidth: 2.5 };
        if (rank === 2) return { ...base, borderRadius: size * 0.45, borderWidth: 2 };
        if (rank === 3) return { ...base, borderTopLeftRadius: 2, borderRadius: size * 0.6 };
        return { ...base, borderRadius: size };
    }, [rank, size]);

    // --- ANIMATION CONFIGS FOR FRAMER MOTION ---
    const pulseSpeed = rank === 1 ? 0.8 : rank <= 3 ? 1.2 : rank <= 5 || glowColor ? 1.5 : 2.0;

    // ========================================================
    // ⚡️ PROPORTIONAL SCALING MATH FOR VFX
    // ========================================================
    const sizeRatio = size / 44;
    const containerSize = size + (24 * sizeRatio);
    const vfxScale = equippedVfx?.visualConfig?.zoom || 1.3;
    const vfxBaseDim = size * 1.5;
    const vfxWidth = vfxBaseDim * vfxScale;
    const vfxHeight = vfxBaseDim * vfxScale;
    const offsetY = (equippedVfx?.visualConfig?.offsetY || 0) * sizeRatio;

    // Lottie fetching state
    const [vfxData, setVfxData] = useState(null);
    const [avatarData, setAvatarData] = useState(null);

    // Fetch Lottie JSONs if they exist
    useMemo(() => {
        if (vfxUrl) fetch(vfxUrl).then(r => r.json()).then(setVfxData).catch(() => { });
        if (animatedAvatarUrl) fetch(animatedAvatarUrl).then(r => r.json()).then(setAvatarData).catch(() => { });
    }, [vfxUrl, animatedAvatarUrl]);

    return (
        <button
            onClick={onPress}
            style={{ width: containerSize, height: containerSize }}
            className="relative shrink-0 flex items-center justify-center bg-transparent border-none p-0 cursor-pointer outline-none focus:outline-none group"
        >
            {hasPremiumAura && (
                <>
                    {/* The Breathing Fire/Glow Aura */}
                    <motion.div
                        style={{
                            ...frameStyle,
                            position: 'absolute',
                            width: size + 2,
                            height: size + 2,
                            backgroundColor: displayColor,
                            boxShadow: `0 0 10px ${displayColor}`,
                            transform: rank === 1 ? 'rotate(45deg)' : 'rotate(0deg)'
                        }}
                        animate={{
                            scale: [1, 1.15, 1],
                            opacity: [0.15, 0.4, 0.15],
                            boxShadow: [`0 0 5px ${displayColor}`, `0 0 15px ${displayColor}`, `0 0 5px ${displayColor}`]
                        }}
                        transition={{ duration: pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
                    />

                    {/* Rotating Rings for High Ranks */}
                    {rank === 1 && (
                        <>
                            <motion.div
                                style={{ width: size + 14, height: size + 14, borderRadius: '100%', borderWidth: 1.5, borderColor: displayColor, borderStyle: 'dashed', opacity: 0.8, position: 'absolute' }}
                                animate={{ rotate: 360 }}
                                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            />
                            <motion.div
                                style={{ width: size + 22, height: size + 22, borderRadius: '100%', borderWidth: 1, borderColor: displayColor, borderStyle: 'dotted', opacity: 0.4, position: 'absolute' }}
                                animate={{ rotate: -360 }}
                                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                            />
                        </>
                    )}

                    {(rank === 2 || rank === 3) && (
                        <motion.div
                            style={{ width: size + 12, height: size + 12, borderRadius: '100%', borderWidth: 1.5, borderColor: displayColor, borderStyle: 'dashed', opacity: 0.6, position: 'absolute' }}
                            animate={{ rotate: 360 }}
                            transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                        />
                    )}

                    {((rank === 4 || rank === 5) || glowColor) && (
                        <>
                            <motion.div
                                style={{ width: size + 10, height: size + 10, borderRadius: '100%', borderWidth: 1, borderColor: displayColor, borderStyle: 'dotted', opacity: 0.7, position: 'absolute' }}
                                animate={{ rotate: 360 }}
                                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                            />
                            <motion.div
                                style={{ width: size + 16, height: size + 16, borderRadius: '100%', borderWidth: 1, borderColor: displayColor, borderStyle: 'dotted', opacity: 0.3, position: 'absolute' }}
                                animate={{ rotate: -360 }}
                                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                            />
                        </>
                    )}

                    {(rank >= 6 && rank <= 10 && !glowColor) && (
                        <motion.div
                            style={{ width: size + 8, height: size + 8, borderRadius: '100%', borderWidth: 1, borderColor: displayColor, position: 'absolute' }}
                            animate={{ rotate: 360, opacity: [0.1, 0.6, 0.1] }}
                            transition={{ duration: pulseSpeed, repeat: Infinity, ease: "linear" }}
                        />
                    )}
                </>
            )}

            {/* ⚡️ FIXED: PERFECTLY ANCHORED & SCALED LOTTIE VFX LAYER */}
            {vfxData && (
                <div
                    style={{
                        position: 'absolute',
                        width: vfxWidth,
                        height: vfxHeight,
                        top: (containerSize - vfxHeight) / 2 + offsetY,
                        left: (containerSize - vfxWidth) / 2,
                        zIndex: 10,
                        pointerEvents: 'none',
                        overflow: 'visible',
                        transform: `scale(${equippedVfx?.visualConfig?.zoom || 1})`
                    }}
                >
                    <Lottie
                        animationData={vfxData}
                        loop={true}
                        style={{ width: '100%', height: '100%' }}
                        className={equippedVfx?.visualConfig?.applyThemeColor ? 'hue-rotate-15' : ''}
                    />
                </div>
            )}

            {/* 👤 THE AVATAR IMAGE, LOTTIE, OR SVG */}
            <motion.div
                className="bg-gray-100 dark:bg-[#111]"
                style={{
                    ...frameStyle,
                    width: size,
                    height: size,
                    borderColor: hasPremiumAura ? displayColor : 'rgba(156, 163, 175, 0.3)',
                    overflow: 'hidden',
                    zIndex: 2,
                    position: 'relative'
                }}
                animate={hasPremiumAura ? { y: [0, -3, 0] } : {}}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
                {/* ⚡️ CHECK 1: Is it an Animated Lottie Avatar? */}
                {avatarData ? (
                    <div style={rank === 1 ? { transform: 'rotate(-45deg) scale(1.4)', width: '100%', height: '100%' } : { width: '100%', height: '100%' }}>
                        <Lottie
                            animationData={avatarData}
                            loop={true}
                            style={{ width: '100%', height: '100%' }}
                        />
                    </div>

                ) : rawSvgAvatarCode ? (
                    // ⚡️ Native Tailwind SVG Theming: "text-black dark:text-white" forces "currentColor" inside the SVG to automatically adapt!
                    <div
                        className="w-full h-full flex items-center justify-center text-black dark:text-white"
                        style={{
                            transform: rank === 1 ? 'rotate(-45deg) scale(1.4)' : 'none'
                        }}
                        dangerouslySetInnerHTML={{ __html: rawSvgAvatarCode }}
                    />

                ) : author?.image ? (
                    <>
                        <img
                            src={author.image}
                            alt={author.name}
                            style={{
                                width: '100%', height: '100%', objectFit: 'cover',
                                transform: rank === 1 ? 'rotate(-45deg) scale(1.4)' : 'none'
                            }}
                            onLoad={() => setImageLoading(false)}
                        />
                        {imageLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                                <div className="w-4 h-4 border-2 border-transparent rounded-full animate-spin" style={{ borderTopColor: displayColor }} />
                            </div>
                        )}
                    </>

                ) : (
                    <div
                        className="w-full h-full flex items-center justify-center"
                        style={{ backgroundColor: hasPremiumAura ? displayColor : '#64748b' }}
                    >
                        <span
                            style={rank === 1 ? { transform: 'rotate(-45deg)' } : {}}
                            className="text-white font-black text-lg"
                        >
                            {author?.name?.charAt(0).toUpperCase() || "?"}
                        </span>
                    </div>
                )}
            </motion.div>
        </button>
    );
}
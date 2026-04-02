"use client";

import { useMemo } from 'react';

// Theme configuration matching your original
const getBadgeTheme = (level) => {
    if (level < 3) return { name: 'Bronze', main: '#d97743', light: '#fca5a5', dark: '#7f1d1d' };
    if (level < 5) return { name: 'Silver', main: '#94a3b8', light: '#f8fafc', dark: '#334155' };
    if (level < 7) return { name: 'Gold', main: '#eab308', light: '#fef08a', dark: '#713f12' };
    if (level < 9) return { name: 'Amethyst', main: '#a855f7', light: '#e9d5ff', dark: '#4c1d95' };
    return { name: 'Emerald', main: '#22c55e', light: '#bbf7d0', dark: '#14532d' };
};

// SVG Paths matching your Skia generators
const createChevronPath = (x, y, w, h) => `M ${x - w / 2} ${y} L ${x} ${y + h * 0.6} L ${x + w / 2} ${y} L ${x + w / 2} ${y + h * 0.4} L ${x} ${y + h} L ${x - w / 2} ${y + h * 0.4} Z`;
const createDiamondPath = (x, y, r) => `M ${x} ${y - r} L ${x + r} ${y} L ${x} ${y + r} L ${x - r} ${y} Z`;

export default function PeakBadge({ level = 1, size = 32 }) {
    const safeLevel = Math.max(1, level);
    const theme = getBadgeTheme(safeLevel);

    // --- DIMENSION MATH ---
    const w = size;
    const h = size * 1.2;

    let widthMultiplier = 1.0;
    if (safeLevel >= 9) widthMultiplier = 1.8;
    else if (safeLevel >= 3) widthMultiplier = 1.6;

    const cw = size * widthMultiplier;
    const offsetX = (cw - w) / 2;
    const cx = cw / 2;
    const cy = h / 2;

    const hexPath = `M ${offsetX + w / 2} 0 L ${offsetX + w} ${h * 0.25} L ${offsetX + w} ${h * 0.75} L ${offsetX + w / 2} ${h} L ${offsetX} ${h * 0.75} L ${offsetX} ${h * 0.25} Z`;

    const inset = size * 0.15;
    const innerH = h - inset * 2;
    const innerHexPath = `M ${offsetX + w / 2} ${inset} L ${offsetX + w - inset} ${inset + innerH * 0.25} L ${offsetX + w - inset} ${inset + innerH * 0.75} L ${offsetX + w / 2} ${h - inset} L ${offsetX + inset} ${inset + innerH * 0.75} L ${offsetX + inset} ${inset + innerH * 0.25} Z`;

    let wingsPath = '';
    if (safeLevel >= 3) {
        wingsPath += `M ${cx} ${cy - h * 0.2} L ${cx + w * 0.8} ${cy - h * 0.5} L ${cx + w * 0.6} ${cy} L ${cx} ${cy + h * 0.1} Z `;
        wingsPath += `M ${cx} ${cy - h * 0.2} L ${cx - w * 0.8} ${cy - h * 0.5} L ${cx - w * 0.6} ${cy} L ${cx} ${cy + h * 0.1} Z `;
    }
    if (safeLevel >= 7) {
        wingsPath += `M ${cx} ${cy} L ${cx + w * 0.7} ${cy + h * 0.2} L ${cx + w * 0.5} ${cy + h * 0.5} L ${cx} ${cy + h * 0.2} Z `;
        wingsPath += `M ${cx} ${cy} L ${cx - w * 0.7} ${cy + h * 0.2} L ${cx - w * 0.5} ${cy + h * 0.5} L ${cx} ${cy + h * 0.2} Z `;
    }
    if (safeLevel >= 9) {
        wingsPath += `M ${cx} ${cy - h * 0.1} L ${cx + w * 0.9} ${cy - h * 0.2} L ${cx + w * 0.8} ${cy - h * 0.1} L ${cx} ${cy} Z `;
        wingsPath += `M ${cx} ${cy - h * 0.1} L ${cx - w * 0.9} ${cy - h * 0.2} L ${cx - w * 0.8} ${cy - h * 0.1} L ${cx} ${cy} Z `;
    }

    // --- DYNAMIC LAYOUT ENGINE ---
    const indicatorPaths = useMemo(() => {
        const chevronCount = Math.floor(safeLevel / 5);
        const diamondCount = safeLevel % 5;

        const rows = [];
        for (let i = 0; i < chevronCount; i++) rows.push({ type: 'chevron' });

        if (diamondCount === 1) rows.push({ type: 'diamond', count: 1 });
        else if (diamondCount === 2) rows.push({ type: 'diamond', count: 2 });
        else if (diamondCount === 3) { rows.push({ type: 'diamond', count: 2 }); rows.push({ type: 'diamond', count: 1 }); }
        else if (diamondCount === 4) { rows.push({ type: 'diamond', count: 2 }); rows.push({ type: 'diamond', count: 2 }); }

        const totalRows = rows.length;
        let scaleMultiplier = 1.0;
        if (totalRows === 1) scaleMultiplier = 1.25;
        else if (totalRows === 2) scaleMultiplier = 0.95;
        else if (totalRows === 3) scaleMultiplier = 0.75;
        else scaleMultiplier = 0.6;

        const chevronW = size * 0.5 * scaleMultiplier;
        const chevronH = size * 0.2 * scaleMultiplier;
        const diamondR = size * 0.12 * scaleMultiplier;
        const gap = size * 0.08 * scaleMultiplier;
        const diamondSpacing = diamondR * 2.2;

        let totalStackHeight = 0;
        rows.forEach(row => {
            totalStackHeight += (row.type === 'chevron' ? chevronH : diamondR * 2) + gap;
        });
        totalStackHeight -= gap;

        let currentY = cy - (totalStackHeight / 2);
        let paths = '';

        rows.forEach(row => {
            if (row.type === 'chevron') {
                paths += createChevronPath(cx, currentY, chevronW, chevronH) + ' ';
                currentY += chevronH + gap;
            } else {
                if (row.count === 1) {
                    paths += createDiamondPath(cx, currentY + diamondR, diamondR) + ' ';
                } else if (row.count === 2) {
                    paths += createDiamondPath(cx - diamondSpacing / 2, currentY + diamondR, diamondR) + ' ';
                    paths += createDiamondPath(cx + diamondSpacing / 2, currentY + diamondR, diamondR) + ' ';
                }
                currentY += (diamondR * 2) + gap;
            }
        });
        return paths;
    }, [safeLevel, cx, cy, size]);

    // Unique IDs for SVG definitions
    const idSuffix = `${safeLevel}-${Math.random().toString(36).substr(2, 9)}`;
    const wingsGradientId = `wingsGrad-${idSuffix}`;
    const hexOuterGradId = `hexOuterGrad-${idSuffix}`;
    const hexInnerGradId = `hexInnerGrad-${idSuffix}`;
    const highlightGradId = `highlightGrad-${idSuffix}`;
    const maskId = `badgeMask-${idSuffix}`;

    return (
        <div style={{ width: cw, height: h }} className="relative flex items-center justify-center">

            {/* CSS Animation for the sweeping light effect */}
            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes sweep-${idSuffix} {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(150%); }
                }
                .sweep-anim-${idSuffix} {
                    animation: sweep-${idSuffix} 2.5s ease-in-out infinite;
                }
            `}} />

            <svg width={cw} height={h} viewBox={`0 0 ${cw} ${h}`} fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                    {/* Gradients */}
                    <linearGradient id={wingsGradientId} x1="0" y1="0" x2={cw} y2="0" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor={theme.dark} />
                        <stop offset="50%" stopColor={theme.main} />
                        <stop offset="100%" stopColor={theme.dark} />
                    </linearGradient>

                    <linearGradient id={hexOuterGradId} x1={offsetX} y1="0" x2={offsetX + w} y2={h} gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor={theme.light} />
                        <stop offset="100%" stopColor={theme.dark} />
                    </linearGradient>

                    <linearGradient id={hexInnerGradId} x1={offsetX + w} y1="0" x2={offsetX} y2={h} gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor={theme.main} />
                        <stop offset="100%" stopColor={theme.dark} />
                    </linearGradient>

                    <linearGradient id={highlightGradId} x1={offsetX} y1="0" x2={offsetX} y2={h / 2} gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#ffffff" />
                        <stop offset="100%" stopColor="transparent" />
                    </linearGradient>

                    {/* Mask Definition */}
                    <mask id={maskId}>
                        {safeLevel >= 3 && <path d={wingsPath} fill="white" opacity="0.6" />}
                        <path d={hexPath} fill="white" />
                        <path d={indicatorPaths} fill="white" />
                    </mask>

                    {/* Drop shadow for insignias */}
                    <filter id={`shadow-${idSuffix}`} x="-20%" y="-20%" width="140%" height="140%">
                        <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="rgba(0,0,0,0.5)" />
                    </filter>
                </defs>

                {/* THE WINGS */}
                {safeLevel >= 3 && <path d={wingsPath} fill={`url(#${wingsGradientId})`} />}

                {/* Outer Bevel */}
                <path d={hexPath} fill={`url(#${hexOuterGradId})`} />

                {/* Inner Core */}
                <path d={innerHexPath} fill={`url(#${hexInnerGradId})`} />

                {/* THE DYNAMIC INSIGNIAS */}
                <path d={indicatorPaths} fill="#FFFFFF" filter={`url(#shadow-${idSuffix})`} />

                {/* Soft highlight */}
                <path d={innerHexPath} fill={`url(#${highlightGradId})`} opacity="0.3" />

                {/* Masked sweeping light effect */}
                <g mask={`url(#${maskId})`}>
                    {/* Animate this rect across the SVG */}
                    <rect
                        className={`sweep-anim-${idSuffix}`}
                        x={0}
                        y={0}
                        width={cw * 0.4}
                        height={h}
                        fill="url(#sweepGrad)"
                    />
                </g>

                {/* Shared gradient for the sweeping light */}
                <defs>
                    <linearGradient id="sweepGrad" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(255,255,255,0)" />
                        <stop offset="50%" stopColor="rgba(255,255,255,0.7)" />
                        <stop offset="100%" stopColor="rgba(255,255,255,0)" />
                    </linearGradient>
                </defs>
            </svg>
        </div>
    );
}
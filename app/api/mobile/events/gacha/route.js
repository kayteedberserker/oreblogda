import connectDB from '@/app/lib/mongodb';
import MobileUser from '@/app/models/MobileUserModel';
import { NextResponse } from 'next/server';

const GACHA_POOLS = {
    // 🌌 1. ASTRAL AWAKENING (Copyright-Safe Anime Theme - Grid Spark System)
    'astral_awakening_01': [
        // ==========================================
        // 👑 MYTHIC (1% Total) - Animated Lottie
        // ==========================================
        {
            id: 'astral_mythic_susanoo',
            name: "Susano'o Flame",
            category: 'WATERMARK',
            keepBaseRate: true,
            rarity: 'Mythic',
            baseDropRate: 0.2,
            exchangePrice: 800, // ⚡️ High weight
            visualConfig: { lottieUrl: 'https://oreblogda.com/lottie/astralfire_vfx_wm.json', primaryColor: "#a855f7", }
        },
        {
            id: 'astral_mythic_petals',
            name: 'Falling Blossoms',
            category: 'AVATAR_VFX',
            keepBaseRate: true,
            rarity: 'Mythic',
            baseDropRate: 0.3,
            exchangePrice: 700,
            visualConfig: { lottieUrl: 'https://oreblogda.com/lottie/blossom_vfx.json', zoom: 0.8, }
        },

        // ==========================================
        // 🟡 LEGENDARY (6% Total) - Animated Lottie
        // ==========================================
        {
            id: 'astral_leg_hero',
            name: 'Hello ',
            category: 'AVATAR',
            rarity: 'Legendary',
            baseDropRate: 0.8,
            exchangePrice: 650,
            visualConfig: { lottieUrl: 'https://oreblogda.com/lottie/hianim_avatar.json' }
        },
        {
            id: 'astral_leg_aura',
            name: 'Ascendant Aura',
            category: 'AVATAR_VFX',
            rarity: 'Legendary',
            baseDropRate: 1,
            exchangePrice: 600, // ⚡️ The Ultimate Prize
            visualConfig: {
                lottieUrl: 'https://oreblogda.com/lottie/goldaura_vfx.json',
                zoom: 1,
                offsetY: 0,
            }
        },
        {
            id: 'astral_leg_domain',
            name: 'Dark Space',
            category: 'BACKGROUND',
            rarity: 'Legendary',
            baseDropRate: 0.7,
            exchangePrice: 650,
            visualConfig: {
                lottieUrl: 'https://oreblogda.com/lottie/infinitevoid_bg.json',
                primaryColor: "#a855f7",
            }
        },

        // ==========================================
        // 🟣 EPIC (9% Total) - Native Animations
        // ==========================================
        {
            id: 'astral_epic_dragon_border',
            name: 'Dragon Breath',
            category: 'BORDER',
            rarity: 'Epic',
            baseDropRate: 3.0,
            exchangePrice: 200,
            visualConfig: {
                primaryColor: '#ef4444',
                secondaryColor: '#f97316',
                animationType: 'clash', // ⚡️ Use native clash logic
                isAnimated: true
            }
        },
        {
            id: 'astral_epic_cyber_glow',
            name: 'Netrunner Interface',
            category: 'GLOW',
            rarity: 'Epic',
            baseDropRate: 3.0,
            exchangePrice: 150,
            visualConfig: {
                svgCode: `
                    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="10" fill="none" stroke="#06b6d4" stroke-width=".5" stroke-dasharray="1,2" opacity=".3"/><path d="M7 4H4v3m13-3h3v3M7 20H4v-3m13 3h3v-3" stroke="#06b6d4" stroke-width="1.2" fill="none" stroke-linecap="square"/><g fill="#06b6d4"><path opacity=".8" d="M11 2h2v1h-2z"/><path opacity=".6" d="M2 11h1v2H2z"/><path opacity=".9" d="M21 11h1v1h-1z"/><path opacity=".4" d="M11 21h2v.5h-2z"/></g><circle cx="12" cy="12" r="6" fill="#06b6d4" fill-opacity=".1" stroke="#06b6d4" stroke-width=".5"/><path stroke="#06b6d4" stroke-width=".2" opacity=".5" d="M8 11h8m-8 2h8"/></svg>
                `,
                primaryColor: '#06b6d4',
                isAnimated: true,
                animationType: 'glitch' // ⚡️ Use native glitch logic
            }
        },
        {
            id: 'astral_epic_village',
            name: 'Hidden Leaf Forest',
            category: 'BACKGROUND',
            rarity: 'Epic',
            baseDropRate: 2.0,
            exchangePrice: 250,
            visualConfig: {
                primaryColor: '#22c55e',
                opacity: 0.3,
                isAnimated: false,
                svgCode: `
                    <svg viewBox="0 0 100 60" xmlns="http://www.w3.org/2000/svg">
                      <defs>
                        <linearGradient id="leafGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                          <stop offset="0%" stop-color="#22c55e" />
                          <stop offset="100%" stop-color="#064e3b" />
                        </linearGradient>
                      </defs>
                      <rect x="0" y="0" width="100" height="60" fill="url(#leafGrad)" />

                      <circle cx="50" cy="60" r="40" fill="#4ade80" opacity="0.2" />
                      <circle cx="50" cy="60" r="20" fill="#86efac" opacity="0.3" />

                      <path d="M-10 60 L15 35 L30 45 L45 25 L65 50 L85 30 L110 60 Z" fill="#022c22" opacity="0.6" />

                      <g fill="#4ade80" opacity="0.6">
                        <path d="M20 20 Q25 15 30 20 Q25 25 20 20 Z" transform="rotate(15 25 20)" />
                        <path d="M70 15 Q75 10 80 15 Q75 20 70 15 Z" transform="rotate(-20 75 15)" />
                        <path d="M45 10 Q50 5 55 10 Q50 15 45 10 Z" transform="rotate(45 50 10)" />
                      </g>
                    </svg>    
                `
            }
        },

        // ==========================================
        // 🔵 RARE (20% Total) - Timed Custom Animations
        // ==========================================
        {
            id: 'astral_rare_cursed_glow',
            name: 'Cursed Energy (7d)',
            category: 'GLOW',
            rarity: 'Rare',
            baseDropRate: 4.0,
            exchangePrice: 150,
            expiresInDays: 7,
            visualConfig: {
                svgCode: `
                    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="#8b5cf6" fill-opacity=".2"><animate attributeName="r" values="40;48;40" dur="2s" repeatCount="indefinite"/></circle><g fill="none" stroke="#8b5cf6" stroke-width="2" stroke-linecap="round" opacity=".6"><path d="m50 10 5 15H45Zm40 40-15 5V45ZM50 90l-5-15h10ZM10 50l15-5v10Z"/><path d="m20 20 15 15m45 45L65 65" stroke-dasharray="4,2"/></g><circle cx="50" cy="50" r="25" fill="#2e1065" stroke="#8b5cf6" stroke-width="3"/><circle cx="50" cy="50" r="15" fill="none" stroke="#d946ef"><animate attributeName="r" values="10;22;10" dur="1.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="1.5s" repeatCount="indefinite"/></circle></svg>
                `,
                primaryColor: '#8b5cf6', isAnimated: true, animationType: 'pulse'
            }
        },
        {
            id: 'astral_rare_pirate_mark',
            name: 'Crossbones (7d)',
            category: 'WATERMARK',
            rarity: 'Rare',
            baseDropRate: 4.0,
            exchangePrice: 200,
            expiresInDays: 7,
            visualConfig: {
                primaryColor: '#f87171',
                svgCode: `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 474.23 355.54" version="1.0"><path fill="#581c87" stroke="#d946ef" stroke-width=".5" d="M474.18 59.672c-.24 5.823 2.29 17.688-19.78 54.518-24.64 41.13-62.64 75.31-99.9 102.99-22.47 16.69-45.5 30.24-69.41 42.23-6.22-2.03-13.88-4.7-22.44-8.05-.06-.01-.11-.04-.17-.06 5.94-2.95 12.36-6.25 19.38-9.99 68.82-36.62 81.57-58.7 80.97-59.3s-17.9 19.56-77.22 54.1c-8.64 5.03-17.49 9.59-26.51 13.75-6.68-2.76-13.23-5.77-18.82-8.61 28.81-12.49 59.51-28.04 84.67-44.67 38.71-25.59 75.16-55.58 104.06-89.26 26.41-30.764 37.26-46.605 38.93-49.727 2.61-4.908 6.81-11.669 6.24 2.079m-17.56 33.847c-.82-.278-6.65 14.981-27.47 40.501-20.77 25.47-39.41 40.78-38.57 41.61.83.83 16.75-10.46 41.07-40.78 21.88-27.27 25.81-41.056 24.97-41.331M303.24 113.06c-3.05.83-4.56-2.89-4.79-5.95-.56-7.212.67-11.526.07-15.375-.67-4.359 1.71-11.415-3.72-9.076-3.08 1.327-.52 4.757.59 8.362s.83 15.749.83 18.309c0 4.44 2.5 7.04 9.16 9.43 7.66 2.76 1.57 20.7-5.82 22.75-7.68 2.14-11.99-3.16-17.49-2.22-9.71 1.67-7.77 11.1-9.71 14.15s-1.94 3.05-5.27 6.38c-2.45 2.45-4.05 4.41-5.77 5.96.27.23.46.63.51 1.3.21 2.92 2.55 5.16 2.55 8.07s-.93 3.95-4.68 4.78c-3.74.83-5.39-.62-5.6-1.87s.31-5.8.92-8.23c.19-.8.47-1.29.76-1.62-3.04.55-6.84.77-9.5.77h-.3c.64.43 1.34 1.16 1.78 2.5 1.06 3.16 1.22 5.54 1.43 7.41s-2.29 2.5-4.79 2.71-5.41-.62-5.83-1.67c-.41-1.04.27-5.37.7-7.62.26-1.37 1.65-2.55 2.73-3.27-2.82.06-5.81.16-8.87.21.81.87 1.61 1.95 1.8 2.99.42 2.24 1.35 5.62 1.15 7.07-.22 1.45-.84 1.87-4.79 2.08-3.96.21-5.29-.41-5.71-1.24-.42-.84.3-5.83.8-7.89.27-1.1 1.09-2.19 1.85-3-2.47-.02-4.93-.12-7.32-.32.59 1.63 3.27 4.42 2.56 8.91-.4 2.49-1.57 3.53-6.97 3.54-3.12.01-4.56-2.08-4.57-3.53-.02-3.99 1.67-6.78 2.56-9.63-3-.34-4.82-.58-6.3-1.2.21 1.35 1.01 4.9 1.45 8.53.28 2.29-.83 3.54-3.54 3.54-2.7 0-4.37-1.45-4.37-2.7 0-3.33 4.89-9.52 5.29-9.79.04-.03.09-.07.14-.1-.28-.17-.57-.37-.85-.59-2.5-1.94-5.55-4.7-7.17-11.74-1.63-7.04-1.05-11.33-6.47-14.58-5.41-3.25-15.17 4.52-20.05 4.01-5.43-.57-12.3-11.43-12.74-16.55-.52-5.98 5.32-3.2 8.64-10.77 2.11-4.82.01-10.85.01-24.382 0-13.538 4.66-20.431 7.6-27.074 2.14-4.835-.83-8.43 2.95-21.065 3.22-10.79 6.13-14.804 6.13-14.804s-5.19 4.273-8.25 14.342c-2.7 8.911-1.87 13.404-4.04 20.443s-5.44 11.676-7.07 22.505c-1.62 10.83 1.1 24.035-1.62 28.405-1.84 2.95-7.92-.24-8.71-11.1-.68-9.328-1.89-27.765-.27-38.594 1.63-10.83 2.59-6.803 8.32-26.716C170.32 14.781 199.76.493 234.91.014c30.71-.419 41.93 9.528 51.96 19 10.46 9.88 17.76 23.698 19.98 32.576s4.16 12.562 5.55 20.054c1.39 7.489.64 18.368-.72 23.778-1.5 6.018-4.46 16.548-8.44 17.638m-84.23-23.841c-3.96-6.242-14.58-7.322-22.69-7.699-8.95-.417-13.85 2.338-14.78 9.156-.75 5.497.21 13.734 2.08 19.764 1.63 5.25 8.12 12.28 13.74 11.44 4.52-.66 14.15-7.87 19.77-14.35 3.37-3.88 3.78-15.305 1.88-18.311m12.49 16.851c-2.09.15-5.21 7.07-6.66 15.81-.96 5.76-4.78 13.8-3.96 18.73.55 3.31 3.62 3.78 5.41.21 1.46-2.92 2.29-5.62 4.37-5.62s6.68 12.19 9.37 11.86c3.11-.38 6.93-5.2 6.45-11.24-.42-5.2-2.5-10.4-5.62-15.81s-7.3-14.08-9.36-13.94m50.57-16.851c-3.12-4.163-8.53-7.699-19.15-7.074-8.78.516-17.52 4.062-18.31 9.986-.83 6.242.94 9.499 4.37 13.729 3.54 4.37 13.53 12.9 19.98 13.32s12.07-1.04 12.9-7.49c.84-6.45 3.33-18.311.21-22.471m-14.36 101.33c5-5 4.17-13.53 6.25-24.35s5.82-14.15 8.32-17.89c2.5-3.75 8.46-3.24 9.16-1.67.83 1.88-1.71 14.51-4.17 22.68-3.74 12.49-3.95 17.48-4.16 23.93-.17 5.51-8.95 9.78-13.53 14.15-4.58 4.36-8.74 12.48-14.36 14.14-5.62 1.67-13.53-1.24-22.06-1.04-8.53.21-17.07 2.29-21.64.62-4.58-1.66-9.79-9.36-15.62-14.56-5.82-5.2-12.69-8.32-14.77-13.31-2.08-5 0-11.03-.42-18.73-.41-7.7-2.49-12.48-4.58-17.06-2.08-4.58-.69-7.88 2.71-9.15 4.99-1.87 8.53 2.29 11.03 10.19 2.61 8.25 4.92 13.1 5.41 19.98.63 8.73 1.88 10.4 4.79 13.52 1.66 1.78 4.72 2.84 7.93 3.73-.59-1.56-1.12-3.59-.85-7.27.13-1.88 1.66-2.5 4.99-2.71 3.33-.2 5.54.63 5.62 2.3.28 5.48-1.06 7.83-2.02 9.67 1.8.28 4.44.44 7.48.53-1.13-2.26-2.33-4.86-2.34-9.17 0-2.46 1.88-2.08 5-2.28 3.12-.21 6.33-.25 6.45 1.87.24 4.28-1.22 7.06-2.56 9.67 2.25.01 4.53-.01 6.71-.04-.91-2.82-1.71-6.46-1.24-9.63.19-1.26 2.92-1.67 5.42-1.87 2.49-.21 5.53 1.02 5.62 2.49.18 3.24-.8 6.38-1.93 8.85 1.5-.04 2.8-.08 3.79-.11.95-.03 1.89-.09 2.84-.2-1.07-2.02-2.12-4.58-2-6.66.09-1.68 3.75-5.21 6.66-5 2.32.17 4.81.66 4.94 1.91.27 2.63-.56 5.5-1.57 7.89 3.26-1.22 6.27-3.01 8.7-5.42m65.95 86.76s.32 4.31-9.4 7.9c-5.72 2.12-6.81 3.23-37.28-7.7-9.18-3.29-59.19-17.59-99.77-41.4-58.88-34.54-75.64-54.9-76.64-54.1s12.06 22.68 80.35 59.3c54.06 28.98 72.92 32.25 95.23 40.15 27.36 9.7 30.16 9.9 33.88 14.36 4.06 4.86 2.48 15.4 2.48 15.4s-49.61-14.09-86.76-29.76c-41.51-17.49-79.94-36.61-116.92-64.28-36.975-27.68-74.694-61.86-99.154-102.99C-2.22 77.358.293 65.494.053 59.671c-.57-13.748 3.598-6.987 6.198-2.079 1.652 3.121 12.42 18.962 38.627 49.727 28.693 33.68 64.862 63.67 103.28 89.26 35.28 23.49 73.7 40.59 110.76 55.66 41.02 16.69 74.74 25.07 74.74 25.07zm-284.49 11.44c8.753 0 14.154 6.86 14.154 15.18 0 13.95-12.428 13.21-12.694 15.61-.267 2.4 3.628 4.09 9.78 3.12 4.18-.66 7.978-7.06 9.576-5.2s-8.722 14.56-18.524 14.56c-10.615 0-20.815-9.15-20.815-22.26-.001-14.98 8.118-21.01 18.523-21.01m22.479-.21c7.242 0 8.3 2.53 10.408 9.36 1.968 6.39 6.334 7.96 7.284 7.91s-2.657-2.83-4.58-8.12c-1.665-4.57-4.092-9.98 5.205-9.98 8.958 0 8.915 3.82 10.194 7.28 2.09 5.61 7.69 9.83 8.54 9.78.84-.05-4.37-5.41-5.62-10.2-.96-3.67-.85-6.66 4.37-6.66 4.37 0 7.07 5 10.82 11.66 3.27 5.81 6.61 18.97.21 19.55-9.46.87-37.635 1.7-41.418-.62-6.69-4.11-9.158-9.36-11.032-17.06-2.278-9.36-2.023-12.9 5.619-12.9m32.261-15.19c-1.04 1.25-1.25 8.11-9.366 8.11s-13.943-5.82-13.943-16.22 7.284-15.82 17.064-15.82c9.785 0 17.695 4.37 25.395 13.32 7.63 8.87 10.31 19.62 14.15 22.89 5.56 4.72 13.12 3.49 13.65 4.56.54 1.06-6.99 4.59-6.87 14.66.1 8.75.71 18.23 3.42 22.81 2.71 4.57 5.83 7.9 6.87 7.69s1.24-7.28 7.91-7.28c7.28 0 11.03 4.78 11.03 14.77s-7.91 12.7-18.11 12.7c-10.19 0-18.94-6.24-22.27-17.48s-6.45-26.43-10.61-37.45c-4.17-11.03-11.45-23.3-13.53-25.39-2.08-2.08-3.75-3.12-4.79-1.87m46.3 12.13c-10.42-.64-11.37-8.17-11.37-8.17s20.12-5.94 48.1-15.58c6.87 3.89 10.51 5.83 17.92 8.98-10.28 3.47-16.68 5.8-19.78 6.8-24.08 7.8-28.54 8.35-34.87 7.97m82.14-2.49c-37.74 15.44-83.07 28.23-83.07 28.23s-1.58-10.53 2.5-15.4c4.37-5.2 11.66-6.44 34.13-14.36 8.38-2.94 15.28-5.24 24.7-8.47 10.35 5.24 15.3 7.32 21.74 10m77.35 45.08c6.62 0 6.81 7.07 7.85 7.28 1.03.21 4.13-3.12 6.82-7.69 2.68-4.58 4.13-15 3.72-23.74s-5.72-11.14-5.31-12.73c.39-1.6 6.68-2.53 11.51-6.56 5.15-4.3 6.67-13.02 14.25-21.89 7.64-8.95 15.49-13.32 25.2-13.32 9.7 0 16.94 5.42 16.94 15.82s-5.79 16.22-13.85 16.22c-8.05 0-8.26-6.86-9.29-8.11s-2.69-.21-4.75 1.87c-2.07 2.09-9.29 14.36-13.43 25.39-4.13 11.02-7.23 26.21-10.54 37.45-3.3 11.23-11.98 17.48-22.1 17.48s-17.97-2.71-17.97-12.7 3.72-14.77 10.95-14.77m54.33-40.16c5.18 0 5.29 2.99 4.34 6.66-1.24 4.79-5.58 10.2-5.58 10.2s6.4-4.17 8.47-9.78c1.27-3.46 1.23-7.28 10.12-7.28 9.23 0 6.82 5.41 5.17 9.98-1.91 5.29-4.55 8.12-4.55 8.12s5.27-1.52 7.23-7.91c2.09-6.83 3.14-9.36 10.33-9.36 7.58 0 7.84 3.54 5.58 12.9-1.87 7.7-4.32 12.95-10.96 17.06-3.75 2.32-31.72 1.49-41.1.62-6.35-.58-3.03-13.74.21-19.55 3.71-6.66 6.4-11.66 10.74-11.66m46.68 34.75c6.17.51 9.91-1.32 9.71-3.12s-12.6-1.66-12.6-15.61c0-8.32 5.36-15.18 14.05-15.18 10.33 0 18.38 6.03 18.38 21.01 0 13.11-10.12 22.53-20.65 22.26-15.73-.39-20.39-12.96-18.39-14.56s3.96 4.75 9.5 5.2"/></svg>
                ` }
        },
        {
            id: 'astral_rare_essence_glow',
            name: 'Astral Essence',
            category: 'GLOW',
            rarity: 'Rare',
            baseDropRate: 4.0,
            exchangePrice: 100,
            visualConfig: {
                primaryColor: '#a855f7',
                isAnimated: false,
                svgCode: `
                     <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="45" fill="#a855f7" fill-opacity=".1"/><circle cx="50" cy="50" r="35" fill="#d946ef" fill-opacity=".15"/><g fill="#fdf4ff" opacity=".6"><circle cx="20" cy="50" r="2"/><circle cx="80" cy="50" r="2.5"/><circle cx="50" cy="20" r="1.5"/><circle cx="50" cy="80" r="2"/><path d="M30 30q5-5 10 0m30 40q-5 5-10 0" fill="none" stroke="#d946ef"/></g><circle cx="50" cy="50" r="20" fill="none" stroke="#a855f7" stroke-width="2" stroke-dasharray="5 5" opacity=".8"/></svg>
                 `
            }
        },
        {
            id: 'astral_rare_katana_border',
            name: 'Quick Draw (5d)',
            category: 'BORDER',
            rarity: 'Rare',
            baseDropRate: 4.0,
            exchangePrice: 180,
            expiresInDays: 5,
            visualConfig: { primaryColor: '#94a3b8', animationType: 'pulseCircuit', isAnimated: true }
        },
        {
            id: 'astral_rare_chaser_border',
            name: 'Triple Kunai (5d)',
            category: 'BORDER',
            rarity: 'Rare',
            baseDropRate: 2.5,
            exchangePrice: 180,
            expiresInDays: 5,
            visualConfig: { primaryColor: '#3b82f6', animationType: 'tripleChaser', isAnimated: true }
        },

        // ==========================================
        // ⚪️ EVENT TOKENS (59% Total) - Exchange Currency
        // ==========================================
        {
            id: 'astral_pt_50', name: '50 Astral Fragment', category: 'EVENT_POINT', rarity: 'Mythic', baseDropRate: 2.5, rewardAmount: 50, visualConfig: {
                svgCode: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#a855f7" opacity=".15"/><circle cx="50" cy="50" r="40" fill="#a855f7" opacity=".25"/><g fill="#581c87"><rect x="20" y="20" width="60" height="60" rx="8"/><rect x="20" y="20" width="60" height="60" rx="8" transform="rotate(45 50 50)"/></g><g fill="#a855f7"><rect x="26" y="26" width="48" height="48" rx="6"/><rect x="26" y="26" width="48" height="48" rx="6" transform="rotate(45 50 50)"/></g><g fill="#d946ef"><rect x="34" y="34" width="32" height="32" rx="4"/><rect x="34" y="34" width="32" height="32" rx="4" transform="rotate(45 50 50)"/></g><circle cx="50" cy="50" r="16" fill="#fdf4ff"/><circle cx="50" cy="50" r="10" fill="#fbcfe8"/><path d="m50 36 4 14-4 14-4-14Z" fill="#581c87"/><circle cx="45" cy="45" r="3" fill="#fff"/><circle cx="54" cy="54" r="1.5" fill="#fff" opacity=".8"/></svg>
            `, primaryColor: '#a855f7'
            }
        },
        {
            id: 'astral_pt_20', name: '20 Astral Fragment', category: 'EVENT_POINT', rarity: 'Mythic', baseDropRate: 5.0, rewardAmount: 20, visualConfig: {
                svgCode: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#a855f7" opacity=".15"/><circle cx="50" cy="50" r="40" fill="#a855f7" opacity=".25"/><g fill="#581c87"><rect x="20" y="20" width="60" height="60" rx="8"/><rect x="20" y="20" width="60" height="60" rx="8" transform="rotate(45 50 50)"/></g><g fill="#a855f7"><rect x="26" y="26" width="48" height="48" rx="6"/><rect x="26" y="26" width="48" height="48" rx="6" transform="rotate(45 50 50)"/></g><g fill="#d946ef"><rect x="34" y="34" width="32" height="32" rx="4"/><rect x="34" y="34" width="32" height="32" rx="4" transform="rotate(45 50 50)"/></g><circle cx="50" cy="50" r="16" fill="#fdf4ff"/><circle cx="50" cy="50" r="10" fill="#fbcfe8"/><path d="m50 36 4 14-4 14-4-14Z" fill="#581c87"/><circle cx="45" cy="45" r="3" fill="#fff"/><circle cx="54" cy="54" r="1.5" fill="#fff" opacity=".8"/></svg>
            `, primaryColor: '#a855f7'
            }
        },
        {
            id: 'astral_pt_10', name: '10 Astral Fragment', category: 'EVENT_POINT', rarity: 'Mythic', baseDropRate: 10.0, rewardAmount: 10, visualConfig: {
                svgCode: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#a855f7" opacity=".15"/><circle cx="50" cy="50" r="40" fill="#a855f7" opacity=".25"/><g fill="#581c87"><rect x="20" y="20" width="60" height="60" rx="8"/><rect x="20" y="20" width="60" height="60" rx="8" transform="rotate(45 50 50)"/></g><g fill="#a855f7"><rect x="26" y="26" width="48" height="48" rx="6"/><rect x="26" y="26" width="48" height="48" rx="6" transform="rotate(45 50 50)"/></g><g fill="#d946ef"><rect x="34" y="34" width="32" height="32" rx="4"/><rect x="34" y="34" width="32" height="32" rx="4" transform="rotate(45 50 50)"/></g><circle cx="50" cy="50" r="16" fill="#fdf4ff"/><circle cx="50" cy="50" r="10" fill="#fbcfe8"/><path d="m50 36 4 14-4 14-4-14Z" fill="#581c87"/><circle cx="45" cy="45" r="3" fill="#fff"/><circle cx="54" cy="54" r="1.5" fill="#fff" opacity=".8"/></svg>
            `, primaryColor: '#a855f7'
            }
        },
        {
            id: 'astral_pt_5', name: '5 Astral Fragment', category: 'EVENT_POINT', rarity: 'Mythic', baseDropRate: 15.0, rewardAmount: 5, visualConfig: {
                svgCode: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#a855f7" opacity=".15"/><circle cx="50" cy="50" r="40" fill="#a855f7" opacity=".25"/><g fill="#581c87"><rect x="20" y="20" width="60" height="60" rx="8"/><rect x="20" y="20" width="60" height="60" rx="8" transform="rotate(45 50 50)"/></g><g fill="#a855f7"><rect x="26" y="26" width="48" height="48" rx="6"/><rect x="26" y="26" width="48" height="48" rx="6" transform="rotate(45 50 50)"/></g><g fill="#d946ef"><rect x="34" y="34" width="32" height="32" rx="4"/><rect x="34" y="34" width="32" height="32" rx="4" transform="rotate(45 50 50)"/></g><circle cx="50" cy="50" r="16" fill="#fdf4ff"/><circle cx="50" cy="50" r="10" fill="#fbcfe8"/><path d="m50 36 4 14-4 14-4-14Z" fill="#581c87"/><circle cx="45" cy="45" r="3" fill="#fff"/><circle cx="54" cy="54" r="1.5" fill="#fff" opacity=".8"/></svg>
            `, primaryColor: '#a855f7'
            }
        },
        {
            id: 'astral_pt_2', name: '2 Astral Fragment', category: 'EVENT_POINT', rarity: 'Mythic', baseDropRate: 20.0, rewardAmount: 2, visualConfig: {
                svgCode: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#a855f7" opacity=".15"/><circle cx="50" cy="50" r="40" fill="#a855f7" opacity=".25"/><g fill="#581c87"><rect x="20" y="20" width="60" height="60" rx="8"/><rect x="20" y="20" width="60" height="60" rx="8" transform="rotate(45 50 50)"/></g><g fill="#a855f7"><rect x="26" y="26" width="48" height="48" rx="6"/><rect x="26" y="26" width="48" height="48" rx="6" transform="rotate(45 50 50)"/></g><g fill="#d946ef"><rect x="34" y="34" width="32" height="32" rx="4"/><rect x="34" y="34" width="32" height="32" rx="4" transform="rotate(45 50 50)"/></g><circle cx="50" cy="50" r="16" fill="#fdf4ff"/><circle cx="50" cy="50" r="10" fill="#fbcfe8"/><path d="m50 36 4 14-4 14-4-14Z" fill="#581c87"/><circle cx="45" cy="45" r="3" fill="#fff"/><circle cx="54" cy="54" r="1.5" fill="#fff" opacity=".8"/></svg>
            `, primaryColor: '#a855f7'
            }
        },
        {
            id: 'astral_pt_1', name: '1 Astral Fragment', category: 'EVENT_POINT', rarity: 'Mythic', baseDropRate: 20.0, rewardAmount: 1, visualConfig: {
                svgCode: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#a855f7" opacity=".15"/><circle cx="50" cy="50" r="40" fill="#a855f7" opacity=".25"/><g fill="#581c87"><rect x="20" y="20" width="60" height="60" rx="8"/><rect x="20" y="20" width="60" height="60" rx="8" transform="rotate(45 50 50)"/></g><g fill="#a855f7"><rect x="26" y="26" width="48" height="48" rx="6"/><rect x="26" y="26" width="48" height="48" rx="6" transform="rotate(45 50 50)"/></g><g fill="#d946ef"><rect x="34" y="34" width="32" height="32" rx="4"/><rect x="34" y="34" width="32" height="32" rx="4" transform="rotate(45 50 50)"/></g><circle cx="50" cy="50" r="16" fill="#fdf4ff"/><circle cx="50" cy="50" r="10" fill="#fbcfe8"/><path d="m50 36 4 14-4 14-4-14Z" fill="#581c87"/><circle cx="45" cy="45" r="3" fill="#fff"/><circle cx="54" cy="54" r="1.5" fill="#fff" opacity=".8"/></svg>
            `, primaryColor: '#a855f7'
            }
        },
    ]
};

// ⚙️ 2. EVENT CONFIGURATOR (This matches your /events/active route logic)
const EVENT_CONFIG = {
    'astral_awakening_01': { gachaType: 'GRID' }
};

export async function GET(req) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const deviceId = searchParams.get('deviceId');
        const eventId = searchParams.get('eventId') || 'eid_al_fitr_2026';

        const pool = GACHA_POOLS[eventId] || [];
        const config = EVENT_CONFIG[eventId];

        if (!pool.length || !config) {
            return NextResponse.json({ error: 'Event not found' }, { status: 404 });
        }

        let ownedIds = [];
        let stats = { pityCount: 0, eventPoints: 0 };

        if (deviceId) {
            const user = await MobileUser.findOne({ deviceId }).lean();
            if (user) {
                ownedIds = (user.inventory || []).map(i => i.itemId);

                // ⚡️ FIXED: Safely fetch from Map by eventId
                stats.pityCount = user.gachaPityCounters?.[eventId] || 0;
                stats.eventPoints = user.eventPoints?.[eventId] || 0;
            }
        }

        return NextResponse.json({
            success: true,
            pool,
            ownedIds,
            ...stats
        });
    } catch (error) {
        console.error("GET Gacha Error:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        await connectDB();
        const { deviceId, pullType, eventId, itemId } = await req.json();

        if (!deviceId || !pullType || !eventId) {
            return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
        }

        const user = await MobileUser.findOne({ deviceId });
        if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const pool = GACHA_POOLS[eventId];
        const config = EVENT_CONFIG[eventId];

        if (!pool || !config) return NextResponse.json({ error: 'Event details not found' }, { status: 404 });

        // ⚡️ INITIALIZE MONGOOSE MAPS IF MISSING
        if (!user.gachaPityCounters) user.gachaPityCounters = new Map();
        if (!user.eventPoints) user.eventPoints = new Map();

        // ==========================================
        // 🔄 BRANCH A: POINT EXCHANGE LOGIC
        // ==========================================
        if (pullType === 'exchange') {
            if (!itemId) return NextResponse.json({ error: 'Item ID required for exchange' }, { status: 400 });

            const targetItem = pool.find(i => i.id === itemId);
            if (!targetItem) return NextResponse.json({ error: 'Item not found in this event' }, { status: 404 });

            const price = targetItem.exchangePrice || 0;
            const currentPoints = user.eventPoints.get(eventId) || 0;

            if (currentPoints < price) {
                return NextResponse.json({ error: 'Insufficient event tokens.' }, { status: 400 });
            }

            // Check if already owned (for non-consumables)
            const isOwned = user.inventory.some(i => i.itemId === itemId);
            if (isOwned && !['CONSUMABLE', 'EVENT_POINT'].includes(targetItem.category)) {
                return NextResponse.json({ error: 'Artifact already acquired.' }, { status: 400 });
            }

            // Deduct Points
            user.eventPoints.set(eventId, currentPoints - price);

            // ⚡️ FIXED: Safely apply rewards based on category (Don't push OC into inventory arrays)
            if (targetItem.category === 'CONSUMABLE') {
                user.coins += targetItem.rewardAmount;
            } else if (targetItem.category === 'EVENT_POINT') {
                user.eventPoints.set(eventId, user.eventPoints.get(eventId) + targetItem.rewardAmount);
            } else {
                let expiryDate = null;
                if (targetItem.expiresInDays) {
                    expiryDate = new Date();
                    expiryDate.setDate(expiryDate.getDate() + targetItem.expiresInDays);
                }

                user.inventory.push({
                    itemId: targetItem.id,
                    name: targetItem.name,
                    category: targetItem.category,
                    rarity: targetItem.rarity || 'Common',
                    visualConfig: targetItem.visualConfig,
                    acquiredAt: new Date(),
                    expiresAt: expiryDate
                });
            }

            await user.save();

            return NextResponse.json({
                success: true,
                eventPoints: user.eventPoints.get(eventId),
                inventory: user.inventory,
                itemGained: targetItem
            });
        }

        // ==========================================
        // 🎲 BRANCH B: GACHA PULL LOGIC (1x / 11x)
        // ==========================================
        const isRoulette = config.gachaType === 'ROULETTE';
        const pulls = pullType === '11x' ? 11 : 1;
        let cost
        if (isRoulette) {
            cost = pullType === '11x' ? 500 : 50;
        } else {
            cost = pullType === '11x' ? 250 : 25;
        }
        if ((user.coins || 0) < cost) {
            return NextResponse.json({ error: 'Insufficient OC for this summon.' }, { status: 400 });
        }

        user.coins -= cost;
        let rewardsGained = [];
        let currentInventoryIds = user.inventory?.map(i => i.itemId) || [];
        let mythicPulledInSession = false;
        let currentPity = user.gachaPityCounters.get(eventId) || 0;
        let currentPoints = user.eventPoints.get(eventId) || 0;

        for (let i = 0; i < pulls; i++) {
            if (isRoulette) currentPity += 1;

            // ⚡️ We filter out owned non-consumables here, so true duplicates are impossible
            let availableItems = pool.filter(item =>
                item.category === 'CONSUMABLE' ||
                item.category === 'EVENT_POINT' ||
                !currentInventoryIds.includes(item.id)
            );

            if (mythicPulledInSession) {
                availableItems = availableItems.filter(item => item.rarity?.toUpperCase() !== 'MYTHIC');
            }

            let selectedItem = null;
            let isPityTriggered = false;
            const mythicItems = availableItems.filter(i => i.rarity?.toUpperCase() === 'MYTHIC');

            // Pity Trigger
            if (isRoulette && currentPity >= config.pityThreshold && mythicItems.length > 0) {
                let mythicWeight = mythicItems.reduce((sum, item) => sum + item.baseDropRate, 0);
                let mythicRoll = Math.random() * mythicWeight;
                for (const item of mythicItems) {
                    mythicRoll -= item.baseDropRate;
                    if (mythicRoll <= 0) {
                        selectedItem = item;
                        break;
                    }
                }
                currentPity = 0;
                isPityTriggered = true;
                mythicPulledInSession = true;
            }

            // Normal RNG
            if (!isPityTriggered) {
                let totalWeight = availableItems.reduce((sum, item) => sum + item.baseDropRate, 0);
                let roll = Math.random() * totalWeight;
                for (const item of availableItems) {
                    roll -= item.baseDropRate;
                    if (roll <= 0) {
                        selectedItem = item;
                        break;
                    }
                }
            }

            if (!selectedItem) {
                selectedItem = pool.find(i => i.category === 'CONSUMABLE' || i.category === 'EVENT_POINT') || pool[pool.length - 1];
            }

            if (isRoulette && selectedItem.rarity?.toUpperCase() === 'MYTHIC') {
                currentPity = 0;
                mythicPulledInSession = true;
            }

            // ⚡️ FIXED: Consumables and Tokens are NO LONGER marked as "Duplicates"
            let isDuplicate = false;
            let refundAmount = 0;

            if (selectedItem.category === 'CONSUMABLE') {
                user.coins += selectedItem.rewardAmount;
            } else if (selectedItem.category === 'EVENT_POINT') {
                currentPoints += selectedItem.rewardAmount;
            } else {
                // Permanent items pushed safely since they passed the filter above
                currentInventoryIds.push(selectedItem.id);

                let expiryDate = selectedItem.expiresInDays ? new Date(Date.now() + selectedItem.expiresInDays * 24 * 60 * 60 * 1000) : null;
                user.inventory.push({
                    itemId: selectedItem.id,
                    name: selectedItem.name,
                    category: selectedItem.category,
                    rarity: selectedItem.rarity || 'Common',
                    visualConfig: selectedItem.visualConfig,
                    acquiredAt: new Date(),
                    expiresAt: expiryDate
                });
            }

            rewardsGained.push({ ...selectedItem, isDuplicate, refundAmount });
        }

        user.gachaPityCounters.set(eventId, currentPity);
        user.eventPoints.set(eventId, currentPoints);

        await user.save();

        return NextResponse.json({
            success: true,
            newBalance: user.coins,
            inventory: user.inventory,
            rewards: rewardsGained,
            pityCount: currentPity,
            eventPoints: currentPoints
        });

    } catch (error) {
        console.error("Gacha POST Error:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
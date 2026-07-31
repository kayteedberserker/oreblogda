import connectDB from '@/app/lib/mongodb';
import MobileUser from '@/app/models/MobileUserModel';
import { NextResponse } from 'next/server';

const GACHA_POOLS = {
    // 🌌 1. ASTRAL AWAKENING (Copyright-Safe Anime Theme - Grid Spark System)
    'ninja_art': [
        // ==========================================
        // 👑 MYTHIC (1% Total) - Animated Lottie
        // ==========================================
        // {
        //     id: 'mythic_style_amaterasu',
        //     name: "Mythic Style: Amaterasu",
        //     category: 'avatar_vfx',
        //     keepBaseRate: true,
        //     rarity: 'Mythic',
        //     baseDropRate: 0.1,
        //     url: 'https://res.cloudinary.com/donakg9he/image/upload/v1785242219/oreblogda/avatar_vfxs/mythic/vfx_ninpo_system_geminigeneratedimageqvw1wnqvw1wnqvw1.webp',
        //     exchangePrice: 800, // ⚡️ High weight
        //     visualConfig: {
        //         zoom: 1.8,
        //         offsetY: -10,
        //     }
        // },

        // ==========================================
        // 🟡 LEGENDARY (6% Total) - Animated Lottie
        // ==========================================
        {
            id: 'ninpo_water_style',
            name: 'Water Style: Water Wheel ',
            category: 'avatar_vfx',
            rarity: 'Legendary',
            baseDropRate: 0.5,
            url: 'https://res.cloudinary.com/donakg9he/image/upload/v1785237208/oreblogda/avatar_vfxs/legendary/vfx_ninpo_system_chatgptimagejul282026121240pm.webp',
            exchangePrice: 500,
            visualConfig: {
                zoom: 1.35
            }
        },
        {
            id: 'ninpo_fire_style',
            name: 'Fire Style: Fire Wheel',
            category: 'avatar_vfx',
            rarity: 'Legendary',
            baseDropRate: 0.5,
            url: 'https://res.cloudinary.com/donakg9he/image/upload/v1785238193/oreblogda/avatar_vfxs/legendary/vfx_ninpo_system_geminigeneratedimagebxxp41bxxp41bxxp_6faa2e.webp',
            exchangePrice: 500, // ⚡️ The Ultimate Prize
            visualConfig: {
                zoom: 1.4,
            }
        },

        // ==========================================
        // 🟣 EPIC (9% Total) - Native Animations
        // ==========================================
        {
            id: 'ninpo_sand_style',
            name: 'Sand Style: Desert Wave ',
            category: 'avatar_vfx',
            rarity: 'Epic',
            url: "https://res.cloudinary.com/donakg9he/image/upload/v1785243912/oreblogda/avatar_vfxs/epic/vfx_ninpo_system_chatgptimagejul282026020433pm.webp",
            baseDropRate: 2.0,
            exchangePrice: 200,
            visualConfig: {
                zoom: 2,
                offsetY: -2,

            }
        },
        {
            id: 'ninpo_wind_style',
            name: 'Wind Style: Wind Scythe',
            category: 'avatar_vfx',
            rarity: 'Epic',
            baseDropRate: 2.0,
            url: "https://res.cloudinary.com/donakg9he/image/upload/v1785246066/oreblogda/avatar_vfxs/epic/vfx_ninpo_system_ada99f1865964ce1b9b1d3b7fe96535f.webp",
            exchangePrice: 200,
            visualConfig: {
                zoom: 1.4
            }
        },
        {
            id: 'ninpo_earth_style',
            name: 'Earth Style: Landslide',
            category: 'avatar_vfx',
            rarity: 'Epic',
            baseDropRate: 2.0,
            url: "https://res.cloudinary.com/donakg9he/image/upload/v1785247029/oreblogda/avatar_vfxs/epic/vfx_ninpo_system_chatgptimagejul282026025633pm.webp",
            exchangePrice: 200,
            visualConfig: {
                zoom: 1.4,
                offsetY: -1,

            }
        },
        // {
        //     id: 'ninpo_wood_style',
        //     name: 'Wood Style: Wood Shield',
        //     category: 'avatar_vfx',
        //     rarity: 'Epic',
        //     baseDropRate: 2.0,
        //     exchangePrice: 200,
        //     visualConfig: {
        //         url: "https://res.cloudinary.com/donakg9he/image/upload/v1785247814/oreblogda/avatar_vfxs/epic/vfx_ninpo_system_chatgptimagejul282026030957pm.webp",
        //         zoom: 2.3,
        //         offsetY: 0,

        //     }
        // },

        // ==========================================
        // ⚪️ EVENT TOKENS (59% Total) - Exchange Currency
        // ==========================================
        {
            id: 'chakra_pt_50', name: '50 Chakra Orbs', category: 'EVENT_POINT', rarity: 'Mythic', baseDropRate: 2.0, rewardAmount: 50, visualConfig: {
                svgCode: `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="15%" y1="10%" x2="85%" y2="90%"><stop offset="0%" stop-color="#f8fafc"/><stop offset="22%" stop-color="#94a3b8"/><stop offset="48%" stop-color="#e2e8f0"/><stop offset="72%" stop-color="#64748b"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient><linearGradient id="c" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#475569"/><stop offset="50%" stop-color="#0f172a"/><stop offset="100%" stop-color="#334155"/></linearGradient><filter id="d" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#020617" flood-opacity=".65"/></filter><radialGradient id="e" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#fff"/><stop offset="28%" stop-color="#dbeafe"/><stop offset="58%" stop-color="#7dd3fc"/><stop offset="82%" stop-color="#2563eb"/><stop offset="100%" stop-color="#172554"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="#38bdf8" opacity=".1"/><circle cx="50" cy="50" r="44" fill="#0f172a" opacity=".15"/><circle cx="50" cy="50" r="42" fill="url(#a)" filter="url(#b)"/><circle cx="50" cy="50" r="35.5" fill="url(#c)"/><circle cx="50" cy="50" r="31" fill="none" stroke="#cbd5e1" stroke-width="1.3" opacity=".55"/><path d="M50 17a33 33 0 0 1 19 6" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/><path d="M75 27a33 33 0 0 1 7 20" fill="none" stroke="#f97316" stroke-width="5" stroke-linecap="round"/><path d="M81 56a33 33 0 0 1-14 20" fill="none" stroke="#eab308" stroke-width="5" stroke-linecap="round"/><path d="M59 81a33 33 0 0 1-21-1" fill="none" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/><path d="M30 75a33 33 0 0 1-12-19" fill="none" stroke="#a78bfa" stroke-width="5" stroke-linecap="round"/><path d="M18 45a33 33 0 0 1 17-23" fill="none" stroke="#d6b17a" stroke-width="5" stroke-linecap="round"/><g filter="url(#d)"><circle cx="50" cy="16.5" r="2.2" fill="#e0f2fe"/><circle cx="80.5" cy="32" r="2.2" fill="#fed7aa"/><circle cx="78.5" cy="67.5" r="2.2" fill="#fde68a"/><circle cx="50" cy="83.5" r="2.2" fill="#bbf7d0"/><circle cx="20.5" cy="67.5" r="2.2" fill="#ddd6fe"/><circle cx="19.5" cy="32.5" r="2.2" fill="#fde7c3"/></g><circle cx="50" cy="50" r="20" fill="url(#e)" filter="url(#d)"/><path d="M37 52c2-10 10-16 20-14 9 2 13 11 9 19s-14 11-22 6c-6-4-7-11-3-16s12-5 16 0c3 4 1 9-3 11-5 2-9-1-9-5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".92"/><path d="m50 40 7 10-7 10-7-10Z" fill="#e0f2fe" opacity=".85"/><path d="m50 44 4 6-4 6-4-6Z" fill="#1d4ed8"/><circle cx="44" cy="43" r="3.2" fill="#fff" opacity=".9"/><circle cx="57" cy="58" r="1.7" fill="#fff" opacity=".75"/><g fill="#e2e8f0" opacity=".75"><circle cx="50" cy="11.5" r="1"/><circle cx="88.5" cy="50" r="1"/><circle cx="50" cy="88.5" r="1"/><circle cx="11.5" cy="50" r="1"/></g></svg>
                `,
                primaryColor: '#a855f7'
            }
        },
        {
            id: 'chakra_pt_20', name: '20 Chakra Orbs', category: 'EVENT_POINT', rarity: 'Mythic', baseDropRate: 6.0, rewardAmount: 20, visualConfig: {
                svgCode: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="15%" y1="10%" x2="85%" y2="90%"><stop offset="0%" stop-color="#f8fafc"/><stop offset="22%" stop-color="#94a3b8"/><stop offset="48%" stop-color="#e2e8f0"/><stop offset="72%" stop-color="#64748b"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient><linearGradient id="c" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#475569"/><stop offset="50%" stop-color="#0f172a"/><stop offset="100%" stop-color="#334155"/></linearGradient><filter id="d" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#020617" flood-opacity=".65"/></filter><radialGradient id="e" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#fff"/><stop offset="28%" stop-color="#dbeafe"/><stop offset="58%" stop-color="#7dd3fc"/><stop offset="82%" stop-color="#2563eb"/><stop offset="100%" stop-color="#172554"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="#38bdf8" opacity=".1"/><circle cx="50" cy="50" r="44" fill="#0f172a" opacity=".15"/><circle cx="50" cy="50" r="42" fill="url(#a)" filter="url(#b)"/><circle cx="50" cy="50" r="35.5" fill="url(#c)"/><circle cx="50" cy="50" r="31" fill="none" stroke="#cbd5e1" stroke-width="1.3" opacity=".55"/><path d="M50 17a33 33 0 0 1 19 6" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/><path d="M75 27a33 33 0 0 1 7 20" fill="none" stroke="#f97316" stroke-width="5" stroke-linecap="round"/><path d="M81 56a33 33 0 0 1-14 20" fill="none" stroke="#eab308" stroke-width="5" stroke-linecap="round"/><path d="M59 81a33 33 0 0 1-21-1" fill="none" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/><path d="M30 75a33 33 0 0 1-12-19" fill="none" stroke="#a78bfa" stroke-width="5" stroke-linecap="round"/><path d="M18 45a33 33 0 0 1 17-23" fill="none" stroke="#d6b17a" stroke-width="5" stroke-linecap="round"/><g filter="url(#d)"><circle cx="50" cy="16.5" r="2.2" fill="#e0f2fe"/><circle cx="80.5" cy="32" r="2.2" fill="#fed7aa"/><circle cx="78.5" cy="67.5" r="2.2" fill="#fde68a"/><circle cx="50" cy="83.5" r="2.2" fill="#bbf7d0"/><circle cx="20.5" cy="67.5" r="2.2" fill="#ddd6fe"/><circle cx="19.5" cy="32.5" r="2.2" fill="#fde7c3"/></g><circle cx="50" cy="50" r="20" fill="url(#e)" filter="url(#d)"/><path d="M37 52c2-10 10-16 20-14 9 2 13 11 9 19s-14 11-22 6c-6-4-7-11-3-16s12-5 16 0c3 4 1 9-3 11-5 2-9-1-9-5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".92"/><path d="m50 40 7 10-7 10-7-10Z" fill="#e0f2fe" opacity=".85"/><path d="m50 44 4 6-4 6-4-6Z" fill="#1d4ed8"/><circle cx="44" cy="43" r="3.2" fill="#fff" opacity=".9"/><circle cx="57" cy="58" r="1.7" fill="#fff" opacity=".75"/><g fill="#e2e8f0" opacity=".75"><circle cx="50" cy="11.5" r="1"/><circle cx="88.5" cy="50" r="1"/><circle cx="50" cy="88.5" r="1"/><circle cx="11.5" cy="50" r="1"/></g></svg>
                `,
                primaryColor: '#a855f7'
            }
        },
        {
            id: 'chakra_pt_10', name: '10 Chakra Orbs', category: 'EVENT_POINT', rarity: 'Mythic', baseDropRate: 12.5, rewardAmount: 10, visualConfig: {
                svgCode: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="15%" y1="10%" x2="85%" y2="90%"><stop offset="0%" stop-color="#f8fafc"/><stop offset="22%" stop-color="#94a3b8"/><stop offset="48%" stop-color="#e2e8f0"/><stop offset="72%" stop-color="#64748b"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient><linearGradient id="c" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#475569"/><stop offset="50%" stop-color="#0f172a"/><stop offset="100%" stop-color="#334155"/></linearGradient><filter id="d" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#020617" flood-opacity=".65"/></filter><radialGradient id="e" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#fff"/><stop offset="28%" stop-color="#dbeafe"/><stop offset="58%" stop-color="#7dd3fc"/><stop offset="82%" stop-color="#2563eb"/><stop offset="100%" stop-color="#172554"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="#38bdf8" opacity=".1"/><circle cx="50" cy="50" r="44" fill="#0f172a" opacity=".15"/><circle cx="50" cy="50" r="42" fill="url(#a)" filter="url(#b)"/><circle cx="50" cy="50" r="35.5" fill="url(#c)"/><circle cx="50" cy="50" r="31" fill="none" stroke="#cbd5e1" stroke-width="1.3" opacity=".55"/><path d="M50 17a33 33 0 0 1 19 6" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/><path d="M75 27a33 33 0 0 1 7 20" fill="none" stroke="#f97316" stroke-width="5" stroke-linecap="round"/><path d="M81 56a33 33 0 0 1-14 20" fill="none" stroke="#eab308" stroke-width="5" stroke-linecap="round"/><path d="M59 81a33 33 0 0 1-21-1" fill="none" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/><path d="M30 75a33 33 0 0 1-12-19" fill="none" stroke="#a78bfa" stroke-width="5" stroke-linecap="round"/><path d="M18 45a33 33 0 0 1 17-23" fill="none" stroke="#d6b17a" stroke-width="5" stroke-linecap="round"/><g filter="url(#d)"><circle cx="50" cy="16.5" r="2.2" fill="#e0f2fe"/><circle cx="80.5" cy="32" r="2.2" fill="#fed7aa"/><circle cx="78.5" cy="67.5" r="2.2" fill="#fde68a"/><circle cx="50" cy="83.5" r="2.2" fill="#bbf7d0"/><circle cx="20.5" cy="67.5" r="2.2" fill="#ddd6fe"/><circle cx="19.5" cy="32.5" r="2.2" fill="#fde7c3"/></g><circle cx="50" cy="50" r="20" fill="url(#e)" filter="url(#d)"/><path d="M37 52c2-10 10-16 20-14 9 2 13 11 9 19s-14 11-22 6c-6-4-7-11-3-16s12-5 16 0c3 4 1 9-3 11-5 2-9-1-9-5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".92"/><path d="m50 40 7 10-7 10-7-10Z" fill="#e0f2fe" opacity=".85"/><path d="m50 44 4 6-4 6-4-6Z" fill="#1d4ed8"/><circle cx="44" cy="43" r="3.2" fill="#fff" opacity=".9"/><circle cx="57" cy="58" r="1.7" fill="#fff" opacity=".75"/><g fill="#e2e8f0" opacity=".75"><circle cx="50" cy="11.5" r="1"/><circle cx="88.5" cy="50" r="1"/><circle cx="50" cy="88.5" r="1"/><circle cx="11.5" cy="50" r="1"/></g></svg>
                `,
                primaryColor: '#a855f7'
            }
        },
        {
            id: 'chakra_pt_5', name: '5 Chakra Orbs', category: 'EVENT_POINT', rarity: 'Mythic', baseDropRate: 19, rewardAmount: 5, visualConfig: {
                svgCode: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="15%" y1="10%" x2="85%" y2="90%"><stop offset="0%" stop-color="#f8fafc"/><stop offset="22%" stop-color="#94a3b8"/><stop offset="48%" stop-color="#e2e8f0"/><stop offset="72%" stop-color="#64748b"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient><linearGradient id="c" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#475569"/><stop offset="50%" stop-color="#0f172a"/><stop offset="100%" stop-color="#334155"/></linearGradient><filter id="d" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#020617" flood-opacity=".65"/></filter><radialGradient id="e" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#fff"/><stop offset="28%" stop-color="#dbeafe"/><stop offset="58%" stop-color="#7dd3fc"/><stop offset="82%" stop-color="#2563eb"/><stop offset="100%" stop-color="#172554"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="#38bdf8" opacity=".1"/><circle cx="50" cy="50" r="44" fill="#0f172a" opacity=".15"/><circle cx="50" cy="50" r="42" fill="url(#a)" filter="url(#b)"/><circle cx="50" cy="50" r="35.5" fill="url(#c)"/><circle cx="50" cy="50" r="31" fill="none" stroke="#cbd5e1" stroke-width="1.3" opacity=".55"/><path d="M50 17a33 33 0 0 1 19 6" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/><path d="M75 27a33 33 0 0 1 7 20" fill="none" stroke="#f97316" stroke-width="5" stroke-linecap="round"/><path d="M81 56a33 33 0 0 1-14 20" fill="none" stroke="#eab308" stroke-width="5" stroke-linecap="round"/><path d="M59 81a33 33 0 0 1-21-1" fill="none" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/><path d="M30 75a33 33 0 0 1-12-19" fill="none" stroke="#a78bfa" stroke-width="5" stroke-linecap="round"/><path d="M18 45a33 33 0 0 1 17-23" fill="none" stroke="#d6b17a" stroke-width="5" stroke-linecap="round"/><g filter="url(#d)"><circle cx="50" cy="16.5" r="2.2" fill="#e0f2fe"/><circle cx="80.5" cy="32" r="2.2" fill="#fed7aa"/><circle cx="78.5" cy="67.5" r="2.2" fill="#fde68a"/><circle cx="50" cy="83.5" r="2.2" fill="#bbf7d0"/><circle cx="20.5" cy="67.5" r="2.2" fill="#ddd6fe"/><circle cx="19.5" cy="32.5" r="2.2" fill="#fde7c3"/></g><circle cx="50" cy="50" r="20" fill="url(#e)" filter="url(#d)"/><path d="M37 52c2-10 10-16 20-14 9 2 13 11 9 19s-14 11-22 6c-6-4-7-11-3-16s12-5 16 0c3 4 1 9-3 11-5 2-9-1-9-5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".92"/><path d="m50 40 7 10-7 10-7-10Z" fill="#e0f2fe" opacity=".85"/><path d="m50 44 4 6-4 6-4-6Z" fill="#1d4ed8"/><circle cx="44" cy="43" r="3.2" fill="#fff" opacity=".9"/><circle cx="57" cy="58" r="1.7" fill="#fff" opacity=".75"/><g fill="#e2e8f0" opacity=".75"><circle cx="50" cy="11.5" r="1"/><circle cx="88.5" cy="50" r="1"/><circle cx="50" cy="88.5" r="1"/><circle cx="11.5" cy="50" r="1"/></g></svg>
                `,
                primaryColor: '#a855f7'
            }
        },
        {
            id: 'chakra_pt_2', name: '2 Chakra Orbs', category: 'EVENT_POINT', rarity: 'Mythic', baseDropRate: 26.4, rewardAmount: 2, visualConfig: {
                svgCode: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="15%" y1="10%" x2="85%" y2="90%"><stop offset="0%" stop-color="#f8fafc"/><stop offset="22%" stop-color="#94a3b8"/><stop offset="48%" stop-color="#e2e8f0"/><stop offset="72%" stop-color="#64748b"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient><linearGradient id="c" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#475569"/><stop offset="50%" stop-color="#0f172a"/><stop offset="100%" stop-color="#334155"/></linearGradient><filter id="d" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#020617" flood-opacity=".65"/></filter><radialGradient id="e" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#fff"/><stop offset="28%" stop-color="#dbeafe"/><stop offset="58%" stop-color="#7dd3fc"/><stop offset="82%" stop-color="#2563eb"/><stop offset="100%" stop-color="#172554"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="#38bdf8" opacity=".1"/><circle cx="50" cy="50" r="44" fill="#0f172a" opacity=".15"/><circle cx="50" cy="50" r="42" fill="url(#a)" filter="url(#b)"/><circle cx="50" cy="50" r="35.5" fill="url(#c)"/><circle cx="50" cy="50" r="31" fill="none" stroke="#cbd5e1" stroke-width="1.3" opacity=".55"/><path d="M50 17a33 33 0 0 1 19 6" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/><path d="M75 27a33 33 0 0 1 7 20" fill="none" stroke="#f97316" stroke-width="5" stroke-linecap="round"/><path d="M81 56a33 33 0 0 1-14 20" fill="none" stroke="#eab308" stroke-width="5" stroke-linecap="round"/><path d="M59 81a33 33 0 0 1-21-1" fill="none" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/><path d="M30 75a33 33 0 0 1-12-19" fill="none" stroke="#a78bfa" stroke-width="5" stroke-linecap="round"/><path d="M18 45a33 33 0 0 1 17-23" fill="none" stroke="#d6b17a" stroke-width="5" stroke-linecap="round"/><g filter="url(#d)"><circle cx="50" cy="16.5" r="2.2" fill="#e0f2fe"/><circle cx="80.5" cy="32" r="2.2" fill="#fed7aa"/><circle cx="78.5" cy="67.5" r="2.2" fill="#fde68a"/><circle cx="50" cy="83.5" r="2.2" fill="#bbf7d0"/><circle cx="20.5" cy="67.5" r="2.2" fill="#ddd6fe"/><circle cx="19.5" cy="32.5" r="2.2" fill="#fde7c3"/></g><circle cx="50" cy="50" r="20" fill="url(#e)" filter="url(#d)"/><path d="M37 52c2-10 10-16 20-14 9 2 13 11 9 19s-14 11-22 6c-6-4-7-11-3-16s12-5 16 0c3 4 1 9-3 11-5 2-9-1-9-5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".92"/><path d="m50 40 7 10-7 10-7-10Z" fill="#e0f2fe" opacity=".85"/><path d="m50 44 4 6-4 6-4-6Z" fill="#1d4ed8"/><circle cx="44" cy="43" r="3.2" fill="#fff" opacity=".9"/><circle cx="57" cy="58" r="1.7" fill="#fff" opacity=".75"/><g fill="#e2e8f0" opacity=".75"><circle cx="50" cy="11.5" r="1"/><circle cx="88.5" cy="50" r="1"/><circle cx="50" cy="88.5" r="1"/><circle cx="11.5" cy="50" r="1"/></g></svg>
                `,
                primaryColor: '#a855f7'
            }
        },
        {
            id: 'chakra_pt_1', name: '1 Chakra Orb', category: 'EVENT_POINT', rarity: 'Mythic', baseDropRate: 27.0, rewardAmount: 1, visualConfig: {
                svgCode: `
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="15%" y1="10%" x2="85%" y2="90%"><stop offset="0%" stop-color="#f8fafc"/><stop offset="22%" stop-color="#94a3b8"/><stop offset="48%" stop-color="#e2e8f0"/><stop offset="72%" stop-color="#64748b"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient><linearGradient id="c" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#475569"/><stop offset="50%" stop-color="#0f172a"/><stop offset="100%" stop-color="#334155"/></linearGradient><filter id="d" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#020617" flood-opacity=".65"/></filter><radialGradient id="e" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#fff"/><stop offset="28%" stop-color="#dbeafe"/><stop offset="58%" stop-color="#7dd3fc"/><stop offset="82%" stop-color="#2563eb"/><stop offset="100%" stop-color="#172554"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="#38bdf8" opacity=".1"/><circle cx="50" cy="50" r="44" fill="#0f172a" opacity=".15"/><circle cx="50" cy="50" r="42" fill="url(#a)" filter="url(#b)"/><circle cx="50" cy="50" r="35.5" fill="url(#c)"/><circle cx="50" cy="50" r="31" fill="none" stroke="#cbd5e1" stroke-width="1.3" opacity=".55"/><path d="M50 17a33 33 0 0 1 19 6" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/><path d="M75 27a33 33 0 0 1 7 20" fill="none" stroke="#f97316" stroke-width="5" stroke-linecap="round"/><path d="M81 56a33 33 0 0 1-14 20" fill="none" stroke="#eab308" stroke-width="5" stroke-linecap="round"/><path d="M59 81a33 33 0 0 1-21-1" fill="none" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/><path d="M30 75a33 33 0 0 1-12-19" fill="none" stroke="#a78bfa" stroke-width="5" stroke-linecap="round"/><path d="M18 45a33 33 0 0 1 17-23" fill="none" stroke="#d6b17a" stroke-width="5" stroke-linecap="round"/><g filter="url(#d)"><circle cx="50" cy="16.5" r="2.2" fill="#e0f2fe"/><circle cx="80.5" cy="32" r="2.2" fill="#fed7aa"/><circle cx="78.5" cy="67.5" r="2.2" fill="#fde68a"/><circle cx="50" cy="83.5" r="2.2" fill="#bbf7d0"/><circle cx="20.5" cy="67.5" r="2.2" fill="#ddd6fe"/><circle cx="19.5" cy="32.5" r="2.2" fill="#fde7c3"/></g><circle cx="50" cy="50" r="20" fill="url(#e)" filter="url(#d)"/><path d="M37 52c2-10 10-16 20-14 9 2 13 11 9 19s-14 11-22 6c-6-4-7-11-3-16s12-5 16 0c3 4 1 9-3 11-5 2-9-1-9-5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".92"/><path d="m50 40 7 10-7 10-7-10Z" fill="#e0f2fe" opacity=".85"/><path d="m50 44 4 6-4 6-4-6Z" fill="#1d4ed8"/><circle cx="44" cy="43" r="3.2" fill="#fff" opacity=".9"/><circle cx="57" cy="58" r="1.7" fill="#fff" opacity=".75"/><g fill="#e2e8f0" opacity=".75"><circle cx="50" cy="11.5" r="1"/><circle cx="88.5" cy="50" r="1"/><circle cx="50" cy="88.5" r="1"/><circle cx="11.5" cy="50" r="1"/></g></svg>
                `,
                primaryColor: '#a855f7'
            }
        },
    ],
    'gacha_400_cache': [
        // ==========================================
        // 👑 MYTHIC (1% Total) - Animated Lottie
        // ==========================================
        {
            id: 'pfp_spirited_away',
            name: "Ghost Face",
            category: 'AVATAR',
            keepBaseRate: true,
            rarity: 'Mythic',
            baseDropRate: 0.1,
            exchangePrice: 500, // ⚡️ High weight
            visualConfig: { lottieUrl: 'https://oreblogda.com/lottie/spiritaway_avatar.json', primaryColor: "#a855f7", zoom: 1.3 }
        },
        // ==========================================
        // 👑 LEGENDARY (1% Total) - Animated Lottie
        // ==========================================
        {
            id: '400_event_background',
            name: '400 SYNCHED: Comic Background',
            category: 'BACKGROUND',
            rarity: 'Legendary',
            baseDropRate: 1,
            url: 'https://res.cloudinary.com/donakg9he/image/upload/v1778967634/copy_of_copy_of_bg_pack_4004ventwm_400event.webp',
            exchangePrice: 400, // ⚡️ The Ultimate Prize
            visualConfig: {
                opacity: 0.8,
            }
        },
        {
            id: '400_event_watermark',
            name: '400 SYNCHED: Comic Watermark',
            category: 'WATERMARK',
            rarity: 'Legendary',
            baseDropRate: 1,
            url: 'https://res.cloudinary.com/donakg9he/image/upload/v1778622252/oreblogda/watermarks/legendary/watermark_400event_thesystem_400event2.webp',
            exchangePrice: 400, // ⚡️ The Ultimate Prize
            visualConfig: {
                opacity: 0.9,
                zoom: 1.75,
                rotation: '-7deg',
            }
        },
        {
            id: 'vfx_wave_legendary',
            name: "Wave",
            category: 'AVATAR_VFX',
            rarity: 'Legendary',
            baseDropRate: 1,
            exchangePrice: 400, // ⚡️ High weight
            visualConfig: { lottieUrl: 'https://oreblogda.com/lottie/wave_vfx.json', primaryColor: "#a855f7", zoom: 0.9, }
        },
        {
            id: 'event400_legendary_cyan_surge_border',
            name: 'Cyan Surge',
            category: 'BORDER',
            rarity: 'Legendary',
            baseDropRate: 1.5, // Lower drop rate for a milestone legendary
            exchangePrice: 300, // Themed to the 400 user milestone
            visualConfig: {
                primaryColor: '#00e5ff', // Bright Cyan from the "4" in your image
                secondaryColor: '#14b8a6', // Teal/Green from the bottom spikes
                animationType: 'clash', // Keeps that explosive comic book energy
                isAnimated: true
            }
        },
        {
            id: 'event400_epic_halftone_glow',
            name: 'Halftone Blast',
            category: 'GLOW',
            rarity: 'Epic',
            baseDropRate: 3.5,
            exchangePrice: 200,
            visualConfig: {
                // Custom SVG: An explosive starburst with floating comic "halftone" dots
                svgCode: `
                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 1L14.5 8.5L22 9.5L16 14.5L18 22L12 18L6 22L8 14.5L2 9.5L9.5 8.5L12 1Z" fill="none" stroke="#00e5ff" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
                    <circle cx="12" cy="12" r="5" fill="#14b8a6" opacity="0.4"/>
                    <circle cx="4" cy="4" r="1" fill="#0ea5e9"/>
                    <circle cx="20" cy="5" r="1.5" fill="#14b8a6"/>
                    <circle cx="19" cy="20" r="1" fill="#00e5ff"/>
                    <circle cx="5" cy="19" r="1.5" fill="#0ea5e9"/>
                    <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0 -4 0" fill="#00e5ff" opacity="0.8"/>
                </svg>
            `,
                primaryColor: '#0ea5e9', // Deep sky blue
                isAnimated: true,
                animationType: 'glitch' // Gives it that modern, slightly chaotic energy
            }
        },
        {
            id: 'event400_pt_50',
            name: '50 Sync Token',
            category: 'EVENT_POINT',
            rarity: 'Mythic',
            baseDropRate: 1,
            rewardAmount: 50,
            visualConfig: {
                primaryColor: '#3bf7db', // Cyan/Teal highlight
                svgCode: `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
  <defs>
    <linearGradient id="b" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#07519e"/>
      <stop offset="100%" stop-color="#02152e"/>
    </linearGradient>
    <linearGradient id="d" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#3bf7db"/>
      <stop offset="45%" stop-color="#21bbf3"/>
      <stop offset="100%" stop-color="#0b38b3"/>
    </linearGradient>
  </defs>

  <g transform="translate(500 500)">
    <path fill="#02152e" d="m0 0-480-380 60-40zm0 0 480-320-80-80zm0 0-450 380 90 40zm0 0 460 350-60 80zm0 0-520-80 20 100zm0 0 520-50-20-70z"/>
    <path fill="#21bbf3" d="m0 0-460-360 60-30z"/>
    <path fill="#3bf7db" d="m0 0 450-300-70-70z"/>
    <path fill="#21bbf3" d="m0 0-420 360 80 30z"/>
    <path fill="#3bf7db" d="m0 0 440 330-60 70z"/>
    <circle cx="-420" cy="-200" r="8" fill="#02152e"/>
    <circle cx="-400" cy="-220" r="12" fill="#21bbf3"/>
    <circle cx="430" cy="-180" r="10" fill="#02152e"/>
    <circle cx="450" cy="180" r="15" fill="#3bf7db"/>
    <circle cx="-380" cy="220" r="9" fill="#02152e"/>
  </g>

  <g transform="translate(515 520)">
    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="#000000" stroke="#000000" stroke-width="40" stroke-linejoin="round" opacity="0.2"/>
  </g>

  <g transform="translate(500 500)">
    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="#000000" stroke="#000" stroke-width="40" stroke-linejoin="round"/>
    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="none" stroke="#fff" stroke-width="20" stroke-linejoin="round"/>
    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="url(#b)"/>
    <path d="m-170-150-30-150m-50 210-120-150m540 90 30-150" fill="none" stroke="#3bf7db" stroke-width="8" stroke-linecap="round" opacity=".8"/>
  </g>

  <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" x="15" y="20" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">50</text>
  <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">50</text>
  <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="none" stroke="#fff" stroke-width="18" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">50</text>
  <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="url(#d)" transform="translate(500 540)skewX(-14)">50</text>

  <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" transform="translate(500 540)skewX(-14)">
    <path d="m-160-280 40 160M-220 10l40 50m170-320 20 110m170-110 20 110"/>
    <circle cx="-130" cy="-80" r="4" fill="#fff" stroke="none"/>
    <circle cx="20" cy="-110" r="4" fill="#fff" stroke="none"/>
    <circle cx="210" cy="-110" r="4" fill="#fff" stroke="none"/>
  </g>
</svg>

                `
            }
        },
        {
            id: 'event400_pt_20',
            name: '20 Sync Token',
            category: 'EVENT_POINT',
            rarity: 'Mythic',
            baseDropRate: 2,
            rewardAmount: 20,
            visualConfig: {
                primaryColor: '#21bbf3', // Sky Blue highlight
                svgCode: `
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
                <defs>
                    <linearGradient id="b" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#07519e"/>
                    <stop offset="100%" stop-color="#02152e"/>
                    </linearGradient>
                    <linearGradient id="d" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#3bf7db"/>
                    <stop offset="45%" stop-color="#21bbf3"/>
                    <stop offset="100%" stop-color="#0b38b3"/>
                    </linearGradient>
                </defs>

                <g transform="translate(500 500)">
                    <path fill="#02152e" d="m0 0-480-380 60-40zm0 0 480-320-80-80zm0 0-450 380 90 40zm0 0 460 350-60 80zm0 0-520-80 20 100zm0 0 520-50-20-70z"/>
                    <path fill="#21bbf3" d="m0 0-460-360 60-30z"/>
                    <path fill="#3bf7db" d="m0 0 450-300-70-70z"/>
                    <path fill="#21bbf3" d="m0 0-420 360 80 30z"/>
                    <path fill="#3bf7db" d="m0 0 440 330-60 70z"/>
                    <circle cx="-420" cy="-200" r="8" fill="#02152e"/>
                    <circle cx="-400" cy="-220" r="12" fill="#21bbf3"/>
                    <circle cx="430" cy="-180" r="10" fill="#02152e"/>
                    <circle cx="450" cy="180" r="15" fill="#3bf7db"/>
                    <circle cx="-380" cy="220" r="9" fill="#02152e"/>
                </g>

                <g transform="translate(515 520)">
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="#000000" stroke="#000000" stroke-width="40" stroke-linejoin="round" opacity="0.2"/>
                </g>

                <g transform="translate(500 500)">
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="#000000" stroke="#000" stroke-width="40" stroke-linejoin="round"/>
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="none" stroke="#fff" stroke-width="20" stroke-linejoin="round"/>
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="url(#b)"/>
                    <path d="m-170-150-30-150m-50 210-120-150m540 90 30-150" fill="none" stroke="#3bf7db" stroke-width="8" stroke-linecap="round" opacity=".8"/>
                </g>

                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" x="15" y="20" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">20</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">20</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="none" stroke="#fff" stroke-width="18" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">20</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="url(#d)" transform="translate(500 540)skewX(-14)">20</text>

                <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" transform="translate(500 540)skewX(-14)">
                    <path d="m-160-280 40 160M-220 10l40 50m170-320 20 110m170-110 20 110"/>
                    <circle cx="-130" cy="-80" r="4" fill="#fff" stroke="none"/>
                    <circle cx="20" cy="-110" r="4" fill="#fff" stroke="none"/>
                    <circle cx="210" cy="-110" r="4" fill="#fff" stroke="none"/>
                </g>
                </svg>
                `
            }
        },
        {
            id: 'event400_pt_10',
            name: '10 Sync Token',
            category: 'EVENT_POINT',
            rarity: 'Mythic',
            baseDropRate: 10.0,
            rewardAmount: 5,
            visualConfig: {
                primaryColor: '#21bbf3',
                svgCode: `
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
                <defs>
                    <linearGradient id="b" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#07519e"/>
                    <stop offset="100%" stop-color="#02152e"/>
                    </linearGradient>
                    <linearGradient id="d" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#3bf7db"/>
                    <stop offset="45%" stop-color="#21bbf3"/>
                    <stop offset="100%" stop-color="#0b38b3"/>
                    </linearGradient>
                </defs>

                <g transform="translate(500 500)">
                    <path fill="#02152e" d="m0 0-480-380 60-40zm0 0 480-320-80-80zm0 0-450 380 90 40zm0 0 460 350-60 80zm0 0-520-80 20 100zm0 0 520-50-20-70z"/>
                    <path fill="#21bbf3" d="m0 0-460-360 60-30z"/>
                    <path fill="#3bf7db" d="m0 0 450-300-70-70z"/>
                    <path fill="#21bbf3" d="m0 0-420 360 80 30z"/>
                    <path fill="#3bf7db" d="m0 0 440 330-60 70z"/>
                    <circle cx="-420" cy="-200" r="8" fill="#02152e"/>
                    <circle cx="-400" cy="-220" r="12" fill="#21bbf3"/>
                    <circle cx="430" cy="-180" r="10" fill="#02152e"/>
                    <circle cx="450" cy="180" r="15" fill="#3bf7db"/>
                    <circle cx="-380" cy="220" r="9" fill="#02152e"/>
                </g>

                <g transform="translate(515 520)">
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="#000000" stroke="#000000" stroke-width="40" stroke-linejoin="round" opacity="0.2"/>
                </g>

                <g transform="translate(500 500)">
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="#000000" stroke="#000" stroke-width="40" stroke-linejoin="round"/>
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="none" stroke="#fff" stroke-width="20" stroke-linejoin="round"/>
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="url(#b)"/>
                    <path d="m-170-150-30-150m-50 210-120-150m540 90 30-150" fill="none" stroke="#3bf7db" stroke-width="8" stroke-linecap="round" opacity=".8"/>
                </g>

                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" x="15" y="20" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">10</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">10</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="none" stroke="#fff" stroke-width="18" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">10</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="url(#d)" transform="translate(500 540)skewX(-14)">10</text>

                <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" transform="translate(500 540)skewX(-14)">
                    <path d="m-160-280 40 160M-220 10l40 50m170-320 20 110m170-110 20 110"/>
                    <circle cx="-130" cy="-80" r="4" fill="#fff" stroke="none"/>
                    <circle cx="20" cy="-110" r="4" fill="#fff" stroke="none"/>
                    <circle cx="210" cy="-110" r="4" fill="#fff" stroke="none"/>
                </g>
                </svg>
                `
            }
        },
        {
            id: 'event400_pt_5',
            name: '5 Sync Token',
            category: 'EVENT_POINT',
            rarity: 'Mythic',
            baseDropRate: 10.0,
            rewardAmount: 5,
            visualConfig: {
                primaryColor: '#0b38b3', // Darker base blue
                svgCode: `
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
                <defs>
                    <linearGradient id="b" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#07519e"/>
                    <stop offset="100%" stop-color="#02152e"/>
                    </linearGradient>
                    <linearGradient id="d" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#3bf7db"/>
                    <stop offset="45%" stop-color="#21bbf3"/>
                    <stop offset="100%" stop-color="#0b38b3"/>
                    </linearGradient>
                </defs>

                <g transform="translate(500 500)">
                    <path fill="#02152e" d="m0 0-480-380 60-40zm0 0 480-320-80-80zm0 0-450 380 90 40zm0 0 460 350-60 80zm0 0-520-80 20 100zm0 0 520-50-20-70z"/>
                    <path fill="#21bbf3" d="m0 0-460-360 60-30z"/>
                    <path fill="#3bf7db" d="m0 0 450-300-70-70z"/>
                    <path fill="#21bbf3" d="m0 0-420 360 80 30z"/>
                    <path fill="#3bf7db" d="m0 0 440 330-60 70z"/>
                    <circle cx="-420" cy="-200" r="8" fill="#02152e"/>
                    <circle cx="-400" cy="-220" r="12" fill="#21bbf3"/>
                    <circle cx="430" cy="-180" r="10" fill="#02152e"/>
                    <circle cx="450" cy="180" r="15" fill="#3bf7db"/>
                    <circle cx="-380" cy="220" r="9" fill="#02152e"/>
                </g>

                <g transform="translate(515 520)">
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="#000000" stroke="#000000" stroke-width="40" stroke-linejoin="round" opacity="0.2"/>
                </g>

                <g transform="translate(500 500)">
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="#000000" stroke="#000" stroke-width="40" stroke-linejoin="round"/>
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="none" stroke="#fff" stroke-width="20" stroke-linejoin="round"/>
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="url(#b)"/>
                    <path d="m-170-150-30-150m-50 210-120-150m540 90 30-150" fill="none" stroke="#3bf7db" stroke-width="8" stroke-linecap="round" opacity=".8"/>
                </g>

                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" x="15" y="20" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">5</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">5</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="none" stroke="#fff" stroke-width="18" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">5</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="url(#d)" transform="translate(500 540)skewX(-14)">5</text>

                <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" transform="translate(500 540)skewX(-14)">
                    <path d="m-160-280 40 160M-220 10l40 50m170-320 20 110m170-110 20 110"/>
                    <circle cx="-130" cy="-80" r="4" fill="#fff" stroke="none"/>
                    <circle cx="20" cy="-110" r="4" fill="#fff" stroke="none"/>
                    <circle cx="210" cy="-110" r="4" fill="#fff" stroke="none"/>
                </g>
                </svg>
                `
            }
        },
        {
            id: 'event400_pt_2',
            name: '2 Sync Token',
            category: 'EVENT_POINT',
            rarity: 'Mythic',
            baseDropRate: 25.0,
            rewardAmount: 2,
            visualConfig: {
                primaryColor: '#0b38b3',
                svgCode: `
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
                <defs>
                    <linearGradient id="b" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#07519e"/>
                    <stop offset="100%" stop-color="#02152e"/>
                    </linearGradient>
                    <linearGradient id="d" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#3bf7db"/>
                    <stop offset="45%" stop-color="#21bbf3"/>
                    <stop offset="100%" stop-color="#0b38b3"/>
                    </linearGradient>
                </defs>

                <g transform="translate(500 500)">
                    <path fill="#02152e" d="m0 0-480-380 60-40zm0 0 480-320-80-80zm0 0-450 380 90 40zm0 0 460 350-60 80zm0 0-520-80 20 100zm0 0 520-50-20-70z"/>
                    <path fill="#21bbf3" d="m0 0-460-360 60-30z"/>
                    <path fill="#3bf7db" d="m0 0 450-300-70-70z"/>
                    <path fill="#21bbf3" d="m0 0-420 360 80 30z"/>
                    <path fill="#3bf7db" d="m0 0 440 330-60 70z"/>
                    <circle cx="-420" cy="-200" r="8" fill="#02152e"/>
                    <circle cx="-400" cy="-220" r="12" fill="#21bbf3"/>
                    <circle cx="430" cy="-180" r="10" fill="#02152e"/>
                    <circle cx="450" cy="180" r="15" fill="#3bf7db"/>
                    <circle cx="-380" cy="220" r="9" fill="#02152e"/>
                </g>

                <g transform="translate(515 520)">
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="#000000" stroke="#000000" stroke-width="40" stroke-linejoin="round" opacity="0.2"/>
                </g>

                <g transform="translate(500 500)">
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="#000000" stroke="#000" stroke-width="40" stroke-linejoin="round"/>
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="none" stroke="#fff" stroke-width="20" stroke-linejoin="round"/>
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="url(#b)"/>
                    <path d="m-170-150-30-150m-50 210-120-150m540 90 30-150" fill="none" stroke="#3bf7db" stroke-width="8" stroke-linecap="round" opacity=".8"/>
                </g>

                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" x="15" y="20" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">2</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">2</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="none" stroke="#fff" stroke-width="18" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">2</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="url(#d)" transform="translate(500 540)skewX(-14)">2</text>

                <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" transform="translate(500 540)skewX(-14)">
                    <path d="m-160-280 40 160M-220 10l40 50m170-320 20 110m170-110 20 110"/>
                    <circle cx="-130" cy="-80" r="4" fill="#fff" stroke="none"/>
                    <circle cx="20" cy="-110" r="4" fill="#fff" stroke="none"/>
                    <circle cx="210" cy="-110" r="4" fill="#fff" stroke="none"/>
                </g>
                </svg>
                `
            }
        },
        {
            id: 'event400_pt_1',
            name: '1 Sync Token',
            category: 'EVENT_POINT',
            rarity: 'Mythic',
            baseDropRate: 25.0,
            rewardAmount: 1,
            visualConfig: {
                primaryColor: '#0b38b3',
                svgCode: `
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000">
                <defs>
                    <linearGradient id="b" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#07519e"/>
                    <stop offset="100%" stop-color="#02152e"/>
                    </linearGradient>
                    <linearGradient id="d" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stop-color="#3bf7db"/>
                    <stop offset="45%" stop-color="#21bbf3"/>
                    <stop offset="100%" stop-color="#0b38b3"/>
                    </linearGradient>
                </defs>

                <g transform="translate(500 500)">
                    <path fill="#02152e" d="m0 0-480-380 60-40zm0 0 480-320-80-80zm0 0-450 380 90 40zm0 0 460 350-60 80zm0 0-520-80 20 100zm0 0 520-50-20-70z"/>
                    <path fill="#21bbf3" d="m0 0-460-360 60-30z"/>
                    <path fill="#3bf7db" d="m0 0 450-300-70-70z"/>
                    <path fill="#21bbf3" d="m0 0-420 360 80 30z"/>
                    <path fill="#3bf7db" d="m0 0 440 330-60 70z"/>
                    <circle cx="-420" cy="-200" r="8" fill="#02152e"/>
                    <circle cx="-400" cy="-220" r="12" fill="#21bbf3"/>
                    <circle cx="430" cy="-180" r="10" fill="#02152e"/>
                    <circle cx="450" cy="180" r="15" fill="#3bf7db"/>
                    <circle cx="-380" cy="220" r="9" fill="#02152e"/>
                </g>

                <g transform="translate(515 520)">
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="#000000" stroke="#000000" stroke-width="40" stroke-linejoin="round" opacity="0.2"/>
                </g>

                <g transform="translate(500 500)">
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="#000000" stroke="#000" stroke-width="40" stroke-linejoin="round"/>
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="none" stroke="#fff" stroke-width="20" stroke-linejoin="round"/>
                    <path d="m0-342 60 162 156-135-36 153 204-90-120 144 192 18-156 72 168 90-192 18 132 135-216-63 72 162L96 198 0 351l-96-153-168 126 72-162-216 63 132-135-192-18 168-90-156-72 192-18-120-144 204 90-36-153 156 135Z" fill="url(#b)"/>
                    <path d="m-170-150-30-150m-50 210-120-150m540 90 30-150" fill="none" stroke="#3bf7db" stroke-width="8" stroke-linecap="round" opacity=".8"/>
                </g>

                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" x="15" y="20" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">1</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">1</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="none" stroke="#fff" stroke-width="18" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">1</text>
                <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="url(#d)" transform="translate(500 540)skewX(-14)">1</text>

                <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" transform="translate(500 540)skewX(-14)">
                    <path d="m-160-280 40 160M-220 10l40 50m170-320 20 110m170-110 20 110"/>
                    <circle cx="-130" cy="-80" r="4" fill="#fff" stroke="none"/>
                    <circle cx="20" cy="-110" r="4" fill="#fff" stroke="none"/>
                    <circle cx="210" cy="-110" r="4" fill="#fff" stroke="none"/>
                </g>
                </svg>
                `
            }
        }
    ]
};

import {
    getPullPricing,
    getSystemEventById,
    getSystemEventState,
} from "@/app/lib/eventRegistry";
import mongoose from "mongoose";

const ensureNumberMap = value => {
    if (value instanceof Map) {
        return value;
    }

    if (
        value
        && typeof value === "object"
    ) {
        return new Map(
            Object.entries(value)
        );
    }

    return new Map();
};

const readMapValue = (
    value,
    key
) => {
    if (value instanceof Map) {
        return value.get(key);
    }

    return value?.[key];
};

const resolveActiveGacha = (
    eventId,
    now = new Date()
) => {
    let event;

    try {
        event =
            getSystemEventById(
                eventId
            );
    } catch {
        return {
            event: null,
            response:
                NextResponse.json(
                    {
                        error:
                            "Invalid event ID.",
                    },
                    { status: 400 }
                ),
        };
    }

    if (
        !event
        || String(
            event.type
        ).toLowerCase() !== "gacha"
    ) {
        return {
            event: null,
            response:
                NextResponse.json(
                    {
                        error:
                            "Gacha event not found.",
                    },
                    { status: 404 }
                ),
        };
    }

    const state =
        getSystemEventState(
            event,
            now
        );

    if (state.isComing) {
        return {
            event: null,
            response:
                NextResponse.json(
                    {
                        error:
                            "This gacha has not started yet.",
                        code:
                            "EVENT_NOT_STARTED",
                        startsAt:
                            event.startsAt,
                    },
                    { status: 409 }
                ),
        };
    }

    if (state.isExpired) {
        return {
            event: null,
            response:
                NextResponse.json(
                    {
                        error:
                            "This gacha event has expired.",
                        code:
                            "EVENT_EXPIRED",
                        endsAt:
                            event.endsAt,
                    },
                    { status: 410 }
                ),
        };
    }

    const pool =
        GACHA_POOLS[event.id] || [];

    if (pool.length === 0) {
        return {
            event: null,
            response:
                NextResponse.json(
                    {
                        error:
                            "This event has no configured reward pool.",
                    },
                    { status: 404 }
                ),
        };
    }

    return {
        event,
        pool,
        response: null,
    };
};

const getPlacementFallback = pool => {
    const fallbackConsumables =
        pool.filter(item => (
            item.category === "CONSUMABLE"
            || item.category === "EVENT_POINT"
        ));

    return {
        fallbackConsumables,
        absoluteFallback:
            fallbackConsumables[0]
            || pool[0],
    };
};

const pickWeightedItem = ({
    pool,
    availableItems,
    fallbackConsumables,
    absoluteFallback,
}) => {
    const totalWeight =
        pool.reduce(
            (sum, item) =>
                sum
                + Math.max(
                    0,
                    Number(
                        item.baseDropRate
                    ) || 0
                ),
            0
        );

    if (totalWeight <= 0) {
        return absoluteFallback;
    }

    let roll =
        Math.random()
        * totalWeight;

    for (const item of pool) {
        roll -= Math.max(
            0,
            Number(
                item.baseDropRate
            ) || 0
        );

        if (roll > 0) {
            continue;
        }

        const available =
            availableItems.some(
                candidate =>
                    candidate.id
                    === item.id
            );

        if (available) {
            return item;
        }

        if (
            fallbackConsumables.length
            > 0
        ) {
            const fallbackIndex =
                Math.floor(
                    Math.random()
                    * fallbackConsumables
                        .length
                );

            return fallbackConsumables[
                fallbackIndex
            ];
        }

        return absoluteFallback;
    }

    return absoluteFallback;
};

const applyGachaReward = ({
    user,
    selectedItem,
    eventId,
    currentInventoryIds,
    currentPoints,
}) => {
    let nextPoints =
        currentPoints;

    if (
        selectedItem.category
        === "CONSUMABLE"
    ) {
        user.coins =
            (
                Number(user.coins)
                || 0
            )
            + (
                Number(
                    selectedItem
                        .rewardAmount
                ) || 0
            );
    } else if (
        selectedItem.category
        === "EVENT_POINT"
    ) {
        nextPoints +=
            Number(
                selectedItem
                    .rewardAmount
            ) || 0;
    } else {
        currentInventoryIds.add(
            selectedItem.id
        );

        const expiryDate =
            selectedItem.expiresInDays
                ? new Date(
                    Date.now()
                    + Number(
                        selectedItem
                            .expiresInDays
                    )
                    * 24
                    * 60
                    * 60
                    * 1000
                )
                : null;

        user.inventory.push({
            itemId:
                selectedItem.id,
            name:
                selectedItem.name,
            category:
                selectedItem.category,
            url:
                selectedItem.url
                || null,
            rarity:
                selectedItem.rarity
                || "Common",
            visualConfig:
                selectedItem
                    .visualConfig,
            acquiredAt:
                new Date(),
            expiresAt:
                expiryDate,
        });
    }

    return {
        nextPoints,
        reward: {
            ...selectedItem,
            isDuplicate: false,
            refundAmount: 0,
        },
    };
};

export async function GET(req) {
    try {
        await connectDB();

        const { searchParams } =
            new URL(req.url);

        const deviceId =
            searchParams.get(
                "deviceId"
            );

        const eventId =
            searchParams.get(
                "eventId"
            );

        if (!eventId) {
            return NextResponse.json(
                {
                    error:
                        "eventId is required.",
                },
                { status: 400 }
            );
        }

        const resolved =
            resolveActiveGacha(
                eventId
            );

        if (resolved.response) {
            return resolved.response;
        }

        const {
            event,
            pool,
        } = resolved;

        let ownedIds = [];
        let pityCount = 0;
        let eventPoints = 0;
        let spinTokens = 0;

        if (deviceId) {
            const user =
                await MobileUser.findOne({
                    deviceId,
                })
                    .select(
                        "inventory gachaPityCounters eventPoints eventSpinTokens"
                    )
                    .lean();

            if (user) {
                ownedIds =
                    (
                        user.inventory
                        || []
                    ).map(
                        item =>
                            item.itemId
                    );

                pityCount =
                    Number(
                        readMapValue(
                            user.gachaPityCounters,
                            event.id
                        )
                    ) || 0;

                eventPoints =
                    Number(
                        readMapValue(
                            user.eventPoints,
                            event.id
                        )
                    ) || 0;

                spinTokens =
                    Number(
                        readMapValue(
                            user.eventSpinTokens,
                            event.id
                        )
                    ) || 0;
            }
        }

        return NextResponse.json({
            success: true,
            event: {
                id: event.id,
                title: event.title,
                gachaType:
                    event.gachaType,
                spinTokenName:
                    event.spinTokenName
                    || event.tokenName,
                spinTokenVisual:
                    event.spinTokenVisual
                    || event.tokenVisual,

                // Compatibility aliases for the current frontend.
                tokenName:
                    event.spinTokenName
                    || event.tokenName,
                tokenVisual:
                    event.spinTokenVisual
                    || event.tokenVisual,

                exchangePointName:
                    event.exchangePointName
                    || "Event Points",
                themeColor:
                    event.themeColor,
                startsAt:
                    event.startsAt,
                endsAt:
                    event.endsAt,
                includeReferral:
                    event.includeReferral
                    === true,
                referralConfig:
                    event.referralConfig
                    || null,
            },
            pool,
            ownedIds,
            pityCount,
            eventPoints,
            spinTokens,
        });
    } catch (error) {
        console.error(
            "GET Gacha Error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Internal server error",
            },
            { status: 500 }
        );
    }
}

export async function POST(req) {
    try {
        await connectDB();

        const {
            deviceId,
            pullType,
            eventId,
            itemId,
        } = await req.json();

        if (
            !deviceId
            || !pullType
            || !eventId
        ) {
            return NextResponse.json(
                {
                    error:
                        "Missing parameters",
                },
                { status: 400 }
            );
        }

        const resolved =
            resolveActiveGacha(
                eventId
            );

        if (resolved.response) {
            return resolved.response;
        }

        const {
            event,
            pool,
        } = resolved;

        const transactionResult = {
            payload: null,
            failure: null,
        };

        await mongoose.connection.transaction(
            async session => {
                // transaction() can retry. Clear the previous attempt result.
                transactionResult.payload = null;
                transactionResult.failure = null;

                // The screen may have opened before endsAt. Recheck at the
                // exact transaction that will spend currency.
                if (
                    !getSystemEventState(
                        event,
                        new Date()
                    ).isActive
                ) {
                    transactionResult.failure = {
                        error:
                            "This gacha event has expired.",
                        status: 410,
                    };
                    return;
                }

                const user =
                    await MobileUser.findOne({
                        deviceId,
                    }).session(session);

                if (!user) {
                    transactionResult.failure = {
                        error:
                            "User not found",
                        status: 404,
                    };
                    return;
                }

                user.inventory =
                    Array.isArray(
                        user.inventory
                    )
                        ? user.inventory
                        : [];

                user.gachaPityCounters =
                    ensureNumberMap(
                        user
                            .gachaPityCounters
                    );

                user.eventPoints =
                    ensureNumberMap(
                        user.eventPoints
                    );

                user.eventSpinTokens =
                    ensureNumberMap(
                        user.eventSpinTokens
                    );

                const currentExchangePoints =
                    Number(
                        user.eventPoints.get(
                            event.id
                        )
                    ) || 0;

                const currentSpinTokenBalance =
                    Number(
                        user.eventSpinTokens.get(
                            event.id
                        )
                    ) || 0;

                if (
                    pullType
                    === "exchange"
                ) {
                    if (!itemId) {
                        transactionResult.failure = {
                            error:
                                "Item ID required for exchange",
                            status: 400,
                        };
                        return;
                    }

                    const targetItem =
                        pool.find(
                            item =>
                                item.id
                                === itemId
                        );

                    if (!targetItem) {
                        transactionResult.failure = {
                            error:
                                "Item not found in this event",
                            status: 404,
                        };
                        return;
                    }

                    const price =
                        Math.max(
                            0,
                            Number(
                                targetItem
                                    .exchangePrice
                            ) || 0
                        );

                    if (
                        currentExchangePoints
                        < price
                    ) {
                        transactionResult.failure = {
                            error:
                                `Insufficient ${event.exchangePointName || "event points"}.`,
                            status: 400,
                        };
                        return;
                    }

                    const alreadyOwned =
                        user.inventory.some(
                            inventoryItem =>
                                inventoryItem
                                    .itemId
                                === itemId
                        );

                    if (
                        alreadyOwned
                        && ![
                            "CONSUMABLE",
                            "EVENT_POINT",
                        ].includes(
                            targetItem.category
                        )
                    ) {
                        transactionResult.failure = {
                            error:
                                "Artifact already acquired.",
                            status: 409,
                        };
                        return;
                    }

                    let nextPoints =
                        currentExchangePoints
                        - price;

                    if (
                        targetItem.category
                        === "CONSUMABLE"
                    ) {
                        user.coins =
                            (
                                Number(
                                    user.coins
                                ) || 0
                            )
                            + (
                                Number(
                                    targetItem
                                        .rewardAmount
                                ) || 0
                            );
                    } else if (
                        targetItem.category
                        === "EVENT_POINT"
                    ) {
                        nextPoints +=
                            Number(
                                targetItem
                                    .rewardAmount
                            ) || 0;
                    } else {
                        const expiryDate =
                            targetItem
                                .expiresInDays
                                ? new Date(
                                    Date.now()
                                    + Number(
                                        targetItem
                                            .expiresInDays
                                    )
                                    * 24
                                    * 60
                                    * 60
                                    * 1000
                                )
                                : null;

                        user.inventory.push({
                            itemId:
                                targetItem.id,
                            name:
                                targetItem.name,
                            category:
                                targetItem
                                    .category,
                            url:
                                targetItem.url
                                || null,
                            rarity:
                                targetItem.rarity
                                || "Common",
                            visualConfig:
                                targetItem
                                    .visualConfig,
                            acquiredAt:
                                new Date(),
                            expiresAt:
                                expiryDate,
                        });
                    }

                    user.eventPoints.set(
                        event.id,
                        nextPoints
                    );

                    user.markModified(
                        "eventPoints"
                    );

                    await user.save({
                        session,
                    });

                    transactionResult.payload = {
                        success: true,
                        paymentMethod:
                            "EVENT_POINTS",
                        pointsSpent:
                            price,
                        spinTokensSpent: 0,
                        ocSpent: 0,
                        eventPoints:
                            nextPoints,
                        spinTokens:
                            currentSpinTokenBalance,
                        newBalance:
                            user.coins,
                        inventory:
                            user.inventory,
                        itemGained:
                            targetItem,
                    };

                    return;
                }

                const pricing =
                    getPullPricing(
                        event,
                        pullType
                    );

                const currentInventoryIds =
                    new Set(
                        user.inventory.map(
                            inventoryItem =>
                                inventoryItem
                                    .itemId
                        )
                    );

                const hasPullableReward =
                    pool.some(item => (
                        item.category
                        === "CONSUMABLE"
                        || item.category
                        === "EVENT_POINT"
                        || !currentInventoryIds
                            .has(item.id)
                    ));

                if (!hasPullableReward) {
                    transactionResult.failure = {
                        error:
                            "You already own every permanent reward and this pool has no repeatable fallback.",
                        status: 409,
                    };
                    return;
                }

                const canUseSpinTokens =
                    pricing.spinTokenCost > 0
                    && currentSpinTokenBalance
                    >= pricing.spinTokenCost;

                const currentCoins =
                    Number(
                        user.coins
                    ) || 0;

                if (
                    !canUseSpinTokens
                    && currentCoins
                    < pricing.ocCost
                ) {
                    transactionResult.failure = {
                        error:
                            `You need either ${pricing.spinTokenCost} ${event.spinTokenName || event.tokenName || "spin tokens"} or ${pricing.ocCost} OC for this summon.`,
                        status: 400,
                    };
                    return;
                }

                let paymentMethod;
                let spinTokensSpent = 0;
                let ocSpent = 0;

                if (canUseSpinTokens) {
                    paymentMethod =
                        "SPIN_TOKEN";
                    spinTokensSpent =
                        pricing.spinTokenCost;

                    user.eventSpinTokens.set(
                        event.id,
                        currentSpinTokenBalance
                        - pricing.spinTokenCost
                    );
                } else {
                    paymentMethod = "OC";
                    ocSpent =
                        pricing.ocCost;
                    user.coins =
                        currentCoins
                        - pricing.ocCost;
                }

                const isRoulette =
                    String(
                        event.gachaType
                    ).toUpperCase()
                    === "ROULETTE";

                let currentPity =
                    Number(
                        user
                            .gachaPityCounters
                            .get(event.id)
                    ) || 0;

                let currentPoints =
                    Number(
                        user.eventPoints.get(
                            event.id
                        )
                    ) || 0;

                const {
                    fallbackConsumables,
                    absoluteFallback,
                } = getPlacementFallback(
                    pool
                );

                const rewardsGained = [];
                let mythicPulledInSession =
                    false;

                for (
                    let pullIndex = 0;
                    pullIndex
                    < pricing.pulls;
                    pullIndex += 1
                ) {
                    if (isRoulette) {
                        currentPity += 1;
                    }

                    let availableItems =
                        pool.filter(
                            item => (
                                item.category
                                === "CONSUMABLE"
                                || item.category
                                === "EVENT_POINT"
                                || !currentInventoryIds
                                    .has(item.id)
                            )
                        );

                    if (
                        mythicPulledInSession
                    ) {
                        availableItems =
                            availableItems.filter(
                                item =>
                                    String(
                                        item.rarity
                                    ).toUpperCase()
                                    !== "MYTHIC"
                            );
                    }

                    let selectedItem = null;

                    const pityThreshold =
                        Math.max(
                            1,
                            Number(
                                event
                                    .pityThreshold
                            ) || 50
                        );

                    const mythicItems =
                        availableItems.filter(
                            item =>
                                String(
                                    item.rarity
                                ).toUpperCase()
                                === "MYTHIC"
                        );

                    if (
                        isRoulette
                        && currentPity
                        >= pityThreshold
                        && mythicItems.length
                        > 0
                    ) {
                        selectedItem =
                            pickWeightedItem({
                                pool:
                                    mythicItems,
                                availableItems:
                                    mythicItems,
                                fallbackConsumables:
                                    mythicItems,
                                absoluteFallback:
                                    mythicItems[0],
                            });

                        currentPity = 0;
                        mythicPulledInSession =
                            true;
                    }

                    if (!selectedItem) {
                        selectedItem =
                            pickWeightedItem({
                                pool,
                                availableItems,
                                fallbackConsumables,
                                absoluteFallback,
                            });
                    }

                    if (
                        isRoulette
                        && String(
                            selectedItem
                                ?.rarity
                        ).toUpperCase()
                        === "MYTHIC"
                    ) {
                        currentPity = 0;
                        mythicPulledInSession =
                            true;
                    }

                    const applied =
                        applyGachaReward({
                            user,
                            selectedItem,
                            eventId:
                                event.id,
                            currentInventoryIds,
                            currentPoints,
                        });

                    currentPoints =
                        applied.nextPoints;

                    rewardsGained.push(
                        applied.reward
                    );
                }

                user
                    .gachaPityCounters
                    .set(
                        event.id,
                        currentPity
                    );

                user.eventPoints.set(
                    event.id,
                    currentPoints
                );

                user.markModified(
                    "gachaPityCounters"
                );
                user.markModified(
                    "eventPoints"
                );
                user.markModified(
                    "eventSpinTokens"
                );

                await user.save({
                    session,
                });

                transactionResult.payload = {
                    success: true,
                    paymentMethod,
                    spinTokensSpent,
                    ocSpent,
                    pullType:
                        pricing.pullType,
                    pulls:
                        pricing.pulls,
                    newBalance:
                        user.coins,
                    eventPoints:
                        currentPoints,
                    spinTokens:
                        Number(
                            user.eventSpinTokens.get(
                                event.id
                            )
                        ) || 0,
                    inventory:
                        user.inventory,
                    rewards:
                        rewardsGained,
                    pityCount:
                        currentPity,
                };
            }
        );

        if (
            transactionResult.failure
        ) {
            return NextResponse.json(
                {
                    error:
                        transactionResult
                            .failure
                            .error,
                },
                {
                    status:
                        transactionResult
                            .failure
                            .status,
                }
            );
        }

        return NextResponse.json(
            transactionResult.payload
        );
    } catch (error) {
        console.error(
            "Gacha POST Error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    "Internal server error",
            },
            { status: 500 }
        );
    }
}


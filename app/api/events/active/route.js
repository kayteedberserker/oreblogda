import Clan from '@/app/models/ClanModel';
import MobileUser from '@/app/models/MobileUserModel';
import mongoose from 'mongoose';
import { NextResponse } from 'next/server';

// Ensure ClanFollower is registered to prevent missing model errors

const gachaTypes = ["grid", "roulette"]

export async function GET(request) {
    try {
        const now = new Date();
        const { searchParams } = new URL(request.url);
        const referredBy = searchParams.get('referredBy');
        const userId = searchParams.get('userId'); // ⚡️ NEW: Capture the requesting user's ID

        // ⚡️ Raw Event Configurations
        const rawEvents = [
            // 🚀 0. THE PRE-EVENT: Referral Countdown (Active NOW)
            // // 🧠 2. The Lore Trivia (Coming Soon)
            {
                id: 'trivia_lore_check',
                type: "quiz",
                title: 'The Meaning of the System',
                description: 'Prove your knowledge of THE SYSTEM to unlock 500 OC.',
                eventType: 'quiz',
                promoImage: 'https://res.cloudinary.com/donakg9he/image/upload/v1778879732/ChatGPT_Image_May_6_2026_12_13_46_PM_yb2isc.png',
                icon: 'help-circle',
                themeColor: '#8b5cf6',
                startsAt: new Date('2026-05-16T07:00:00Z').toISOString(),
                endsAt: new Date('2026-05-23T23:59:59Z').toISOString(),
            },
            //  // 🎡 3. The Founder’s Cache (Coming Soon)
            // 🌌 3. THE NEW ANIME EVENT (Astral Awakening - GRID)
            {
                id: 'gacha_400_cache',
                type: "gacha",
                gachaType: "GRID",
                title: '400 SYNCED: MAIN EVENT',
                description: 'To celebrate, the limited-time Surge Event is live! Drop in, take your spins, and cash in your fragments for the ultra-rare Cyan Surge items before they vanish!',
                startsAt: new Date('2026-05-17T00:00:00Z').toISOString(),
                eventType: 'seasonal',
                tokenName: '400 SYNCED', // Custom name!
                tokenVisual: {
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

                            <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" x="15" y="20" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">400</text>
                            <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="#000000" stroke="#000" stroke-width="45" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">400</text>
                            <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="none" stroke="#fff" stroke-width="18" stroke-linejoin="round" transform="translate(500 540)skewX(-14)">400</text>
                            <text font-family="Impact, Arial Black, sans-serif" font-size="420" font-weight="900" font-style="italic" text-anchor="middle" letter-spacing="-10" fill="url(#d)" transform="translate(500 540)skewX(-14)">400</text>

                            <g fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" transform="translate(500 540)skewX(-14)">
                                <path d="m-160-280 40 160M-220 10l40 50m170-320 20 110m170-110 20 110"/>
                                <circle cx="-130" cy="-80" r="4" fill="#fff" stroke="none"/>
                                <circle cx="20" cy="-110" r="4" fill="#fff" stroke="none"/>
                                <circle cx="210" cy="-110" r="4" fill="#fff" stroke="none"/>
                            </g>
                            </svg>
                    ` },
                icon: 'flare', // A cool burst/spark icon
                themeColor: '#8bf755', // A cosmic purple
                endsAt: new Date('2026-06-01T00:00:00Z').toISOString(),
            }
        ];

        // ⚡️ AUTOMATION ENGINE
        const activeEvents = rawEvents
            .filter(event => {
                if (event.endsAt) {
                    return new Date(event.endsAt) > now;
                }
                return true;
            })
            .map(event => {
                let isComing = false;
                let currentStatus = 'active';

                if (event.startsAt) {
                    if (new Date(event.startsAt) > now) {
                        isComing = true;
                        currentStatus = 'coming_soon';
                    }
                }

                return {
                    ...event,
                    isComing: isComing,
                    status: currentStatus,
                };
            });

        // ⚡️ DYNAMIC CLAN REFERRAL MATCHING ENGINE
        let referredClan = null;
        if (referredBy) {
            const referrer = await MobileUser.findOne({ referralCode: referredBy }).lean();

            if (referrer) {
                // Find if the referring user leads or belongs to any clan
                const clan = await Clan.findOne({
                    $or: [
                        { leader: referrer._id },
                        { viceLeader: referrer._id },
                        { members: referrer._id }
                    ]
                }).lean();

                if (clan) {
                    let isAlreadyFollowingOrMember = false;

                    // ⚡️ NEW: Check if the user already follows this clan or is a member
                    if (userId && mongoose.Types.ObjectId.isValid(userId)) {
                        // Check Follower DB
                        const followerRecord = await mongoose.models.ClanFollower.findOne({
                            clanTag: clan.tag,
                            userId: userId
                        }).lean();

                        if (followerRecord) {
                            isAlreadyFollowingOrMember = true;
                        }

                        // Check actual membership inside the Clan object
                        if (!isAlreadyFollowingOrMember) {
                            if (
                                clan.leader?.toString() === userId ||
                                clan.viceLeader?.toString() === userId ||
                                clan.members?.some(m => m.toString() === userId)
                            ) {
                                isAlreadyFollowingOrMember = true;
                            }
                        }
                    }

                    // Only send the payload down if they aren't following yet
                    if (!isAlreadyFollowingOrMember) {
                        // Generate a vibrant, deterministic cyberpunk color using a hash of the clan tag
                        const colors = ["#3b82f6", "#8b5cf6", "#10b981", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];
                        let hash = 0;
                        for (let i = 0; i < clan.tag.length; i++) {
                            hash = clan.tag.charCodeAt(i) + ((hash << 5) - hash);
                        }
                        const dynamicColor = colors[Math.abs(hash) % colors.length];

                        referredClan = {
                            name: clan.name,
                            tag: clan.tag,
                            description: clan.description || "You've been linked via a direct alliance referral. Sync immediately to access dedicated pools and shared clan multipliers.",
                            color: dynamicColor,
                            rank: clan.rank || 1, // Added for ClanCrest
                            referrerName: referrer.username || "Unknown Author",
                            referrerImage: referrer.profilePic?.url || null
                        };
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            events: activeEvents,
            referredClan // Seamlessly appended for the UI to consume
        });

    } catch (error) {
        console.error("Failed to fetch active events:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
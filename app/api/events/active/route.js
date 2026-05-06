import { NextResponse } from 'next/server';

const gachaTypes = ["grid", "roulette"]

export async function GET() {
    try {
        const now = new Date();

        // ⚡️ Raw Event Configurations
        const rawEvents = [
            // 🚀 0. THE PRE-EVENT: Referral Countdown (Active NOW)
            {
                id: 'referral_countdown_400',
                type: "milestone_countdown",
                title: 'The Final Push',
                description: 'We are almost there. The Great Library unlocks at 400 users. Share your unique link to accelerate the countdown and claim your invite bonus.',
                targetGoal: 400,
                // Current stats would be fetched from your DB in a real scenario
                currentCount: 379,
                inviteBonus: "50 OC + X2 Streak Boost",
                eventType: 'referral',
                promoImage: 'https://oreblogda.com/almost400.png',
                icon: 'share-variant',
                themeColor: '#10b981', // Emerald Green
                startsAt: new Date('2026-05-06T00:00:00Z').toISOString(),
                endsAt: new Date('2026-05-13T23:59:59Z').toISOString(),
            },
            // 🏅 1. The Legacy Claim (Coming Soon)
            // {
            //     id: 'claim_alpha_operative',
            //     type: "claim",
            //     title: 'The Alpha Operative',
            //     description: 'Exclusive "First 400" Title claim. Unlocks once the System hits 400 capacity.',
            //     amount: 0,
            //     rewardType: 'title',
            //     rewardValue: 'Alpha Operative',
            //     eventType: 'achievement',
            //     icon: 'medal',
            //     themeColor: '#fbbf24',
            //     // Starts exactly when you expect to hit 400
            //     startsAt: new Date('2026-05-07T12:00:00Z').toISOString(), 
            //     endsAt: new Date('2026-05-14T23:59:59Z').toISOString(),
            // },
            // // 🧠 2. The Lore Trivia (Coming Soon)
            // {
            //     id: 'trivia_lore_check',
            //     type: "trivia",
            //     title: 'The Meaning of the System',
            //     description: 'Prove your knowledge of O l e b l o g d a to unlock 200 OC.',
            //     maxReward: 200,
            //     hintPenalty: 20,
            //     baseReward: 100,
            //     eventType: 'challenge',
            //     icon: 'help-circle',
            //     themeColor: '#8b5cf6',
            //     startsAt: new Date('2026-05-07T12:00:00Z').toISOString(),
            //     endsAt: new Date('2026-05-14T23:59:59Z').toISOString(),
            // },
            //  // 🎡 3. The Founder’s Cache (Coming Soon)
            //  {
            //     id: 'gacha_400_cache',
            //     type: "gacha",
            //     gachaType: "grid", 
            //     title: 'Founder’s Cache',
            //     description: 'The milestone gacha. Spin the grid to claim your rewards. 4 spins max.',
            //     maxSpins: 4,
            //     eventType: 'luck',
            //     icon: 'gift',
            //     themeColor: '#ef4444',
            //     startsAt: new Date('2026-05-07T12:00:00Z').toISOString(),
            //     endsAt: new Date('2026-05-14T23:59:59Z').toISOString(),
            // },
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

        return NextResponse.json({
            success: true,
            events: activeEvents
        });

    } catch (error) {
        console.error("Failed to fetch active events:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
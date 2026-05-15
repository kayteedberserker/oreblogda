import { NextResponse } from 'next/server';

const gachaTypes = ["grid", "roulette"]

export async function GET() {
    try {
        const now = new Date();

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
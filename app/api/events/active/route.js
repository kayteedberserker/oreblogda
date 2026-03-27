import { NextResponse } from 'next/server';

export async function GET() {
    try {
        // ⚡️ Grab the exact current server time
        const now = new Date();

        // ⚡️ UPDATED: Raw Event Configurations
        const rawEvents = [
            // 🌙 1. The Original Gacha Event (Eid Theme - ROULETTE)
            {
                id: 'eid_al_fitr_2026',
                type: "gacha",
                gachaType: "ROULETTE",
                title: 'Eid al-Fitr Celebration',
                description: 'Eid Mubarak! Spin the Golden Vault to unlock exclusive Eid cosmetics and Clan boosts!',
                eventType: 'holiday',
                icon: 'moon-waning-crescent',
                themeColor: '#facc15',
                endsAt: new Date('2026-03-27T21:59:59Z').toISOString(),
            },

            // ✨ 2. The Claim Tab (1K Milestone)
            {
                id: '1kpostevent',
                type: "claim",
                title: '1K Milestone',
                description: 'The Great Library has recorded its 1,000th entry. Thank you for your service, Operative. Claim your reward below.',
                amount: 1000,
                eventType: 'achievement',
                icon: 'star-shooting',
                themeColor: '#3b82f6',
                endsAt: new Date('2026-03-27T21:59:59Z').toISOString(),
            },

            // 🌌 3. THE NEW ANIME EVENT (Astral Awakening - GRID)
            {
                id: 'astral_awakening_01',
                type: "gacha",
                gachaType: "GRID",
                title: 'Astral Awakening',
                description: 'Tap into the cosmic flow! Roll the grid to unlock Legendary Auras and Mythic prowess. Update the App to Access.',
                // status and isComing are omitted here because we auto-calculate them!
                startsAt: "2026-03-28T00:00:00Z",
                eventType: 'seasonal',
                tokenName: 'Astral Fragments',
                tokenVisual: {
                    svgCode: `
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#a855f7" opacity=".15"/><circle cx="50" cy="50" r="40" fill="#a855f7" opacity=".25"/><g fill="#581c87"><rect x="20" y="20" width="60" height="60" rx="8"/><rect x="20" y="20" width="60" height="60" rx="8" transform="rotate(45 50 50)"/></g><g fill="#a855f7"><rect x="26" y="26" width="48" height="48" rx="6"/><rect x="26" y="26" width="48" height="48" rx="6" transform="rotate(45 50 50)"/></g><g fill="#d946ef"><rect x="34" y="34" width="32" height="32" rx="4"/><rect x="34" y="34" width="32" height="32" rx="4" transform="rotate(45 50 50)"/></g><circle cx="50" cy="50" r="16" fill="#fdf4ff"/><circle cx="50" cy="50" r="10" fill="#fbcfe8"/><path d="m50 36 4 14-4 14-4-14Z" fill="#581c87"/><circle cx="45" cy="45" r="3" fill="#fff"/><circle cx="54" cy="54" r="1.5" fill="#fff" opacity=".8"/></svg>
                ` },
                icon: 'flare', 
                themeColor: '#a855f7', 
                // ⚡️ FIXED: Ensure endsAt is AFTER startsAt so it actually shows up!
                endsAt: new Date('2026-05-08T23:59:59Z').toISOString(),
            }
        ];

        // ⚡️ AUTOMATION ENGINE: Filter and map the events based strictly on time
        const activeEvents = rawEvents
            .filter(event => {
                // 1. If it has an endsAt date, check if that date has passed.
                // If now is greater than endsAt, filter it out completely.
                if (event.endsAt) {
                    return new Date(event.endsAt) > now;
                }
                return true; // Keep events with no expiration
            })
            .map(event => {
                // 2. Check if the event is "Coming Soon" or "Active"
                let isComing = false;
                let currentStatus = 'active';

                if (event.startsAt) {
                    // If the start time is in the future, it's coming soon
                    if (new Date(event.startsAt) > now) {
                        isComing = true;
                        currentStatus = 'coming_soon';
                    }
                }

                // 3. Return the event with the dynamically calculated flags
                return {
                    ...event,
                    isComing: isComing,
                    status: currentStatus,
                };
            });
            console.log(activeEvents);
            
        return NextResponse.json({
            success: true,
            events: activeEvents // ⚡️ Send back the filtered & formatted array
        });

    } catch (error) {
        console.error("Failed to fetch active events:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
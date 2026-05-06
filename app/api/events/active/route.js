import { NextResponse } from 'next/server';
const gachaTypes = ["grid", "roulette"] // You should probably use grid only
export async function GET() {
    try {
        // ⚡️ Grab the exact current server time
        const now = new Date();

        // ⚡️ UPDATED: Raw Event Configurations
        const rawEvents = [
            // ✨ 2. The Claim Tab (1K Milestone)
            {
                id: '400_users_event',
                type: "claim",
                title: '1K Milestone',
                description: 'The Great Library has recorded its 1,000th entry. Thank you for your service, Operative. Claim your reward below.',
                amount: 1000,
                eventType: 'achievement',
                icon: 'star-shooting',
                themeColor: '#3b82f6',
                endsAt: new Date('2026-03-27T21:59:59Z').toISOString(),
            },
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
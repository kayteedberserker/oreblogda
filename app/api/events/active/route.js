import { NextResponse } from 'next/server';

export async function GET() {
    try {
        const activeEvents = {
            // 🌙 The Gacha Event (Eid Theme)
            gacha: {
                id: 'eid_al_fitr_2026',
                title: 'Eid al-Fitr Celebration',
                description: 'Eid Mubarak! Spin the Golden Vault to unlock exclusive Eid cosmetics and Clan boosts!',
                status: 'active',
                eventType: 'holiday',
                icon: 'moon-waning-crescent', // ⚡️ Passed to Frontend
                themeColor: '#facc15',        // ⚡️ Gold/Yellow
                endsAt: new Date('2026-03-27T23:59:59Z').toISOString(), 
            },
            
            // ✨ The Claim Tab (1K Milestone)
            claim: {
                id: '1kpostevent', 
                title: '1K Milestone',
                description: 'The Great Library has recorded its 1,000th entry. Thank you for your service, Operative. Claim your reward below.',
                amount: 1000, 
                status: "active",
                eventType: 'achievement',
                icon: 'star-shooting',       // ⚡️ Passed to Frontend
                themeColor: '#3b82f6',       // ⚡️ Cyber Blue
                endsAt: new Date('2026-03-23T23:59:59Z').toISOString(), 
            }
        };

        return NextResponse.json({
            success: true,
            event: activeEvents
        });

    } catch (error) {
        console.error("Failed to fetch active events:", error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
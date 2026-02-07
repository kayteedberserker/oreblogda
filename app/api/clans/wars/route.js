import { NextResponse } from 'next/server';
import connectDB from '@/app/lib/mongodb';
import ClanWar from '@/app/models/ClanWar';

export async function GET(req) {
    try {
        await connectDB();
        
        const { searchParams } = new URL(req.url);
        const status = searchParams.get('status') || 'ACTIVE';
        // Handle both 'tag' and 'clanTag' for frontend compatibility
        const tag = searchParams.get('tag') || searchParams.get('clanTag'); 
        const page = parseInt(searchParams.get('page')) || 1;
        const limit = parseInt(searchParams.get('limit')) || 10;
        const skip = (page - 1) * limit;

        let query = { status: status };

        if (tag) {
            if (status === 'PENDING') {
                // Challenges sent TO us specifically
                query.defenderTag = tag;
            } else if (status === 'NEGOTIATING' || status === 'ACTIVE' || status === 'COMPLETED') {
                // For history, active wars, or negotiations: we check both sides
                query.$or = [{ challengerTag: tag }, { defenderTag: tag }];
            }
        }

        const wars = await ClanWar.find(query)
            .sort({ updatedAt: -1 }) // Most recent updates first
            .skip(skip)
            .limit(limit);
        
        const total = await ClanWar.countDocuments(query);
        
        return NextResponse.json({
            wars,
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalWars: total
        }, { status: 200 });
    } catch (error) {
        console.error("War Fetch Error:", error);
        return NextResponse.json({ message: "Failed to fetch warfronts." }, { status: 500 });
    }
}
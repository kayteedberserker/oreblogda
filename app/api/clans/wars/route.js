import connectDB from '@/app/lib/mongodb';
import Clan from '@/app/models/ClanModel'; // Import the Clan model
import ClanWar from '@/app/models/ClanWar';
import { NextResponse } from 'next/server';

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
            .limit(limit)
            .lean(); // Use .lean() for better performance when adding data

        // Extract all unique clan tags from the fetched wars
        const uniqueClanTags = new Set();
        wars.forEach(war => {
            uniqueClanTags.add(war.challengerTag);
            uniqueClanTags.add(war.defenderTag);
        });

        // Fetch clan data for all unique tags
        const clans = await Clan.find({ tag: { $in: Array.from(uniqueClanTags) } })
            .select('tag name rank specialInventory activeCustomizations isInWar followerCount displayRank verifiedUntil') // Select all necessary fields for display
            .lean();

        // Create a map for quick lookup
        const clanMap = new Map(clans.map(clan => [clan.tag, clan]));

        // Enrich the wars with clan data
        const enrichedWars = wars.map(war => ({
            ...war,
            challengerClan: clanMap.get(war.challengerTag) || null,
            defenderClan: clanMap.get(war.defenderTag) || null,
        }));

        const total = await ClanWar.countDocuments(query);

        return NextResponse.json({
            wars: enrichedWars, // Return the enriched wars
            currentPage: page,
            totalPages: Math.ceil(total / limit),
            totalWars: total
        }, { status: 200 });
    } catch (error) {
        console.error("War Fetch Error:", error);
        return NextResponse.json({ message: "Failed to fetch warfronts." }, { status: 500 });
    }
}
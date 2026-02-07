import { NextResponse } from 'next/server';
import connectDB from '@/app/lib/mongodb';
import ClanWar from '@/app/models/ClanWar';

export async function GET(req) {
    try {
        await connectDB();
        
        // Optional: Get country from query params to filter the list
        const { searchParams } = new URL(req.url);
        const country = searchParams.get('country');

        let query = { status: { $in: ["PENDING", "ACTIVE"] } };
        if (country) query.country = country;

        const wars = await ClanWar.find(query).sort({ createdAt: -1 });

        return NextResponse.json(wars, { status: 200 });
    } catch (error) {
        return NextResponse.json({ message: "Failed to fetch warfronts." }, { status: 500 });
    }
}
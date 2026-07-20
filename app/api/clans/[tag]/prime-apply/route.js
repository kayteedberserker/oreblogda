import connectDB from '@/app/lib/mongodb'; // Adjust this to your actual Mongoose connection helper path
import Clan from '@/app/models/ClanModel';
import { NextResponse } from 'next/server';

export async function POST(request, { params }) {
    try {
        await connectDB();
        const { tag } = await params;
        console.log(tag)
        const { requestedLevel } = await request.json();

        if (![1, 2, 3].includes(Number(requestedLevel))) {
            return NextResponse.json(
                { success: false, message: "Invalid Prime level selected. Choose between 1, 2, or 3." },
                { status: 400 }
            );
        }

        const clan = await Clan.findOne({ tag: tag });
        if (!clan) {
            return NextResponse.json(
                { success: false, message: "Clan not found." },
                { status: 404 }
            );
        }

        clan.primeApplication = {
            status: 'pending',
            requestedLevel: 1,
            appliedAt: new Date()
        };

        await clan.save();

        return NextResponse.json({
            success: true,
            message: `Application submitted successfully for Prime Level 1!`,
            primeApplication: clan.primeApplication
        });
    } catch (error) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}
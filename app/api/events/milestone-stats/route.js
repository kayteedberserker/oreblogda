import connectDB from '@/app/lib/mongodb';
import MobileUser from '@/app/models/MobileUserModel';
import { NextResponse } from 'next/server';

export async function GET() {
    try {
        await connectDB()
        const totalUsers = await MobileUser.countDocuments()

        return NextResponse.json({
            success: true,
            totalUsers: totalUsers,
            targetGoal: 400,
            remaining: Math.max(0, 400 - totalUsers)
        });
    } catch (error) {
        return NextResponse.json({ success: false, totalUsers: 379 }, { status: 500 });
    }
}
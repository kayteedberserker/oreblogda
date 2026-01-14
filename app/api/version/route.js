import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/app/lib/mongodb';
import MobileUser from '@/app/models/MobileUserModel';
import { sendPushNotification } from '@/app/lib/pushNotifications';

// Define the Schema
const VersionSchema = new mongoose.Schema({
  key: { type: String, default: 'latest_app_version' },
  version: { type: String, required: true },
  critical: { type: Boolean, default: false },
}, { timestamps: true });

const VersionModel = mongoose.models.Version || mongoose.model('Version', VersionSchema);

// Helper for CORS compatibility
function addCorsHeaders(response) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
    return response;
}

export async function OPTIONS() {
    return addCorsHeaders(new NextResponse(null, { status: 204 }));
}

// GET: Fetch current version for the app
export async function GET() {
    await connectDB();
    try {
        const config = await VersionModel.findOne({ key: 'latest_app_version' });
        const res = NextResponse.json(config || { version: "1.0.0", critical: false });
        return addCorsHeaders(res);
    } catch (error) {
        return addCorsHeaders(NextResponse.json({ error: "Failed to fetch version" }, { status: 500 }));
    }
}

// POST: Update version and notify all users
export async function POST(req) {
    await connectDB();
    try {
        const body = await req.json();
        const { version, critical } = body;

        // 1. Update/Create the version record
        const updated = await VersionModel.findOneAndUpdate(
            { key: 'latest_app_version' },
            { version, critical },
            { upsert: true, new: true }
        );

        
        // 2. Fetch all mobile users with a push token


         const mobileUsers = await MobileUser.find(
            { pushToken: { $exists: true, $ne: null } },
            "pushToken"
        );


      
        // 3. Notify them using your established loop pattern
        if (mobileUsers.length > 0) {
            const title = critical ? "🚀 Critical System Update" : "✨ New Update Available";
            const message = `Version ${version} is now available. Please update to ensure system stability.`;

            for (const user of mobileUsers) {
                try {
                    await sendPushNotification(
                        user.pushToken,
                        title,
                        message,
                        { type: "version_update", version: version }
                    );
                } catch (err) {
                    console.error("Push notify user failed during version update:", err);
                }
            }
        }


      
        const res = NextResponse.json({ 
            success: true, 
            data: updated, 
            notifiedCount: mobileUsers.length 
        });
        return addCorsHeaders(res);

    } catch (err) {
        console.error("Version POST error:", err);
        return addCorsHeaders(NextResponse.json({ message: "Server error" }, { status: 500 }));
    }
}

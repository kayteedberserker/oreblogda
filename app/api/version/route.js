import connectDB from '@/app/lib/mongodb';
import { sendPushNotification } from '@/app/lib/pushNotifications';
import MobileUser from '@/app/models/MobileUserModel';
import mongoose from 'mongoose';
import { NextResponse } from 'next/server';

// Define the Schema - keeping it flexible with separate fields for the app to consume easily
const VersionSchema = new mongoose.Schema({
    key: { type: String, default: 'latest_app_version' },
    appVersion: { type: String, required: true },
    runtimeVersion: { type: String, required: true },
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
        // Return separated fields so the RN app can easily compare
        const res = NextResponse.json(config || { appVersion: "1.0.0", runtimeVersion: "v1", critical: false });
        return addCorsHeaders(res);
    } catch (error) {
        return addCorsHeaders(NextResponse.json({ error: "Failed to fetch version" }, { status: 500 }));
    }
}

// POST: Receives "appVersion,runtimeVersion" and splits them
export async function POST(req) {
    await connectDB();
    try {
        const body = await req.json();
        const { version, critical } = body; // "version" expected as "2.1.2,v5"

        // --- SPLITTING LOGIC ---
        let appV = "1.0.0";
        let runV = "v1";

        if (version && version.includes(',')) {
            const parts = version.split(',');
            appV = parts[0].trim();
            runV = parts[1].trim();
        } else {
            // Fallback if someone forgets the comma
            appV = version || "1.0.0";
        }

        // 1. Update/Create the version record with split values
        const updated = await VersionModel.findOneAndUpdate(
            { key: 'latest_app_version' },
            {
                appVersion: appV,
                runtimeVersion: runV,
                critical: critical
            },
            { upsert: true, new: true }
        );

        let mobileUsers = [];

        // 2. Fetch users for notification if critical
        if (critical) {
            mobileUsers = await MobileUser.find(
                { pushToken: { $exists: true, $ne: null } },
                "pushToken"
            );

            // 3. Notify them
            if (mobileUsers.length > 0) {
                const title = "🚀 Critical System Update";
                const message = `New System Patch ${appV} is ready. Please update to avoid connection loss.`;

                for (const user of mobileUsers) {
                    try {
                        await sendPushNotification(
                            user.pushToken,
                            title,
                            message,
                            { type: "version_update", appVersion: appV, runtimeVersion: runV }
                        );
                    } catch (err) {
                        console.error("Push notify user failed:", err);
                    }
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
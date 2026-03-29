import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";

// ============================================================================
// 📡 GET: Fetch Active Pills (Global + Targeted)
// ============================================================================
export async function GET(req) {
    try {
        await connectDB();
        
        // Extract targeting parameters from the URL
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get("userId");
        const clanId = searchParams.get("clanId");
        
        const now = new Date();

        // ⚡️ Build the Audience Array
        // Everyone always gets 'global' messages
        const audienceConditions = [{ targetAudience: 'global' }];

        // If the frontend passed a userId, check for their personal messages
        if (userId) {
            audienceConditions.push({ targetAudience: 'user', targetId: userId });
        }

        // If the frontend passed a clanId, check for clan-wide broadcasts
        if (clanId) {
            audienceConditions.push({ targetAudience: 'clan', targetId: clanId });
        }

        // ⚡️ The Master Query
        const activePills = await MessagePillModel.find({
            isActive: true,
            // Use $and to combine the expiration logic with the audience logic safely
            $and: [
                { 
                    $or: [
                        { expiresAt: null }, 
                        { expiresAt: { $gt: now } } 
                    ] 
                },
                { 
                    $or: audienceConditions 
                }
            ]
        })
        .sort({ priority: -1, createdAt: -1 }) // Highest priority first, then newest
        .limit(5) // Max 5 to keep the UI clean
        .lean();

        return NextResponse.json({ success: true, pills: activePills }, { status: 200 });

    } catch (err) {
        console.error("MessagePill Fetch Error:", err);
        return NextResponse.json({ success: false, message: "Signal Error" }, { status: 500 });
    }
}

// ============================================================================
// ✍️ POST: Create a New Message Pill (Admin or System Triggered)
// ============================================================================
import { createMessagePill } from "@/app/lib/messagePillService";
import MessagePillModel from "@/app/models/MessagePillModel";

export async function POST(req) {
    try {
        const body = await req.json();
        
        if (!body.text) {
            return NextResponse.json({ success: false, message: "Text is required" }, { status: 400 });
        }

        // Just pass the body directly to your new service!
        const newPill = await createMessagePill(body);

        if (!newPill) throw new Error("Service returned null");

        return NextResponse.json({ success: true, pill: newPill }, { status: 201 });

    } catch (err) {
        return NextResponse.json({ success: false, message: "Creation Error" }, { status: 500 });
    }
}
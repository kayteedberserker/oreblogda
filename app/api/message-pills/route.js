import connectDB from "@/app/lib/mongodb";
import { NextResponse } from "next/server";

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

        // ⚡️ The Master Query - Upgraded to Aggregation Pipeline for Deduplication
        const activePills = await MessagePillModel.aggregate([
            // 1. Filter out expired, inactive, and wrong audience
            {
                $match: {
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
                }
            },
            // 2. Sort by priority and newest first so $first picks the best one in the group
            {
                $sort: { priority: -1, createdAt: -1 }
            },
            // 3. Group by our dynamic condition (groupId OR type+link)
            {
                $group: {
                    _id: {
                        $cond: {
                            // If groupId exists and is not an empty string, use it as the unique key
                            if: { $and: [{ $ne: ["$groupId", null] }, { $ne: ["$groupId", ""] }] },
                            then: { $concat: ["group_", "$groupId"] },
                            // Else fallback to grouping by type and link (defaulting link to "nolink" if null)
                            else: { $concat: ["typelink_", "$type", "_", { $ifNull: ["$link", "nolink"] }] }
                        }
                    },
                    // Grabs the highest priority/newest document for this group
                    doc: { $first: "$$ROOT" }
                }
            },
            // 4. Flatten the document structure back to normal
            {
                $replaceRoot: { newRoot: "$doc" }
            },
            // 5. Re-sort the final unique list because $group messes up the original sort order
            {
                $sort: { priority: -1, createdAt: -1 }
            },
            // 6. Max 25 to keep the UI clean
            {
                $limit: 25
            }
        ]);

        // Note: Aggregation returns plain JavaScript objects, so no need for .lean()
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
import connectDB from "@/app/lib/mongodb";
import MobileUser from '@/app/models/MobileUserModel';
import Post from '@/app/models/PostModel'; // ⚡️ Ensure this path matches your Post schema file
import { NextResponse } from 'next/server';

// Server-side source of truth for raw event rewards
const RAW_EVENTS_DB = {
    "claim-3k-posts-event": {
        rewards: {
            oc: 100,
            mysteryItem: true,
            title: { name: "The First 3000" } // Tier is omitted here because it's calculated dynamically!
        }
    }
};

export async function POST(request) {
    await connectDB();

    try {
        const body = await request.json();
        const { eventId, deviceId, userId } = body;

        if (!eventId || !deviceId) {
            return NextResponse.json({ error: 'Missing required payload parameters' }, { status: 400 });
        }

        // 1. Verify the event is currently active/valid on the server
        const eventConfig = RAW_EVENTS_DB[eventId];
        if (!eventConfig) {
            return NextResponse.json({ error: 'Event has archived or does not exist.' }, { status: 404 });
        }

        // 2. Fetch the user document
        const user = await MobileUser.findOne({ deviceId });
        if (!user) {
            return NextResponse.json({ error: 'User link not found.' }, { status: 404 });
        }

        // 3. 🛡️ Check if already claimed using your embedded array
        const alreadyClaimed = user.claimedEvents?.some(e => e.eventId === eventId);
        if (alreadyClaimed) {
            return NextResponse.json({ error: 'Payload already acquired by this system link.' }, { status: 403 });
        }

        // 4. ⚡️ THE MYSTERY ITEM LOGIC: Dynamic Tier Calculation
        // We use $or to safely catch posts whether they were saved with the new ObjectId or the legacy deviceId
        const postCount = await Post.countDocuments({
            $or: [
                { authorUserId: user._id },
                { authorFingerprint: deviceId },
                { authorId: deviceId }
            ]
        });

        let calculatedTier = "COMMON";
        if (postCount >= 100) {
            calculatedTier = "LEGENDARY";
        } else if (postCount >= 10) {
            calculatedTier = "EPIC";
        } else if (postCount >= 1) {
            calculatedTier = "RARE";
        }

        // 5. Extract and Apply Rewards
        const { oc, title } = eventConfig.rewards;
        let grantedOc = 0;
        let grantedTitle = null;

        // 💰 Apply Coin Updates + Append to Transaction History
        if (oc) {
            user.coins = (user.coins || 0) + oc;
            grantedOc = oc;

            user.coinTransactionHistory.push({
                action: "claim",
                type: "OC",
                amount: oc,
                date: new Date()
            });
        }

        // 🎭 Apply Dynamic Title Updates
        if (title) {
            const finalTitleName = title.name;
            const ownsTitle = user.unlockedTitles?.some(t => t.name.toLowerCase() === finalTitleName.toLowerCase());

            if (!ownsTitle) {
                const newTitle = {
                    name: finalTitleName,
                    tier: calculatedTier
                };

                // Add to unlocked inventory
                user.unlockedTitles.push(newTitle);
                grantedTitle = newTitle;

                // ⚡️ Auto-equip if they don't have a title currently active
                if (!user.equippedTitle || !user.equippedTitle.name) {
                    user.equippedTitle = newTitle;
                }
            }
        }

        // 🔒 Mark the event as claimed so they can't double-dip
        user.claimedEvents.push({
            eventId: eventId,
            claimedAt: new Date()
        });

        // Save everything atomically
        await user.save();

        return NextResponse.json({
            success: true,
            message: 'Rewards sync completed!',
            granted: {
                oc: grantedOc,
                title: grantedTitle // Returns the full object so the frontend knows which tier to unveil!
            }
        });

    } catch (error) {
        console.error("Critical error during event payload extraction:", error);
        return NextResponse.json({ error: 'Internal system error' }, { status: 500 });
    }
}
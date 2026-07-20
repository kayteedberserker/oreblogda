import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollower";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import ShoutoutEvent from "@/app/models/ShoutoutEvent";
import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

// ☁️ CLOUDINARY CONFIGURATION
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function POST(req) {
    await connectDB();
    try {
        const body = await req.json();
        const { clanId, title, description, externalLink, durationHours, media, visibility } = body;

        const deviceId = req.headers.get("x-user-deviceId");

        if (!deviceId) return NextResponse.json({ message: "Authentication missing." }, { status: 401 });
        if (!clanId || !title || !description) return NextResponse.json({ message: "Missing required parameters." }, { status: 400 });

        const targetClan = await Clan.findOne({ tag: clanId.toUpperCase() }).lean();
        const targetUser = await MobileUser.findOne({ deviceId }).lean();

        if (!targetClan) return NextResponse.json({ message: "Clan not found." }, { status: 404 });
        if (!targetUser) return NextResponse.json({ message: "User profile not found." }, { status: 404 });

        // ⚡️ FIXED: Real Role Authentication Check
        // Explicitly check if the authenticated user's ID matches the clan's leader or viceLeader fields
        const isLeader = targetClan.leader?.toString() === targetUser._id.toString();
        const isViceLeader = targetClan.viceLeader?.toString() === targetUser._id.toString();

        if (!isLeader && !isViceLeader) {
            return NextResponse.json({ message: "Access Denied: Only Clan Leaders and Vice Leaders hold creation clearances." }, { status: 403 });
        }

        if (!targetClan.verifiedClan) {
            return NextResponse.json({ message: "This feature is currently locked for Prime Clans only." }, { status: 403 });
        }

        const now = new Date();

        // ⚡️ LIMIT CHECK: MAX 5 PUBLIC SHOUTOUTS GLOBALLY
        if (visibility?.toUpperCase() === "PUBLIC") {
            const activePublicCount = await ShoutoutEvent.countDocuments({
                visibility: "PUBLIC",
                expiresAt: { $gt: now }
            });
            if (activePublicCount >= 5) {
                return NextResponse.json({ message: "The global limit for public events (5) has been reached. Try again later or set visibility to PRIVATE." }, { status: 429 });
            }
        }

        const activeEventConflict = await ShoutoutEvent.findOne({
            clanId: clanId.toUpperCase(),
            expiresAt: { $gt: now }
        }).lean();

        if (activeEventConflict) {
            return NextResponse.json({ message: "Your Clan already has an active shoutout." }, { status: 409 });
        }

        let finalMediaUrl = media?.url || null;
        if (finalMediaUrl && finalMediaUrl.startsWith("data:image")) {
            try {
                const uploadResponse = await cloudinary.uploader.upload(finalMediaUrl, {
                    folder: "oreblogda_events",
                    resource_type: "image",
                });
                finalMediaUrl = uploadResponse.secure_url;
            } catch (cloudErr) {
                console.error("Cloudinary upload failed:", cloudErr);
                return NextResponse.json({ message: "Failed to process image upload." }, { status: 500 });
            }
        }

        const hours = parseInt(durationHours) || 3;
        const expirationTimeline = new Date(Date.now() + hours * 60 * 60 * 1000);
        const targetVisibility = visibility?.toUpperCase() === "PRIVATE" ? "PRIVATE" : "PUBLIC";

        const newShoutout = await ShoutoutEvent.create({
            clanId: clanId.toUpperCase(),
            clanName: targetClan.name,
            leaderDeviceId: deviceId,
            moderatedBy: [deviceId],
            title,
            description,
            externalLink: externalLink || null,
            media: {
                url: finalMediaUrl,
                type: finalMediaUrl ? "image" : null
            },
            visibility: targetVisibility,
            expiresAt: expirationTimeline,
            acknowledgeCount: 0,
            acknowledgedBy: []
        });

        return NextResponse.json({
            success: true,
            message: "Shoutout created successfully.",
            data: newShoutout
        }, { status: 201 });

    } catch (err) {
        console.error("⛔ SHOUTOUT_CREATION_CRASH:", err);
        return NextResponse.json({ message: "Server error during creation." }, { status: 500 });
    }
}

export async function PATCH(req) {
    await connectDB();
    try {
        const body = await req.json();
        const { eventId, action, ...payload } = body;

        const deviceId = req.headers.get("x-user-deviceId");

        if (!deviceId) return NextResponse.json({ message: "Authentication missing." }, { status: 401 });
        if (!eventId || !action) return NextResponse.json({ message: "Missing core transaction parameters." }, { status: 400 });

        const shoutout = await ShoutoutEvent.findById(eventId);
        if (!shoutout) return NextResponse.json({ message: "Shoutout event not found." }, { status: 404 });

        const now = new Date();
        if (shoutout.expiresAt <= now && action.toUpperCase() !== "TERMINATE") {
            return NextResponse.json({ message: "This event has already expired." }, { status: 410 });
        }

        const isLeader = shoutout.leaderDeviceId === deviceId;
        const isModerator = shoutout.moderatedBy.includes(deviceId);

        switch (action.toUpperCase()) {
            case "UPDATE_MODERATORS": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });

                if (payload.moderators && Array.isArray(payload.moderators)) {
                    let newMods = payload.moderators;
                    if (!newMods.includes(shoutout.leaderDeviceId)) {
                        newMods.push(shoutout.leaderDeviceId);
                    }
                    shoutout.moderatedBy = newMods;
                    await shoutout.save();
                }
                return NextResponse.json({ success: true, message: "Moderators updated successfully." }, { status: 200 });
            }

            case "ACKNOWLEDGE": {
                if (shoutout.visibility === "PRIVATE") {
                    const isFollower = await ClanFollower.findOne({ userId: deviceId, clanTag: shoutout.clanId }).lean();
                    const targetClan = await Clan.findOne({ tag: shoutout.clanId }).lean();
                    const isMember = targetClan?.members?.includes(deviceId) || targetClan?.leader === deviceId || targetClan?.viceLeader === deviceId;

                    if (!isFollower && !isMember) {
                        return NextResponse.json({ message: "Access Denied: Private event." }, { status: 403 });
                    }
                }

                const alreadyAcknowledged = shoutout.acknowledgedBy.includes(deviceId);
                if (alreadyAcknowledged) {
                    return NextResponse.json({ message: "Already acknowledged." }, { status: 409 });
                }

                shoutout.acknowledgedBy.push(deviceId);
                shoutout.acknowledgeCount += 1;

                await shoutout.save();
                return NextResponse.json({
                    success: true,
                    acknowledgeCount: shoutout.acknowledgeCount,
                    hasAcknowledged: true
                }, { status: 200 });
            }

            case "TERMINATE": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });

                shoutout.expiresAt = new Date();
                await shoutout.save();
                return NextResponse.json({ success: true, message: "Shoutout ended successfully." }, { status: 200 });
            }

            // ⚡️ UPDATED: Time modification completely stripped out
            case "EDIT": {
                if (!isLeader && !isModerator) return NextResponse.json({ message: "Access Denied." }, { status: 403 });

                const { title, description, externalLink, media } = payload;

                if (title) shoutout.title = title;
                if (description) shoutout.description = description;
                if (externalLink !== undefined) shoutout.externalLink = externalLink;

                if (media && media.url) {
                    if (media.url.startsWith("data:image")) {
                        try {
                            const uploadResponse = await cloudinary.uploader.upload(media.url, {
                                folder: "oreblogda_events",
                                resource_type: "image",
                            });
                            shoutout.media = { url: uploadResponse.secure_url, type: "image" };
                        } catch (cloudErr) {
                            console.error("Cloudinary update failed:", cloudErr);
                            return NextResponse.json({ message: "Failed to process image upload." }, { status: 500 });
                        }
                    }
                } else if (media === null) {
                    shoutout.media = { url: null, type: null };
                }

                await shoutout.save();

                return NextResponse.json({
                    success: true,
                    message: "Changes saved successfully.",
                    data: shoutout
                }, { status: 200 });
            }

            default:
                return NextResponse.json({ message: "Unknown action." }, { status: 400 });
        }
    } catch (err) {
        console.error("⛔ SHOUTOUT_PATCH_CRASH:", err);
        return NextResponse.json({ message: "Server error during update." }, { status: 500 });
    }
}
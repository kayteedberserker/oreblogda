import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollower";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import ShoutoutEvent from "@/app/models/ShoutoutEvent";
import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

cloudinary.config({
    cloud_name:
        process.env.CLOUDINARY_CLOUD_NAME
        || process.env
            .NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME,
    api_key:
        process.env.CLOUDINARY_API_KEY,
    api_secret:
        process.env.CLOUDINARY_API_SECRET,
});

const moderatorFilter = deviceId => ({
    $or: [
        { leaderDeviceId: deviceId },
        { moderatedBy: deviceId },
    ],
});

const normalizeDeviceIds = values => [
    ...new Set(
        (Array.isArray(values) ? values : [])
            .map(value => String(value || "").trim())
            .filter(Boolean)
    ),
];

const uploadShoutoutMedia = async dataUrl => {
    const uploadResponse =
        await cloudinary.uploader.upload(
            dataUrl,
            {
                folder: "oreblogda_events",
                resource_type: "image",
            }
        );

    return {
        url: uploadResponse.secure_url,
        publicId:
            uploadResponse.public_id || null,
    };
};

const cleanupCloudinaryUpload =
    async publicId => {
        if (!publicId) return;

        try {
            await cloudinary.uploader.destroy(
                publicId,
                {
                    resource_type: "image",
                }
            );
        } catch (error) {
            console.error(
                "Failed to clean unused shoutout media:",
                error
            );
        }
    };

const canAccessPrivateClanEvent = async ({
    deviceId,
    clanTag,
}) => {
    const user = await MobileUser.findOne({
        deviceId,
    })
        .select("_id")
        .lean();

    const [follower, clan] = await Promise.all([
        ClanFollower.findOne({
            userId: deviceId,
            clanTag,
        })
            .select("_id")
            .lean(),
        Clan.findOne({
            tag: String(clanTag || "").toUpperCase(),
        })
            .select("leader viceLeader members")
            .lean(),
    ]);

    if (follower) return true;
    if (!user?._id || !clan) return false;

    const userId = user._id.toString();

    return (
        clan.leader?.toString() === userId
        || clan.viceLeader?.toString() === userId
        || (clan.members || []).some(
            memberId =>
                memberId?.toString() === userId
        )
    );
};

export async function POST(req) {
    await connectDB();

    let uploadedPublicId = null;

    try {
        const body = await req.json();

        const {
            clanId,
            title,
            description,
            externalLink,
            durationHours,
            media,
            visibility,
        } = body;

        const deviceId =
            req.headers.get("x-user-deviceId");

        if (!deviceId) {
            return NextResponse.json(
                {
                    message:
                        "Authentication missing.",
                },
                { status: 401 }
            );
        }

        if (
            !clanId
            || !title
            || !description
        ) {
            return NextResponse.json(
                {
                    message:
                        "Missing required parameters.",
                },
                { status: 400 }
            );
        }

        const normalizedClanId =
            String(clanId).toUpperCase();

        const [targetClan, targetUser] =
            await Promise.all([
                Clan.findOne({
                    tag: normalizedClanId,
                }).lean(),
                MobileUser.findOne({
                    deviceId,
                }).lean(),
            ]);

        if (!targetClan) {
            return NextResponse.json(
                { message: "Clan not found." },
                { status: 404 }
            );
        }

        if (!targetUser) {
            return NextResponse.json(
                {
                    message:
                        "User profile not found.",
                },
                { status: 404 }
            );
        }

        const isLeader =
            targetClan.leader?.toString()
            === targetUser._id.toString();

        const isViceLeader =
            targetClan.viceLeader?.toString()
            === targetUser._id.toString();

        if (!isLeader && !isViceLeader) {
            return NextResponse.json(
                {
                    message:
                        "Access Denied: Only Clan Leaders and Vice Leaders hold creation clearances.",
                },
                { status: 403 }
            );
        }

        if (!targetClan.verifiedClan) {
            return NextResponse.json(
                {
                    message:
                        "This feature is currently locked for Prime Clans only.",
                },
                { status: 403 }
            );
        }

        const now = new Date();
        const targetVisibility =
            visibility?.toUpperCase() === "PRIVATE"
                ? "PRIVATE"
                : "PUBLIC";

        // Fast UX check. Strict cross-document enforcement requires the
        // model index/slot strategy documented in the included notes.
        if (targetVisibility === "PUBLIC") {
            const activePublicCount =
                await ShoutoutEvent.countDocuments({
                    visibility: "PUBLIC",
                    expiresAt: {
                        $gt: now,
                    },
                });

            if (activePublicCount >= 5) {
                return NextResponse.json(
                    {
                        message:
                            "The global limit for public events (5) has been reached. Try again later or set visibility to PRIVATE.",
                    },
                    { status: 429 }
                );
            }
        }

        const activeEventConflict =
            await ShoutoutEvent.findOne({
                clanId: normalizedClanId,
                expiresAt: {
                    $gt: now,
                },
            })
                .select("_id")
                .lean();

        if (activeEventConflict) {
            return NextResponse.json(
                {
                    message:
                        "Your Clan already has an active shoutout.",
                },
                { status: 409 }
            );
        }

        let finalMediaUrl =
            media?.url || null;

        if (
            typeof finalMediaUrl === "string"
            && finalMediaUrl.startsWith(
                "data:image"
            )
        ) {
            const upload =
                await uploadShoutoutMedia(
                    finalMediaUrl
                );

            finalMediaUrl = upload.url;
            uploadedPublicId =
                upload.publicId;
        }

        const parsedHours =
            Number.parseInt(durationHours, 10);

        const hours = Number.isFinite(
            parsedHours
        )
            ? Math.min(
                Math.max(parsedHours, 1),
                24
            )
            : 3;

        const expirationTimeline =
            new Date(
                Date.now()
                + hours
                * 60
                * 60
                * 1000
            );

        const newShoutout =
            await ShoutoutEvent.create({
                clanId: normalizedClanId,
                clanName: targetClan.name,
                leaderDeviceId: deviceId,
                moderatedBy: [deviceId],
                title: String(title).trim(),
                description:
                    String(description).trim(),
                externalLink:
                    externalLink || null,
                media: {
                    url: finalMediaUrl,
                    type:
                        finalMediaUrl
                            ? "image"
                            : null,
                },
                visibility:
                    targetVisibility,
                expiresAt:
                    expirationTimeline,
                acknowledgeCount: 0,
                acknowledgedBy: [],
            });

        uploadedPublicId = null;

        return NextResponse.json(
            {
                success: true,
                message:
                    "Shoutout created successfully.",
                data: newShoutout,
            },
            { status: 201 }
        );
    } catch (error) {
        await cleanupCloudinaryUpload(
            uploadedPublicId
        );

        if (error?.code === 11000) {
            return NextResponse.json(
                {
                    message:
                        "Your clan already has an active shoutout or the public event slot was claimed concurrently.",
                    code:
                        "EVENT_SLOT_CONFLICT",
                },
                { status: 409 }
            );
        }

        console.error(
            "⛔ SHOUTOUT_CREATION_CRASH:",
            error
        );

        return NextResponse.json(
            {
                message:
                    "Server error during creation.",
            },
            { status: 500 }
        );
    }
}

export async function PATCH(req) {
    await connectDB();

    try {
        const body = await req.json();

        const {
            eventId,
            action,
            ...payload
        } = body;

        const deviceId =
            req.headers.get("x-user-deviceId");

        if (!deviceId) {
            return NextResponse.json(
                {
                    message:
                        "Authentication missing.",
                },
                { status: 401 }
            );
        }

        if (!eventId || !action) {
            return NextResponse.json(
                {
                    message:
                        "Missing core transaction parameters.",
                },
                { status: 400 }
            );
        }

        const now = new Date();

        const snapshot =
            await ShoutoutEvent.findById(
                eventId
            )
                .select(
                    "leaderDeviceId moderatedBy visibility clanId expiresAt acknowledgedBy"
                )
                .lean();

        if (!snapshot) {
            return NextResponse.json(
                {
                    message:
                        "Shoutout event not found.",
                },
                { status: 404 }
            );
        }

        const isLeader =
            snapshot.leaderDeviceId
            === deviceId;

        const isModerator =
            snapshot.moderatedBy?.includes(
                deviceId
            );

        const normalizedAction =
            String(action).toUpperCase();

        if (
            snapshot.expiresAt <= now
            && normalizedAction
            !== "TERMINATE"
        ) {
            return NextResponse.json(
                {
                    message:
                        "This event has already expired.",
                },
                { status: 410 }
            );
        }

        switch (normalizedAction) {
            case "UPDATE_MODERATORS": {
                if (
                    !isLeader
                    && !isModerator
                ) {
                    return NextResponse.json(
                        {
                            message:
                                "Access Denied.",
                        },
                        { status: 403 }
                    );
                }

                if (
                    !Array.isArray(
                        payload.moderators
                    )
                ) {
                    return NextResponse.json(
                        {
                            message:
                                "Moderators must be an array.",
                        },
                        { status: 400 }
                    );
                }

                const moderators =
                    normalizeDeviceIds([
                        ...payload.moderators,
                        snapshot.leaderDeviceId,
                    ]);

                const updated =
                    await ShoutoutEvent.findOneAndUpdate(
                        {
                            _id: eventId,
                            expiresAt: {
                                $gt: now,
                            },
                            ...moderatorFilter(
                                deviceId
                            ),
                        },
                        {
                            $set: {
                                moderatedBy:
                                    moderators,
                            },
                        },
                        { new: true }
                    )
                        .select("_id")
                        .lean();

                if (!updated) {
                    return NextResponse.json(
                        {
                            message:
                                "The shoutout changed or your access was revoked. Refresh.",
                            code:
                                "EVENT_STATE_CONFLICT",
                        },
                        { status: 409 }
                    );
                }

                return NextResponse.json(
                    {
                        success: true,
                        message:
                            "Moderators updated successfully.",
                    },
                    { status: 200 }
                );
            }

            case "ACKNOWLEDGE": {
                if (
                    snapshot.visibility
                    === "PRIVATE"
                ) {
                    const allowed =
                        await canAccessPrivateClanEvent({
                            deviceId,
                            clanTag:
                                snapshot.clanId,
                        });

                    if (!allowed) {
                        return NextResponse.json(
                            {
                                message:
                                    "Access Denied: Private event.",
                            },
                            { status: 403 }
                        );
                    }
                }

                const updated =
                    await ShoutoutEvent.findOneAndUpdate(
                        {
                            _id: eventId,
                            expiresAt: {
                                $gt: now,
                            },
                            acknowledgedBy: {
                                $ne: deviceId,
                            },
                        },
                        {
                            $addToSet: {
                                acknowledgedBy:
                                    deviceId,
                            },
                            $inc: {
                                acknowledgeCount: 1,
                            },
                        },
                        {
                            new: true,
                        }
                    )
                        .select(
                            "acknowledgeCount"
                        )
                        .lean();

                if (!updated) {
                    const latest =
                        await ShoutoutEvent.findById(
                            eventId
                        )
                            .select(
                                "expiresAt acknowledgedBy"
                            )
                            .lean();

                    if (!latest) {
                        return NextResponse.json(
                            {
                                message:
                                    "Shoutout event not found.",
                            },
                            { status: 404 }
                        );
                    }

                    if (
                        latest.acknowledgedBy
                            ?.includes(deviceId)
                    ) {
                        return NextResponse.json(
                            {
                                message:
                                    "Already acknowledged.",
                            },
                            { status: 409 }
                        );
                    }

                    return NextResponse.json(
                        {
                            message:
                                "This event has already expired.",
                        },
                        { status: 410 }
                    );
                }

                return NextResponse.json(
                    {
                        success: true,
                        acknowledgeCount:
                            updated.acknowledgeCount,
                        hasAcknowledged: true,
                    },
                    { status: 200 }
                );
            }

            case "TERMINATE": {
                if (
                    !isLeader
                    && !isModerator
                ) {
                    return NextResponse.json(
                        {
                            message:
                                "Access Denied.",
                        },
                        { status: 403 }
                    );
                }

                const updated =
                    await ShoutoutEvent.findOneAndUpdate(
                        {
                            _id: eventId,
                            ...moderatorFilter(
                                deviceId
                            ),
                        },
                        {
                            $set: {
                                expiresAt:
                                    new Date(),
                            },
                        },
                        { new: true }
                    )
                        .select("_id")
                        .lean();

                if (!updated) {
                    return NextResponse.json(
                        {
                            message:
                                "The shoutout changed or your access was revoked. Refresh.",
                            code:
                                "EVENT_STATE_CONFLICT",
                        },
                        { status: 409 }
                    );
                }

                return NextResponse.json(
                    {
                        success: true,
                        message:
                            "Shoutout ended successfully.",
                    },
                    { status: 200 }
                );
            }

            case "EDIT": {
                if (
                    !isLeader
                    && !isModerator
                ) {
                    return NextResponse.json(
                        {
                            message:
                                "Access Denied.",
                        },
                        { status: 403 }
                    );
                }

                const setChanges = {};
                let uploadedPublicId = null;

                if (payload.title !== undefined) {
                    setChanges.title =
                        String(payload.title).trim();
                }

                if (
                    payload.description
                    !== undefined
                ) {
                    setChanges.description =
                        String(
                            payload.description
                        ).trim();
                }

                if (
                    payload.externalLink
                    !== undefined
                ) {
                    setChanges.externalLink =
                        payload.externalLink
                        || null;
                }

                try {
                    if (payload.media === null) {
                        setChanges.media = {
                            url: null,
                            type: null,
                        };
                    } else if (
                        payload.media?.url
                    ) {
                        let mediaUrl =
                            payload.media.url;

                        if (
                            typeof mediaUrl
                            === "string"
                            && mediaUrl.startsWith(
                                "data:image"
                            )
                        ) {
                            const upload =
                                await uploadShoutoutMedia(
                                    mediaUrl
                                );

                            mediaUrl =
                                upload.url;
                            uploadedPublicId =
                                upload.publicId;
                        }

                        setChanges.media = {
                            url: mediaUrl,
                            type: "image",
                        };
                    }

                    if (
                        Object.keys(setChanges)
                            .length === 0
                    ) {
                        return NextResponse.json(
                            {
                                success: true,
                                message:
                                    "No changes supplied.",
                            },
                            { status: 200 }
                        );
                    }

                    const updated =
                        await ShoutoutEvent.findOneAndUpdate(
                            {
                                _id: eventId,
                                expiresAt: {
                                    $gt: now,
                                },
                                ...moderatorFilter(
                                    deviceId
                                ),
                            },
                            {
                                $set:
                                    setChanges,
                            },
                            {
                                new: true,
                                runValidators: true,
                            }
                        ).lean();

                    if (!updated) {
                        await cleanupCloudinaryUpload(
                            uploadedPublicId
                        );

                        return NextResponse.json(
                            {
                                message:
                                    "The shoutout changed, expired, or your access was revoked. Refresh.",
                                code:
                                    "EVENT_STATE_CONFLICT",
                            },
                            { status: 409 }
                        );
                    }

                    return NextResponse.json(
                        {
                            success: true,
                            message:
                                "Changes saved successfully.",
                            data: updated,
                        },
                        { status: 200 }
                    );
                } catch (error) {
                    await cleanupCloudinaryUpload(
                        uploadedPublicId
                    );
                    throw error;
                }
            }

            default:
                return NextResponse.json(
                    {
                        message:
                            "Unknown action.",
                    },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error(
            "⛔ SHOUTOUT_PATCH_CRASH:",
            error
        );

        return NextResponse.json(
            {
                message:
                    "Server error during update.",
            },
            { status: 500 }
        );
    }
}
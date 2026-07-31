import { sendPillParallel } from "@/app/lib/messagePillService";
import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

const MAX_CLAN_MESSAGES = 250;
const MAX_CLAN_MESSAGE_LENGTH = 1000;

const normalizeClanTag = tag =>
    String(tag || "").trim().toUpperCase();

const buildMembershipFilter = userId => ({
    $or: [
        { leader: userId },
        { viceLeader: userId },
        { members: userId },
    ],
});

const verifyClanMembership = (user, clan) => {
    const userId = user?._id;

    if (!userId || !clan) return false;

    const isLeader =
        clan.leader?.toString()
        === userId.toString();

    const isViceLeader =
        clan.viceLeader?.toString()
        === userId.toString();

    const isMember = Array.isArray(clan.members)
        && clan.members.some(
            memberId =>
                memberId?.toString()
                === userId.toString()
        );

    return isLeader || isViceLeader || isMember;
};

const getUniqueClanRecipientIds = (
    clan,
    senderUserId
) => {
    const senderId = String(senderUserId || "");
    const recipientIds = new Set();

    [
        clan?.leader,
        clan?.viceLeader,
        ...(Array.isArray(clan?.members)
            ? clan.members
            : []),
    ].forEach(value => {
        const id = value?.toString();

        if (id && id !== senderId) {
            recipientIds.add(id);
        }
    });

    return [...recipientIds];
};

const formatMessageForUser = (
    message,
    user,
    isClanLeader
) => {
    const plainMessage =
        typeof message?.toObject === "function"
            ? message.toObject()
            : { ...message };

    const isMyPost =
        plainMessage.authorUserId?.toString()
        === user._id.toString()
        || plainMessage.authorId
        === user.deviceId;

    return {
        ...plainMessage,
        isMyPost,
        canDelete:
            isMyPost
            || isClanLeader,
    };
};

export async function GET(req, { params }) {
    const { tag: rawTag } = await params;
    const tag = normalizeClanTag(rawTag);
    const deviceId =
        req.headers.get("x-user-deviceId")
        || "";

    if (!deviceId) {
        return NextResponse.json(
            {
                success: false,
                message: "Device ID identifier required",
            },
            { status: 401 }
        );
    }

    await connectDB();

    try {
        const user = await MobileUser.findOne({
            deviceId,
        }).select("_id deviceId");

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User not found",
                },
                { status: 404 }
            );
        }

        const clan = await Clan.findOne({
            tag,
        }).select(
            "messages leader viceLeader members"
        );

        if (!clan) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Clan not found",
                },
                { status: 404 }
            );
        }

        if (!verifyClanMembership(user, clan)) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Access Denied: You are not a member of this clan",
                },
                { status: 403 }
            );
        }

        const isClanLeader =
            clan.leader?.toString()
            === user._id.toString();

        const formattedMessages = (
            Array.isArray(clan.messages)
                ? clan.messages
                : []
        ).map(message =>
            formatMessageForUser(
                message,
                user,
                isClanLeader
            )
        );

        return NextResponse.json({
            success: true,
            messages: formattedMessages,
        });
    } catch (error) {
        console.error(
            "Clan Hall GET error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: error.message,
            },
            { status: 500 }
        );
    }
}

export async function POST(req, { params }) {
    const { tag: rawTag } = await params;
    const tag = normalizeClanTag(rawTag);
    const deviceId =
        req.headers.get("x-user-deviceId")
        || "";

    if (!deviceId) {
        return NextResponse.json(
            {
                success: false,
                message: "Device ID identifier required",
            },
            { status: 401 }
        );
    }

    await connectDB();

    try {
        const body = await req.json();

        const normalizedText =
            String(body?.text || "").trim();

        if (!normalizedText) {
            return NextResponse.json(
                {
                    success: false,
                    message: "Text is required",
                },
                { status: 400 }
            );
        }

        if (
            normalizedText.length
            > MAX_CLAN_MESSAGE_LENGTH
        ) {
            return NextResponse.json(
                {
                    success: false,
                    message:
                        `Message cannot exceed ${MAX_CLAN_MESSAGE_LENGTH} characters`,
                },
                { status: 400 }
            );
        }

        const user = await MobileUser.findOne({
            deviceId,
        }).select(
            "_id deviceId username profilePic"
        );

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User not found",
                },
                { status: 404 }
            );
        }

        const messageId =
            new mongoose.Types.ObjectId();

        const sentAt = new Date();

        const newMessage = {
            _id: messageId,
            authorId: user.deviceId,
            authorUserId: user._id,
            authorName:
                user.username || "Anonymous",
            text: normalizedText,
            replyToCommentId:
                body?.replyToCommentId || null,
            replyToName:
                body?.replyToName || null,
            replyToText:
                body?.replyToText || null,
            date: sentAt,
        };

        const updatedClan =
            await Clan.findOneAndUpdate(
                {
                    tag,
                    ...buildMembershipFilter(user._id),
                },
                {
                    $push: {
                        messages: {
                            $each: [newMessage],
                            $slice:
                                -MAX_CLAN_MESSAGES,
                        },
                    },
                },
                {
                    new: true,
                    runValidators: true,
                }
            ).select(
                "name tag leader viceLeader members"
            );

        if (!updatedClan) {
            const clanExists =
                await Clan.exists({ tag });

            return NextResponse.json(
                {
                    success: false,
                    message: clanExists
                        ? "Transmission Blocked: Non-member status"
                        : "Clan not found",
                },
                {
                    status: clanExists ? 403 : 404,
                }
            );
        }

        const recipientIds =
            getUniqueClanRecipientIds(
                updatedClan,
                user._id
            );

        try {
            let tokens = [];

            if (recipientIds.length > 0) {
                const recipients =
                    await MobileUser.find({
                        _id: {
                            $in: recipientIds,
                        },
                        pushToken: {
                            $exists: true,
                            $nin: [null, ""],
                        },
                    })
                        .select("pushToken")
                        .lean();

                tokens = [
                    ...new Set(
                        recipients
                            .map(
                                recipient =>
                                    recipient.pushToken
                            )
                            .filter(Boolean)
                    ),
                ];
            }

            const conversationId =
                `clan-hall:${updatedClan.tag}`;

            const senderAvatar =
                user.profilePic?.url || "";

            await sendPillParallel(
                tokens,
                `${updatedClan.name || "Clan"} Hall`,
                `${user.username || "Anonymous"}: ${normalizedText.slice(0, 160)}`,
                {
                    screen: "/clanprofile",
                    tab: "hall",
                    type: "clan_message",
                    notificationType:
                        "clan_message",
                    presentation:
                        "messaging",
                    notificationId:
                        `message:${conversationId}`,
                    conversationId,
                    conversationTitle:
                        `${updatedClan.name || "Clan"} Hall`,
                    clanTag:
                        updatedClan.tag,
                    senderName:
                        user.username
                        || "Anonymous",
                    senderId:
                        user._id.toString(),
                    senderAvatar,
                    authorPfp:
                        senderAvatar,
                    messageText:
                        normalizedText,
                    sentAt:
                        sentAt.getTime(),
                    isGroupConversation:
                        true,
                    groupId:
                        conversationId,
                },
                {
                    type: "clan_message",
                    targetAudience:
                        "clan",
                    targetId:
                        updatedClan.tag,
                    link:
                        "/clanprofile?tab=hall",
                    groupId:
                        conversationId,
                    priority: 4,
                    replaceExistingType:
                        true,
                }
            );
        } catch (notificationError) {
            console.error(
                "Clan Hall notification dispatch failed:",
                notificationError
            );
        }

        return NextResponse.json({
            success: true,
            message: {
                ...newMessage,
                isMyPost: true,
                canDelete: true,
            },
        });
    } catch (error) {
        console.error(
            "Clan Hall POST error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: error.message,
            },
            { status: 500 }
        );
    }
}

export async function DELETE(req, { params }) {
    const { tag: rawTag } = await params;
    const tag = normalizeClanTag(rawTag);
    const { searchParams } = new URL(req.url);
    const rawMessageId = searchParams.get("id");
    const deviceId =
        req.headers.get("x-user-deviceId")
        || "";

    if (!deviceId) {
        return NextResponse.json(
            {
                success: false,
                message: "Device ID identifier required",
            },
            { status: 401 }
        );
    }

    if (
        !rawMessageId
        || !mongoose.Types.ObjectId.isValid(
            rawMessageId
        )
    ) {
        return NextResponse.json(
            {
                success: false,
                message: "Valid message ID required",
            },
            { status: 400 }
        );
    }

    await connectDB();

    try {
        const user = await MobileUser.findOne({
            deviceId,
        }).select("_id deviceId");

        if (!user) {
            return NextResponse.json(
                {
                    success: false,
                    message: "User not found",
                },
                { status: 404 }
            );
        }

        const messageId =
            new mongoose.Types.ObjectId(
                rawMessageId
            );

        const updatedClan =
            await Clan.findOneAndUpdate(
                {
                    tag,
                    $and: [
                        buildMembershipFilter(
                            user._id
                        ),
                        {
                            $or: [
                                {
                                    leader:
                                        user._id,
                                },
                                {
                                    messages: {
                                        $elemMatch: {
                                            _id:
                                                messageId,
                                            $or: [
                                                {
                                                    authorUserId:
                                                        user._id,
                                                },
                                                {
                                                    authorId:
                                                        user.deviceId,
                                                },
                                            ],
                                        },
                                    },
                                },
                            ],
                        },
                    ],
                    "messages._id": messageId,
                },
                {
                    $pull: {
                        messages: {
                            _id: messageId,
                        },
                    },
                },
                {
                    new: true,
                }
            ).select("_id");

        if (!updatedClan) {
            const [
                clanExists,
                isMember,
                messageExists,
            ] = await Promise.all([
                Clan.exists({ tag }),
                Clan.exists({
                    tag,
                    ...buildMembershipFilter(
                        user._id
                    ),
                }),
                Clan.exists({
                    tag,
                    "messages._id":
                        messageId,
                }),
            ]);

            if (!clanExists) {
                return NextResponse.json(
                    {
                        success: false,
                        message: "Clan not found",
                    },
                    { status: 404 }
                );
            }

            if (!isMember) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Transmission Blocked: Non-member status",
                    },
                    { status: 403 }
                );
            }

            if (!messageExists) {
                return NextResponse.json(
                    {
                        success: false,
                        message:
                            "Message archive not found",
                    },
                    { status: 404 }
                );
            }

            return NextResponse.json(
                {
                    success: false,
                    message:
                        "Purge Denied: Unauthorized access clearances",
                },
                { status: 403 }
            );
        }

        return NextResponse.json({
            success: true,
            message:
                "Message deleted successfully",
        });
    } catch (error) {
        console.error(
            "Clan Hall DELETE error:",
            error
        );

        return NextResponse.json(
            {
                success: false,
                message: error.message,
            },
            { status: 500 }
        );
    }
}
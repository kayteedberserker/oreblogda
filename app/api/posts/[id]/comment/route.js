import { awardAura } from "@/app/lib/auraManager";
import { awardClanPoints } from "@/app/lib/clanService";
import { sendPillParallel } from "@/app/lib/messagePillService";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import Notification from "@/app/models/NotificationModel";
import Post from "@/app/models/PostModel";
import Report from "@/app/models/ReportModel";
import StickerModel from "@/app/models/StickerModel";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const DISCUSSION_MIN_REPLIES = 5;
const DISCUSSION_MIN_PARTICIPANTS = 2;
const MAX_COMMENT_IMAGE_BYTES = 10 * 1024 * 1024;
const HIDDEN_COMMENT_TEXT =
    "[This comment has been hidden pending admin moderation review.]";

const shouldNotifyMilestone = count => {
    if (count <= 5) return true;
    if (count <= 50) return count % 10 === 0;
    return count % 50 === 0;
};

const getCommentMessagePreview = ({
    stickerId,
    imageUrl,
    text,
}) => {
    if (stickerId) return "[Sticker]";
    if (imageUrl) return "[Image]";

    const normalized = String(text || "").trim();
    return normalized || "[Message]";
};

const createDiscussionConversationId = (
    postId,
    rootCommentId = null
) => (
    rootCommentId
        ? `discussion:${postId}:${rootCommentId}`
        : `post-discussion:${postId}`
);

const getSearchFilter = id => (
    String(id).includes("-")
        ? { slug: id }
        : { _id: id }
);

const toComparableId = value =>
    value?._id?.toString?.()
    || value?.toString?.()
    || String(value || "");

const isSameId = (left, right) =>
    Boolean(left && right)
    && toComparableId(left) === toComparableId(right);

const toPlainComment = comment => {
    if (!comment) return null;

    return typeof comment.toObject === "function"
        ? comment.toObject()
        : { ...comment };
};

const findRootComment = (comments, rootCommentId) => (
    (Array.isArray(comments) ? comments : []).find(
        comment => isSameId(comment?._id, rootCommentId)
    ) || null
);

const findReplyInRoot = (rootComment, replyId) => (
    (Array.isArray(rootComment?.replies)
        ? rootComment.replies
        : []
    ).find(reply => isSameId(reply?._id, replyId)) || null
);

const findCommentOrReply = (comments, targetId) => {
    const roots = Array.isArray(comments) ? comments : [];

    for (const rootComment of roots) {
        if (isSameId(rootComment?._id, targetId)) {
            return {
                kind: "root",
                rootComment,
                targetComment: rootComment,
            };
        }

        const reply = findReplyInRoot(
            rootComment,
            targetId
        );

        if (reply) {
            return {
                kind: "reply",
                rootComment,
                targetComment: reply,
            };
        }
    }

    return null;
};

const getParticipantKey = comment => {
    if (!comment) return null;

    if (comment.authorFingerprint) {
        return `device:${comment.authorFingerprint}`;
    }

    const userId =
        comment.authorUserId?._id
        || comment.authorUserId;

    if (userId) {
        return `user:${userId.toString()}`;
    }

    if (comment.authorId) {
        return `legacy:${comment.authorId}`;
    }

    const normalizedName =
        String(comment.name || "")
            .trim()
            .toLowerCase();

    return normalizedName
        ? `name:${normalizedName}`
        : null;
};

const getBranchData = rootComment => {
    if (!rootComment) {
        return {
            participants: [],
            totalMessages: 0,
        };
    }

    const participants = new Set();
    const rootKey = getParticipantKey(rootComment);

    if (rootKey) {
        participants.add(rootKey);
    }

    const participantUserIds = new Set();

    if (rootComment.authorUserId) {
        participantUserIds.add(
            rootComment.authorUserId.toString()
        );
    }

    const replies = Array.isArray(rootComment.replies)
        ? rootComment.replies
        : [];

    replies.forEach(reply => {
        const key = getParticipantKey(reply);
        if (key) participants.add(key);

        if (reply.authorUserId) {
            participantUserIds.add(
                reply.authorUserId.toString()
            );
        }
    });

    return {
        participants: [...participantUserIds],
        participantCount: participants.size,
        totalMessages: replies.length,
    };
};

const calculateCommentCounters = comments => {
    const roots = Array.isArray(comments)
        ? comments
        : [];

    let commentsCount = 0;
    let discussionCount = 0;

    roots.forEach(rootComment => {
        const replies = Array.isArray(rootComment?.replies)
            ? rootComment.replies
            : [];

        commentsCount += 1 + replies.length;

        const participantKeys = new Set();
        const rootKey = getParticipantKey(rootComment);

        if (rootKey) {
            participantKeys.add(rootKey);
        }

        replies.forEach(reply => {
            const replyKey = getParticipantKey(reply);
            if (replyKey) {
                participantKeys.add(replyKey);
            }
        });

        if (
            replies.length >= DISCUSSION_MIN_REPLIES
            && participantKeys.size
            >= DISCUSSION_MIN_PARTICIPANTS
        ) {
            discussionCount += 1;
        }
    });

    return {
        commentsCount,
        discussionCount,
    };
};

const participantKeyExpression = variableName => {
    const base = `$$${variableName}`;

    return {
        $switch: {
            branches: [
                {
                    case: {
                        $ne: [
                            {
                                $ifNull: [
                                    `${base}.authorFingerprint`,
                                    "",
                                ],
                            },
                            "",
                        ],
                    },
                    then: {
                        $concat: [
                            "device:",
                            `${base}.authorFingerprint`,
                        ],
                    },
                },
                {
                    case: {
                        $ne: [
                            {
                                $ifNull: [
                                    `${base}.authorUserId`,
                                    null,
                                ],
                            },
                            null,
                        ],
                    },
                    then: {
                        $concat: [
                            "user:",
                            {
                                $toString:
                                    `${base}.authorUserId`,
                            },
                        ],
                    },
                },
                {
                    case: {
                        $ne: [
                            {
                                $ifNull: [
                                    `${base}.authorId`,
                                    "",
                                ],
                            },
                            "",
                        ],
                    },
                    then: {
                        $concat: [
                            "legacy:",
                            {
                                $toString:
                                    `${base}.authorId`,
                            },
                        ],
                    },
                },
                {
                    case: {
                        $ne: [
                            {
                                $trim: {
                                    input: {
                                        $ifNull: [
                                            `${base}.name`,
                                            "",
                                        ],
                                    },
                                },
                            },
                            "",
                        ],
                    },
                    then: {
                        $concat: [
                            "name:",
                            {
                                $toLower: {
                                    $trim: {
                                        input: {
                                            $ifNull: [
                                                `${base}.name`,
                                                "",
                                            ],
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
            ],
            default: null,
        },
    };
};

const buildCounterRecalculationStage = () => ({
    $set: {
        commentsCount: {
            $sum: {
                $map: {
                    input: {
                        $ifNull: ["$comments", []],
                    },
                    as: "root",
                    in: {
                        $add: [
                            1,
                            {
                                $size: {
                                    $ifNull: [
                                        "$$root.replies",
                                        [],
                                    ],
                                },
                            },
                        ],
                    },
                },
            },
        },
        discussionCount: {
            $size: {
                $filter: {
                    input: {
                        $ifNull: ["$comments", []],
                    },
                    as: "root",
                    cond: {
                        $and: [
                            {
                                $gte: [
                                    {
                                        $size: {
                                            $ifNull: [
                                                "$$root.replies",
                                                [],
                                            ],
                                        },
                                    },
                                    DISCUSSION_MIN_REPLIES,
                                ],
                            },
                            {
                                $gte: [
                                    {
                                        $size: {
                                            $setDifference: [
                                                {
                                                    $setUnion: [
                                                        [
                                                            participantKeyExpression(
                                                                "root"
                                                            ),
                                                        ],
                                                        {
                                                            $map: {
                                                                input: {
                                                                    $ifNull: [
                                                                        "$$root.replies",
                                                                        [],
                                                                    ],
                                                                },
                                                                as: "reply",
                                                                in: participantKeyExpression(
                                                                    "reply"
                                                                ),
                                                            },
                                                        },
                                                    ],
                                                },
                                                [null, ""],
                                            ],
                                        },
                                    },
                                    DISCUSSION_MIN_PARTICIPANTS,
                                ],
                            },
                        ],
                    },
                },
            },
        },
    },
});

const buildRootInsertPipeline = newComment => [
    {
        $set: {
            comments: {
                $concatArrays: [
                    [newComment],
                    {
                        $ifNull: ["$comments", []],
                    },
                ],
            },
        },
    },
    buildCounterRecalculationStage(),
];

const buildReplyInsertPipeline = (
    rootCommentId,
    newReply
) => [
        {
            $set: {
                comments: {
                    $map: {
                        input: {
                            $ifNull: ["$comments", []],
                        },
                        as: "root",
                        in: {
                            $cond: [
                                {
                                    $eq: [
                                        "$$root._id",
                                        rootCommentId,
                                    ],
                                },
                                {
                                    $mergeObjects: [
                                        "$$root",
                                        {
                                            replies: {
                                                $concatArrays: [
                                                    {
                                                        $ifNull: [
                                                            "$$root.replies",
                                                            [],
                                                        ],
                                                    },
                                                    [newReply],
                                                ],
                                            },
                                        },
                                    ],
                                },
                                "$$root",
                            ],
                        },
                    },
                },
            },
        },
        buildCounterRecalculationStage(),
    ];

const buildRootDeletePipeline = rootCommentId => [
    {
        $set: {
            comments: {
                $filter: {
                    input: {
                        $ifNull: ["$comments", []],
                    },
                    as: "root",
                    cond: {
                        $ne: [
                            "$$root._id",
                            rootCommentId,
                        ],
                    },
                },
            },
        },
    },
    buildCounterRecalculationStage(),
];

const buildReplyDeletePipeline = replyId => [
    {
        $set: {
            comments: {
                $map: {
                    input: {
                        $ifNull: ["$comments", []],
                    },
                    as: "root",
                    in: {
                        $mergeObjects: [
                            "$$root",
                            {
                                replies: {
                                    $filter: {
                                        input: {
                                            $ifNull: [
                                                "$$root.replies",
                                                [],
                                            ],
                                        },
                                        as: "reply",
                                        cond: {
                                            $ne: [
                                                "$$reply._id",
                                                replyId,
                                            ],
                                        },
                                    },
                                },
                            },
                        ],
                    },
                },
            },
        },
    },
    buildCounterRecalculationStage(),
];

const buildReportMutation = (
    variableName,
    fingerprint
) => {
    const base = `$$${variableName}`;
    const nextReportCount = {
        $add: [
            {
                $ifNull: [
                    `${base}.reportCount`,
                    0,
                ],
            },
            1,
        ],
    };

    return {
        $mergeObjects: [
            base,
            {
                reportCount: nextReportCount,
                reportedBy: {
                    $setUnion: [
                        {
                            $ifNull: [
                                `${base}.reportedBy`,
                                [],
                            ],
                        },
                        [fingerprint],
                    ],
                },
                isHidden: {
                    $or: [
                        {
                            $ifNull: [
                                `${base}.isHidden`,
                                false,
                            ],
                        },
                        {
                            $gte: [
                                nextReportCount,
                                10,
                            ],
                        },
                    ],
                },
            },
        ],
    };
};

const buildRootReportPipeline = (
    rootCommentId,
    fingerprint
) => {
    const mutation = buildReportMutation(
        "root",
        fingerprint
    );

    return [
        {
            $set: {
                comments: {
                    $map: {
                        input: {
                            $ifNull: ["$comments", []],
                        },
                        as: "root",
                        in: {
                            $cond: [
                                {
                                    $eq: [
                                        "$$root._id",
                                        rootCommentId,
                                    ],
                                },
                                mutation,
                                "$$root",
                            ],
                        },
                    },
                },
            },
        },
    ];
};

const buildReplyReportPipeline = (
    replyId,
    fingerprint
) => {
    const mutation = buildReportMutation(
        "reply",
        fingerprint
    );

    return [
        {
            $set: {
                comments: {
                    $map: {
                        input: {
                            $ifNull: ["$comments", []],
                        },
                        as: "root",
                        in: {
                            $mergeObjects: [
                                "$$root",
                                {
                                    replies: {
                                        $map: {
                                            input: {
                                                $ifNull: [
                                                    "$$root.replies",
                                                    [],
                                                ],
                                            },
                                            as: "reply",
                                            in: {
                                                $cond: [
                                                    {
                                                        $eq: [
                                                            "$$reply._id",
                                                            replyId,
                                                        ],
                                                    },
                                                    mutation,
                                                    "$$reply",
                                                ],
                                            },
                                        },
                                    },
                                },
                            ],
                        },
                    },
                },
            },
        },
    ];
};

const maskHiddenComment = comment => {
    const plainComment = toPlainComment(comment);

    if (!plainComment) return null;

    if (plainComment.isHidden) {
        plainComment.text = HIDDEN_COMMENT_TEXT;
        plainComment.imageUrl = null;
        plainComment.stickerId = null;
    }

    return plainComment;
};

const populateAuthors = async comments => {
    if (!Array.isArray(comments) || comments.length === 0) {
        return [];
    }

    const userIds = new Set();

    comments.forEach(rootComment => {
        if (rootComment?.authorUserId) {
            userIds.add(
                rootComment.authorUserId.toString()
            );
        }

        (rootComment?.replies || []).forEach(reply => {
            if (reply?.authorUserId) {
                userIds.add(
                    reply.authorUserId.toString()
                );
            }
        });
    });

    const users = await MobileUser.find({
        _id: {
            $in: [...userIds],
        },
    })
        .select(
            "username peakLevel lastStreak consecutiveStreak "
            + "inventory previousRank"
        )
        .lean();

    const userMap = users.reduce((accumulator, user) => {
        const equippedItems = Array.isArray(user.inventory)
            ? user.inventory.filter(
                item => item.isEquipped
            )
            : [];

        accumulator[user._id.toString()] = {
            userId: user._id.toString(),
            username: user.username || "Guest",
            name: user.username || "Guest",
            peakLevel: user.peakLevel || 0,
            lastStreak: user.lastStreak || 0,
            streak: user.consecutiveStreak || 0,
            auraRank: user.previousRank || null,
            equippedGlow:
                equippedItems.find(item =>
                    item.category?.toUpperCase()
                    === "GLOW"
                ) || null,
            badges:
                equippedItems.filter(item =>
                    item.category?.toUpperCase()
                    === "BADGE"
                ),
        };

        return accumulator;
    }, {});

    return comments.map(rootComment => {
        const rootAuthor =
            rootComment.authorUserId
                ? userMap[
                rootComment.authorUserId.toString()
                ]
                : null;

        const replies = (
            Array.isArray(rootComment.replies)
                ? rootComment.replies
                : []
        ).map(reply => {
            const replyAuthor =
                reply.authorUserId
                    ? userMap[
                    reply.authorUserId.toString()
                    ]
                    : null;

            return {
                ...reply,
                author:
                    replyAuthor
                    || {
                        name:
                            reply.name
                            || "Anonymous",
                        peakLevel: 0,
                        lastStreak: 0,
                    },
                replies: [],
            };
        });

        return {
            ...rootComment,
            author:
                rootAuthor
                || {
                    name:
                        rootComment.name
                        || "Anonymous",
                    peakLevel: 0,
                    lastStreak: 0,
                },
            replies,
        };
    });
};

const processAndSortComments = comments => {
    if (!Array.isArray(comments)) return [];

    return comments
        .map(rootComment => {
            const processedRoot =
                maskHiddenComment(rootComment);

            processedRoot.replies = (
                Array.isArray(rootComment.replies)
                    ? rootComment.replies
                    : []
            )
                .map(reply => ({
                    ...maskHiddenComment(reply),
                    replies: [],
                }))
                .sort(
                    (left, right) =>
                        new Date(right.date)
                        - new Date(left.date)
                );

            return processedRoot;
        })
        .sort((left, right) => {
            const replyDifference =
                (right.replies?.length || 0)
                - (left.replies?.length || 0);

            if (replyDifference !== 0) {
                return replyDifference;
            }

            return (
                new Date(right.date)
                - new Date(left.date)
            );
        });
};

const cleanupUploadedMedia = async r2Key => {
    if (!r2Key) return;

    try {
        await r2Client.send(
            new DeleteObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: r2Key,
            })
        );
    } catch (error) {
        console.error(
            "Failed to clean comment media:",
            error
        );
    }
};

const collectCommentImageUrls = comment => {
    if (!comment) return [];

    const urls = [];

    if (comment.imageUrl) {
        urls.push(comment.imageUrl);
    }

    (comment.replies || []).forEach(reply => {
        if (reply?.imageUrl) {
            urls.push(reply.imageUrl);
        }
    });

    return urls;
};

const deleteCommentMedia = async imageUrls => {
    const domain =
        process.env.NEW_DOMAIN
        || "https://media.oreblogda.com";

    const uniqueUrls = [
        ...new Set(
            (imageUrls || []).filter(Boolean)
        ),
    ];

    const deletionResults = await Promise.allSettled(
        uniqueUrls.map(imageUrl => {
            if (!imageUrl.includes(domain)) {
                return Promise.resolve();
            }

            const r2Key =
                imageUrl.split(`${domain}/`)[1];

            if (!r2Key) {
                return Promise.resolve();
            }

            return r2Client.send(
                new DeleteObjectCommand({
                    Bucket:
                        process.env.R2_BUCKET_NAME,
                    Key: r2Key,
                })
            );
        })
    );

    deletionResults.forEach(result => {
        if (result.status === "rejected") {
            console.error(
                "Failed to delete comment media:",
                result.reason
            );
        }
    });
};

const buildOwnerConditions = (
    fingerprint,
    mobileUserId
) => {
    const conditions = [
        {
            authorFingerprint: fingerprint,
        },
    ];

    if (mobileUserId) {
        conditions.push({
            authorUserId: mobileUserId,
        });
    }

    return conditions;
};

const checkTitleUnlocks = async (
    user,
    field,
    currentCount
) => {
    const TITLE_THRESHOLDS = {
        totalCommentsReceived: [
            {
                limit: 10,
                name: "Signal Starter",
                tier: "COMMON",
            },
            {
                limit: 200,
                name: "Topic Starter",
                tier: "RARE",
            },
            {
                limit: 2000,
                name: "Debate Master",
                tier: "EPIC",
            },
            {
                limit: 10000,
                name: "The Great Orator",
                tier: "LEGENDARY",
            },
        ],
        lifetimeCommentsMade: [
            {
                limit: 1,
                name: "First Response",
                tier: "COMMON",
            },
            {
                limit: 500,
                name: "Active Citizen",
                tier: "RARE",
            },
        ],
    };

    const thresholds = TITLE_THRESHOLDS[field];
    if (!thresholds) return null;

    const earnedTitle = [...thresholds]
        .reverse()
        .find(
            threshold =>
                currentCount >= threshold.limit
        );

    if (!earnedTitle) return null;

    const alreadyHas =
        user.unlockedTitles?.some(
            title => title.name === earnedTitle.name
        );

    if (alreadyHas) return null;

    await MobileUser.findByIdAndUpdate(
        user._id,
        {
            $addToSet: {
                unlockedTitles: earnedTitle,
            },
        }
    );

    const titleMessage =
        `🏆 NEW TITLE: You have received the `
        + `"${earnedTitle.name}" TITLE!`;

    await sendPillParallel(
        user.pushToken
            ? [user.pushToken]
            : [],
        "Title Earned",
        titleMessage,
        {
            type: "achievement",
        },
        {
            type: "achievement",
            targetAudience: "user",
            targetId: user._id.toString(),
            priority: 3,
        }
    );

    return earnedTitle;
};

export async function GET(req, { params }) {
    const { id } = await params;
    const { searchParams } = new URL(req.url);

    const page = Math.max(
        1,
        Number.parseInt(
            searchParams.get("page") || "1",
            10
        )
    );

    const limit = Math.min(
        100,
        Math.max(
            1,
            Number.parseInt(
                searchParams.get("limit") || "40",
                10
            )
        )
    );

    const skip = (page - 1) * limit;

    try {
        await connectDB();

        const post = await Post.findOne(
            getSearchFilter(id)
        )
            .select({
                comments: {
                    $slice: [skip, limit],
                },
                commentCount: {
                    $size: "$comments",
                },
            })
            .lean();

        if (!post) {
            return NextResponse.json(
                {
                    message: "Post not found",
                },
                { status: 404 }
            );
        }

        const populatedComments =
            await populateAuthors(
                post.comments || []
            );

        const finalComments =
            processAndSortComments(
                populatedComments
            );

        return NextResponse.json({
            comments: finalComments,
            total: post.commentCount || 0,
            hasMore:
                skip + (post.comments?.length || 0)
                < (post.commentCount || 0),
        });
    } catch (error) {
        console.error("GET comment error:", error);

        return NextResponse.json(
            {
                message: "Server error",
            },
            { status: 500 }
        );
    }
}

export async function POST(req, { params }) {
    let uploadedR2Key = null;
    let commentPersisted = false;

    try {
        await connectDB();

        const { id } = await params;
        const body = await req.json();

        const {
            name,
            text,
            stickerId,
            imageUrl,
            parentCommentId,
            replyToCommentId,
            candidateSources = [],
        } = body;

        const fingerprint =
            req.headers.get("x-user-deviceId")
            || req.headers.get("x-device-id")
            || body.fingerprint
            || "";

        if (!fingerprint) {
            return NextResponse.json(
                {
                    message:
                        "Authentication required",
                },
                { status: 401 }
            );
        }

        if (
            !stickerId
            && !imageUrl
            && !text?.trim()
        ) {
            return NextResponse.json(
                {
                    message:
                        "Comment content required",
                },
                { status: 400 }
            );
        }

        if (!name?.trim()) {
            return NextResponse.json(
                {
                    message:
                        "Comment author name is required",
                },
                { status: 400 }
            );
        }

        const searchFilter = getSearchFilter(id);

        const [
            foundMobileUser,
            postSnapshot,
        ] = await Promise.all([
            MobileUser.findOne({
                deviceId: fingerprint,
            }).select(
                "_id username profilePic inventory "
                + "peakLevel lastStreak "
                + "consecutiveStreak previousRank"
            ),
            Post.findOne(searchFilter).select(
                "_id slug title authorUserId authorId "
                + "interests clanId country comments "
                + "commentsCount discussionCount mediaUrl"
            ),
        ]);

        if (!postSnapshot) {
            return NextResponse.json(
                {
                    message: "Post not found",
                },
                { status: 404 }
            );
        }

        const mobileUserId =
            foundMobileUser?._id || null;

        let resolvedStickerUrl = null;

        if (stickerId) {
            const queryConditions = [
                { stickerId },
            ];

            if (
                mongoose.Types.ObjectId.isValid(
                    stickerId
                )
            ) {
                queryConditions.push({
                    _id: stickerId,
                });
            }

            const stickerDocument =
                await StickerModel.findOne({
                    $or: queryConditions,
                })
                    .select("url")
                    .lean();

            resolvedStickerUrl =
                stickerDocument?.url || null;
        }

        const displayTitle =
            postSnapshot.title?.length > 20
                ? `${postSnapshot.title.slice(0, 20)}...`
                : postSnapshot.title || "Post";

        const commentType = stickerId
            ? "sticker"
            : imageUrl
                ? "image"
                : "text";

        const commentText =
            stickerId || imageUrl
                ? ""
                : text.trim();

        const notificationMessageText =
            getCommentMessagePreview({
                stickerId,
                imageUrl,
                text: commentText,
            });

        const commentMongoId =
            new mongoose.Types.ObjectId();

        let uploadedImageUrl =
            imageUrl || null;

        if (imageUrl) {
            let bodyBuffer = null;
            let contentType = "image/jpeg";

            if (imageUrl.startsWith("data:image")) {
                const matches = imageUrl.match(
                    /^data:([A-Za-z0-9.+/-]+);base64,(.+)$/
                );

                if (matches?.length === 3) {
                    contentType = matches[1];
                    bodyBuffer = Buffer.from(
                        matches[2],
                        "base64"
                    );
                }
            } else if (
                imageUrl.startsWith("http")
            ) {
                try {
                    const response = await fetch(
                        imageUrl,
                        {
                            signal:
                                AbortSignal.timeout(
                                    5000
                                ),
                        }
                    );

                    if (!response.ok) {
                        throw new Error(
                            `Remote image returned ${response.status}`
                        );
                    }

                    const arrayBuffer =
                        await response.arrayBuffer();

                    bodyBuffer =
                        Buffer.from(arrayBuffer);

                    contentType =
                        response.headers.get(
                            "content-type"
                        )
                        || "image/jpeg";
                } catch (error) {
                    console.error(
                        "Error pulling remote comment media:",
                        error
                    );
                }
            }

            const allowedTypes = new Set([
                "image/jpeg",
                "image/jpg",
                "image/png",
                "image/webp",
                "image/gif",
            ]);

            if (
                !bodyBuffer
                || !allowedTypes.has(contentType)
            ) {
                return NextResponse.json(
                    {
                        message:
                            "Invalid comment image",
                    },
                    { status: 400 }
                );
            }

            if (
                bodyBuffer.length
                > MAX_COMMENT_IMAGE_BYTES
            ) {
                return NextResponse.json(
                    {
                        message:
                            "Comment image is too large",
                    },
                    { status: 413 }
                );
            }

            const extensionByType = {
                "image/jpeg": "jpg",
                "image/jpg": "jpg",
                "image/png": "png",
                "image/webp": "webp",
                "image/gif": "gif",
            };

            const extension =
                extensionByType[contentType]
                || "jpg";

            uploadedR2Key =
                `comments/${postSnapshot._id}/`
                + `${commentMongoId}.${extension}`;

            await r2Client.send(
                new PutObjectCommand({
                    Bucket:
                        process.env.R2_BUCKET_NAME,
                    Key: uploadedR2Key,
                    Body: bodyBuffer,
                    ContentType: contentType,
                })
            );

            const domain =
                process.env.NEW_DOMAIN
                || "https://media.oreblogda.com";

            uploadedImageUrl =
                `${domain}/${uploadedR2Key}`;
        }

        const sentAt = new Date();

        const sharedCommentFields = {
            _id: commentMongoId,
            authorFingerprint: fingerprint,
            authorUserId:
                mobileUserId || null,
            name: name.trim(),
            text: commentText,
            stickerId: stickerId || null,
            imageUrl: uploadedImageUrl,
            type: commentType,
            date: sentAt,
            isEdited: false,
            isHidden: false,
            reportCount: 0,
            reportedBy: [],
        };

        let immediateRecipientId = null;
        let targetRootComment = null;
        let storedComment = null;
        let updatedPost = null;

        if (!parentCommentId) {
            storedComment = {
                ...sharedCommentFields,
                replies: [],
            };

            immediateRecipientId =
                postSnapshot.authorUserId || null;

            updatedPost =
                await Post.findOneAndUpdate(
                    {
                        ...searchFilter,
                        "comments._id": {
                            $ne: commentMongoId,
                        },
                    },
                    buildRootInsertPipeline(
                        storedComment
                    ),
                    {
                        new: true,
                    }
                );
        } else {
            if (
                !mongoose.Types.ObjectId.isValid(
                    parentCommentId
                )
            ) {
                await cleanupUploadedMedia(
                    uploadedR2Key
                );

                return NextResponse.json(
                    {
                        message:
                            "Invalid discussion ID",
                    },
                    { status: 400 }
                );
            }

            const rootCommentId =
                new mongoose.Types.ObjectId(
                    parentCommentId
                );

            const rootSnapshot =
                findRootComment(
                    postSnapshot.comments,
                    rootCommentId
                );

            if (!rootSnapshot) {
                await cleanupUploadedMedia(
                    uploadedR2Key
                );

                return NextResponse.json(
                    {
                        message:
                            "Discussion not found",
                    },
                    { status: 404 }
                );
            }

            let replyTarget = rootSnapshot;

            if (replyToCommentId) {
                if (
                    isSameId(
                        rootSnapshot._id,
                        replyToCommentId
                    )
                ) {
                    replyTarget = rootSnapshot;
                } else {
                    replyTarget =
                        findReplyInRoot(
                            rootSnapshot,
                            replyToCommentId
                        );
                }

                if (!replyTarget) {
                    await cleanupUploadedMedia(
                        uploadedR2Key
                    );

                    return NextResponse.json(
                        {
                            message:
                                "Reply target not found",
                        },
                        { status: 404 }
                    );
                }
            }

            immediateRecipientId =
                replyTarget.authorUserId
                || rootSnapshot.authorUserId
                || null;

            storedComment = {
                ...sharedCommentFields,
                replyToCommentId:
                    replyToCommentId
                        ? toComparableId(
                            replyTarget._id
                        )
                        : null,
                replyToName:
                    replyToCommentId
                        ? (
                            replyTarget.name
                            || "Anonymous"
                        )
                        : null,
                replyToText:
                    replyToCommentId
                        ? (
                            replyTarget.type
                                === "sticker"
                                ? "[Sticker]"
                                : replyTarget.imageUrl
                                    ? "[Image]"
                                    : replyTarget.text
                        )
                        : null,
            };

            updatedPost =
                await Post.findOneAndUpdate(
                    {
                        ...searchFilter,
                        comments: {
                            $elemMatch: {
                                _id: rootCommentId,
                                "replies._id": {
                                    $ne: commentMongoId,
                                },
                            },
                        },
                    },
                    buildReplyInsertPipeline(
                        rootCommentId,
                        storedComment
                    ),
                    {
                        new: true,
                    }
                );

            targetRootComment =
                findRootComment(
                    updatedPost?.comments,
                    rootCommentId
                );
        }

        if (!updatedPost) {
            await cleanupUploadedMedia(
                uploadedR2Key
            );

            return NextResponse.json(
                {
                    message:
                        "Comment write conflict",
                },
                { status: 409 }
            );
        }

        commentPersisted = true;

        if (
            parentCommentId
            && !targetRootComment
        ) {
            targetRootComment =
                findRootComment(
                    updatedPost.comments,
                    parentCommentId
                );
        }

        try {
            await processTelemetryAndAffinity(
                fingerprint,
                updatedPost,
                Array.isArray(candidateSources)
                    ? candidateSources.slice(0, 20)
                    : [],
                "comment",
                15
            );

            const sideEffects = [];

            if (mobileUserId) {
                sideEffects.push(
                    MobileUser.findByIdAndUpdate(
                        mobileUserId,
                        {
                            $inc: {
                                lifetimeCommentsCount: 1,
                            },
                        },
                        {
                            new: true,
                        }
                    ).then(updatedCommenter => {
                        if (!updatedCommenter) {
                            return null;
                        }

                        return checkTitleUnlocks(
                            updatedCommenter,
                            "lifetimeCommentsMade",
                            updatedCommenter
                                .lifetimeCommentsCount
                        );
                    })
                );
            }

            if (
                immediateRecipientId
                && !isSameId(
                    immediateRecipientId,
                    mobileUserId
                )
            ) {
                const recipientAura =
                    parentCommentId ? 5 : 10;

                const clanPoints =
                    parentCommentId ? 10 : 20;

                sideEffects.push(
                    Promise.all([
                        awardAura(
                            immediateRecipientId,
                            recipientAura
                        ),
                        awardClanPoints(
                            updatedPost,
                            clanPoints,
                            "comment"
                        ),
                        MobileUser.findByIdAndUpdate(
                            immediateRecipientId,
                            {
                                $inc: {
                                    receivedCommentsCount: 1,
                                },
                            },
                            {
                                new: true,
                            }
                        ).then(recipient => {
                            if (!recipient) {
                                return null;
                            }

                            return checkTitleUnlocks(
                                recipient,
                                "totalCommentsReceived",
                                recipient
                                    .receivedCommentsCount
                            );
                        }),
                    ])
                );
            }

            await Promise.all(sideEffects);

            const notifications = [];

            if (
                parentCommentId
                && immediateRecipientId
                && !isSameId(
                    immediateRecipientId,
                    mobileUserId
                )
            ) {
                const rootDiscussionId =
                    targetRootComment?._id
                    || parentCommentId;

                notifications.push({
                    recipientId:
                        immediateRecipientId,
                    title: "New Reply 💬",
                    message: stickerId
                        ? `${name} sent a sticker on "${displayTitle}"`
                        : uploadedImageUrl
                            ? `${name} shared an image on "${displayTitle}"`
                            : `${name} on "${displayTitle}": `
                            + `"${text?.substring(0, 40)}..."`,
                    messageText:
                        notificationMessageText,
                    type: "reply",
                    notificationType:
                        "discussion_reply",
                    commentId:
                        rootDiscussionId,
                    discussionId:
                        rootDiscussionId,
                    conversationId:
                        createDiscussionConversationId(
                            updatedPost._id,
                            rootDiscussionId
                        ),
                    conversationTitle:
                        `Discussion on ${displayTitle}`,
                });
            }

            if (
                !parentCommentId
                && updatedPost.authorUserId
                && !isSameId(
                    updatedPost.authorUserId,
                    mobileUserId
                )
            ) {
                notifications.push({
                    recipientId:
                        updatedPost.authorUserId,
                    title: "New Signal 📝",
                    message: stickerId
                        ? `${name} sent a sticker on "${displayTitle}"`
                        : uploadedImageUrl
                            ? `${name} shared an image on "${displayTitle}"`
                            : `${name} commented on "${displayTitle}" `
                            + `(#${updatedPost.commentsCount})`,
                    messageText:
                        notificationMessageText,
                    type: "comment",
                    notificationType:
                        "post_comment",
                    commentId:
                        storedComment._id,
                    discussionId:
                        storedComment._id,
                    conversationId:
                        createDiscussionConversationId(
                            updatedPost._id
                        ),
                    conversationTitle:
                        `Discussion on ${displayTitle}`,
                });
            }

            if (
                parentCommentId
                && targetRootComment
            ) {
                const {
                    participants,
                    totalMessages,
                } = getBranchData(
                    targetRootComment
                );

                if (
                    totalMessages > 0
                    && totalMessages % 5 === 0
                ) {
                    const rewardIds =
                        new Set(participants);

                    if (updatedPost.authorUserId) {
                        rewardIds.add(
                            updatedPost
                                .authorUserId
                                .toString()
                        );
                    }

                    if (mobileUserId) {
                        rewardIds.delete(
                            mobileUserId.toString()
                        );
                    }

                    const idsToReward =
                        [...rewardIds];

                    if (idsToReward.length > 0) {
                        await Promise.all(
                            idsToReward.map(
                                userId =>
                                    awardAura(
                                        userId,
                                        1
                                    )
                            )
                        );

                        await awardClanPoints(
                            updatedPost,
                            5,
                            "comment"
                        );
                    }
                }

                if (
                    shouldNotifyMilestone(
                        totalMessages
                    )
                ) {
                    const discussionMessage =
                        `[${displayTitle}] Active: `
                        + `${totalMessages} replies on `
                        + `${targetRootComment.name}'s signal.`;

                    participants.forEach(
                        participantId => {
                            if (
                                participantId
                                !== mobileUserId
                                    ?.toString()
                            ) {
                                notifications.push({
                                    recipientId:
                                        participantId,
                                    title:
                                        "Discussion Active 🔥",
                                    message:
                                        discussionMessage,
                                    messageText:
                                        notificationMessageText,
                                    type:
                                        "discussion",
                                    notificationType:
                                        "discussion_message",
                                    commentId:
                                        targetRootComment._id,
                                    discussionId:
                                        targetRootComment._id,
                                    conversationId:
                                        createDiscussionConversationId(
                                            updatedPost._id,
                                            targetRootComment._id
                                        ),
                                    conversationTitle:
                                        `Discussion on ${displayTitle}`,
                                });
                            }
                        }
                    );
                }
            }

            await Promise.all(
                notifications.map(
                    async notification => {
                        const recipient =
                            await MobileUser.findById(
                                notification.recipientId
                            ).select(
                                "_id deviceId pushToken"
                            );

                        if (!recipient) return;

                        await Notification.create({
                            recipientId:
                                recipient.deviceId,
                            senderName:
                                name.trim(),
                            type:
                                notification.type,
                            postId:
                                updatedPost._id,
                            message:
                                notification.message,
                        });

                        const conversationId =
                            notification
                                .conversationId
                            || createDiscussionConversationId(
                                updatedPost._id,
                                notification
                                    .discussionId
                            );

                        const senderAvatar =
                            foundMobileUser
                                ?.profilePic?.url
                            || "";

                        await sendPillParallel(
                            recipient.pushToken
                                ? [
                                    recipient.pushToken,
                                ]
                                : [],
                            notification.title,
                            notification.message,
                            {
                                screen:
                                    `/post/${updatedPost.slug}`,
                                postId:
                                    updatedPost
                                        ._id
                                        .toString(),
                                type:
                                    notification
                                        .notificationType
                                    || notification.type,
                                notificationType:
                                    notification
                                        .notificationType
                                    || notification.type,
                                presentation:
                                    "messaging",
                                notificationId:
                                    `message:${conversationId}`,
                                conversationId,
                                conversationTitle:
                                    notification
                                        .conversationTitle
                                    || `Discussion on ${displayTitle}`,
                                commentId:
                                    notification
                                        .commentId
                                        ?.toString(),
                                discussionId:
                                    notification
                                        .discussionId
                                        ?.toString()
                                    || notification
                                        .commentId
                                        ?.toString(),
                                senderName:
                                    name.trim(),
                                senderId:
                                    mobileUserId
                                        ?.toString()
                                    || fingerprint,
                                senderAvatar,
                                authorPfp:
                                    senderAvatar,
                                messageText:
                                    notification
                                        .messageText
                                    || notificationMessageText,
                                sentAt:
                                    sentAt.getTime(),
                                isGroupConversation:
                                    true,
                                groupId:
                                    conversationId,
                                mediaUrl:
                                    resolvedStickerUrl
                                    || uploadedImageUrl
                                    || updatedPost
                                        .mediaUrl,
                            },
                            {
                                type:
                                    `post_${notification.type}`,
                                targetAudience:
                                    "user",
                                targetId:
                                    recipient
                                        ._id
                                        .toString(),
                                link:
                                    `/post/${updatedPost.slug}`,
                                groupId:
                                    conversationId,
                                priority: 2,
                                replaceExistingType:
                                    true,
                            }
                        );
                    }
                )
            );
        } catch (sideEffectError) {
            console.error(
                "Comment post-save side effect error:",
                sideEffectError
            );
        }

        let enrichedAuthor = {
            name: storedComment.name,
        };

        if (foundMobileUser) {
            const equippedItems =
                Array.isArray(
                    foundMobileUser.inventory
                )
                    ? foundMobileUser
                        .inventory
                        .filter(
                            item =>
                                item.isEquipped
                        )
                    : [];

            enrichedAuthor = {
                userId:
                    foundMobileUser
                        ._id
                        .toString(),
                username:
                    foundMobileUser.username,
                name:
                    foundMobileUser.username,
                peakLevel:
                    foundMobileUser.peakLevel
                    || 0,
                lastStreak:
                    foundMobileUser.lastStreak
                    || 0,
                streak:
                    foundMobileUser
                        .consecutiveStreak
                    || 0,
                auraRank:
                    foundMobileUser
                        .previousRank
                    || null,
                equippedGlow:
                    equippedItems.find(
                        item =>
                            [
                                "GLOW",
                                "NAME_GLOW",
                                "TEXT_GLOW",
                                "EFFECT",
                            ].includes(
                                item.category
                                    ?.toUpperCase()
                            )
                    ) || null,
                badges:
                    equippedItems.filter(
                        item =>
                            item.category
                                ?.toUpperCase()
                            === "BADGE"
                    ),
            };
        }

        return NextResponse.json(
            {
                comment: {
                    ...storedComment,
                    replies: [],
                    author: enrichedAuthor,
                },
                commentsCount:
                    updatedPost.commentsCount,
                discussionCount:
                    updatedPost.discussionCount,
            },
            { status: 201 }
        );
    } catch (error) {
        if (
            uploadedR2Key
            && !commentPersisted
        ) {
            await cleanupUploadedMedia(
                uploadedR2Key
            );
        }

        console.error(
            "POST comment error:",
            error
        );

        return NextResponse.json(
            {
                message: "Error",
                error: error.message,
            },
            { status: 500 }
        );
    }
}

export async function DELETE(req, { params }) {
    try {
        await connectDB();

        const { id } = await params;
        const { searchParams } =
            new URL(req.url);

        const commentId =
            searchParams.get("id");

        const parentId =
            searchParams.get("parentId");

        if (
            !commentId
            || !mongoose.Types.ObjectId.isValid(
                commentId
            )
        ) {
            return NextResponse.json(
                {
                    message:
                        "Valid commentId required",
                },
                { status: 400 }
            );
        }

        const fingerprint =
            req.headers.get("x-user-deviceId")
            || req.headers.get("x-device-id")
            || "";

        if (!fingerprint) {
            return NextResponse.json(
                {
                    message:
                        "Authentication required",
                },
                { status: 401 }
            );
        }

        const foundMobileUser =
            await MobileUser.findOne({
                deviceId: fingerprint,
            })
                .select("_id")
                .lean();

        const mobileUserId =
            foundMobileUser?._id || null;

        const searchFilter =
            getSearchFilter(id);

        const targetObjectId =
            new mongoose.Types.ObjectId(
                commentId
            );

        const ownerConditions =
            buildOwnerConditions(
                fingerprint,
                mobileUserId
            );

        let preUpdatePost = null;
        let removedComment = null;

        const shouldTryReplyFirst =
            Boolean(parentId);

        const tryDeleteReply = async () => {
            const replyPreImage =
                await Post.findOneAndUpdate(
                    {
                        ...searchFilter,
                        comments: {
                            $elemMatch: {
                                ...(parentId
                                    && mongoose.Types.ObjectId
                                        .isValid(parentId)
                                    ? {
                                        _id:
                                            new mongoose.Types.ObjectId(
                                                parentId
                                            ),
                                    }
                                    : {}),
                                replies: {
                                    $elemMatch: {
                                        _id:
                                            targetObjectId,
                                        $or:
                                            ownerConditions,
                                    },
                                },
                            },
                        },
                    },
                    buildReplyDeletePipeline(
                        targetObjectId
                    ),
                    {
                        new: false,
                    }
                ).select(
                    "comments commentsCount "
                    + "discussionCount"
                );

            if (!replyPreImage) {
                return false;
            }

            const match =
                findCommentOrReply(
                    replyPreImage.comments,
                    targetObjectId
                );

            preUpdatePost = replyPreImage;
            removedComment =
                match?.targetComment || null;

            return true;
        };

        const tryDeleteRoot = async () => {
            const rootPreImage =
                await Post.findOneAndUpdate(
                    {
                        ...searchFilter,
                        comments: {
                            $elemMatch: {
                                _id:
                                    targetObjectId,
                                $or:
                                    ownerConditions,
                            },
                        },
                    },
                    buildRootDeletePipeline(
                        targetObjectId
                    ),
                    {
                        new: false,
                    }
                ).select(
                    "comments commentsCount "
                    + "discussionCount"
                );

            if (!rootPreImage) {
                return false;
            }

            const match =
                findCommentOrReply(
                    rootPreImage.comments,
                    targetObjectId
                );

            preUpdatePost = rootPreImage;
            removedComment =
                match?.targetComment || null;

            return true;
        };

        let deleted = false;

        if (shouldTryReplyFirst) {
            deleted =
                await tryDeleteReply();

            if (!deleted) {
                deleted =
                    await tryDeleteRoot();
            }
        } else {
            deleted =
                await tryDeleteRoot();

            if (!deleted) {
                deleted =
                    await tryDeleteReply();
            }
        }

        if (!deleted) {
            const existingPost =
                await Post.findOne(
                    searchFilter
                )
                    .select("comments")
                    .lean();

            if (!existingPost) {
                return NextResponse.json(
                    {
                        message:
                            "Post not found",
                    },
                    { status: 404 }
                );
            }

            const existingMatch =
                findCommentOrReply(
                    existingPost.comments,
                    targetObjectId
                );

            if (!existingMatch) {
                return NextResponse.json(
                    {
                        message:
                            "Comment not found",
                    },
                    { status: 404 }
                );
            }

            return NextResponse.json(
                {
                    message:
                        "Unauthorized: You can only delete your own comments",
                },
                { status: 403 }
            );
        }

        const nextComments = (
            preUpdatePost.comments || []
        )
            .map(rootComment => {
                if (
                    isSameId(
                        rootComment._id,
                        targetObjectId
                    )
                ) {
                    return null;
                }

                return {
                    ...toPlainComment(
                        rootComment
                    ),
                    replies: (
                        rootComment.replies
                        || []
                    ).filter(
                        reply =>
                            !isSameId(
                                reply._id,
                                targetObjectId
                            )
                    ),
                };
            })
            .filter(Boolean);

        const {
            commentsCount,
            discussionCount,
        } = calculateCommentCounters(
            nextComments
        );

        await deleteCommentMedia(
            collectCommentImageUrls(
                removedComment
            )
        );

        return NextResponse.json(
            {
                message:
                    "Comment deleted successfully",
                commentsCount,
                discussionCount,
            },
            { status: 200 }
        );
    } catch (error) {
        console.error(
            "DELETE comment error:",
            error
        );

        return NextResponse.json(
            {
                message: "Server error",
                error: error.message,
            },
            { status: 500 }
        );
    }
}

export async function PATCH(req, { params }) {
    try {
        await connectDB();

        const { id } = await params;
        const { searchParams } =
            new URL(req.url);

        const commentId =
            searchParams.get("id");

        const parentId =
            searchParams.get("parentId");

        const body = await req.json();
        const {
            action,
            text,
            reason,
        } = body;

        if (
            !commentId
            || !mongoose.Types.ObjectId.isValid(
                commentId
            )
        ) {
            return NextResponse.json(
                {
                    message:
                        "Valid commentId required",
                },
                { status: 400 }
            );
        }

        const fingerprint =
            req.headers.get("x-user-deviceId")
            || req.headers.get("x-device-id")
            || body.fingerprint
            || "";

        if (!fingerprint) {
            return NextResponse.json(
                {
                    message:
                        "Authentication required",
                },
                { status: 401 }
            );
        }

        const foundMobileUser =
            await MobileUser.findOne({
                deviceId: fingerprint,
            })
                .select("_id")
                .lean();

        const mobileUserId =
            foundMobileUser?._id || null;

        const searchFilter =
            getSearchFilter(id);

        const targetObjectId =
            new mongoose.Types.ObjectId(
                commentId
            );

        const ownerConditions =
            buildOwnerConditions(
                fingerprint,
                mobileUserId
            );

        const shouldTryReplyFirst =
            Boolean(parentId);

        if (action === "report") {
            if (!reason?.trim()) {
                return NextResponse.json(
                    {
                        message:
                            "Report reason is required",
                    },
                    { status: 400 }
                );
            }

            const tryReportRoot = () =>
                Post.findOneAndUpdate(
                    {
                        ...searchFilter,
                        comments: {
                            $elemMatch: {
                                _id:
                                    targetObjectId,
                                reportedBy: {
                                    $ne:
                                        fingerprint,
                                },
                            },
                        },
                    },
                    buildRootReportPipeline(
                        targetObjectId,
                        fingerprint
                    ),
                    {
                        new: true,
                    }
                ).select("_id comments");

            const tryReportReply = () =>
                Post.findOneAndUpdate(
                    {
                        ...searchFilter,
                        comments: {
                            $elemMatch: {
                                ...(parentId
                                    && mongoose.Types.ObjectId
                                        .isValid(parentId)
                                    ? {
                                        _id:
                                            new mongoose.Types.ObjectId(
                                                parentId
                                            ),
                                    }
                                    : {}),
                                replies: {
                                    $elemMatch: {
                                        _id:
                                            targetObjectId,
                                        reportedBy: {
                                            $ne:
                                                fingerprint,
                                        },
                                    },
                                },
                            },
                        },
                    },
                    buildReplyReportPipeline(
                        targetObjectId,
                        fingerprint
                    ),
                    {
                        new: true,
                    }
                ).select("_id comments");

            let updatedPost = null;

            if (shouldTryReplyFirst) {
                updatedPost =
                    await tryReportReply();

                if (!updatedPost) {
                    updatedPost =
                        await tryReportRoot();
                }
            } else {
                updatedPost =
                    await tryReportRoot();

                if (!updatedPost) {
                    updatedPost =
                        await tryReportReply();
                }
            }

            if (!updatedPost) {
                const existingPost =
                    await Post.findOne(
                        searchFilter
                    )
                        .select("comments")
                        .lean();

                if (!existingPost) {
                    return NextResponse.json(
                        {
                            message:
                                "Post not found",
                        },
                        { status: 404 }
                    );
                }

                const existingMatch =
                    findCommentOrReply(
                        existingPost.comments,
                        targetObjectId
                    );

                if (!existingMatch) {
                    return NextResponse.json(
                        {
                            message:
                                "Comment not found",
                        },
                        { status: 404 }
                    );
                }

                return NextResponse.json(
                    {
                        message:
                            "You have already reported this comment.",
                    },
                    { status: 400 }
                );
            }

            const updatedMatch =
                findCommentOrReply(
                    updatedPost.comments,
                    targetObjectId
                );

            try {
                await Report.create({
                    targetId: commentId,
                    targetPostId:
                        updatedPost._id,
                    targetType: "comment",
                    reporterFingerprint:
                        fingerprint,
                    reporterUserId:
                        mobileUserId || null,
                    reason: reason.trim(),
                });
            } catch (reportError) {
                console.error(
                    "Comment report ledger error:",
                    reportError
                );
            }

            return NextResponse.json(
                {
                    message:
                        "Comment reported successfully.",
                    comment:
                        maskHiddenComment(
                            updatedMatch
                                ?.targetComment
                        ),
                },
                { status: 200 }
            );
        }

        if (!text?.trim()) {
            return NextResponse.json(
                {
                    message:
                        "Updated text is required for modifications",
                },
                { status: 400 }
            );
        }

        const normalizedText =
            text.trim();

        const tryEditRoot = () =>
            Post.findOneAndUpdate(
                {
                    ...searchFilter,
                    comments: {
                        $elemMatch: {
                            _id:
                                targetObjectId,
                            $or:
                                ownerConditions,
                        },
                    },
                },
                {
                    $set: {
                        "comments.$[target].text":
                            normalizedText,
                        "comments.$[target].isEdited":
                            true,
                    },
                },
                {
                    new: true,
                    arrayFilters: [
                        {
                            "target._id":
                                targetObjectId,
                        },
                    ],
                }
            ).select("comments");

        const tryEditReply = () =>
            Post.findOneAndUpdate(
                {
                    ...searchFilter,
                    comments: {
                        $elemMatch: {
                            ...(parentId
                                && mongoose.Types.ObjectId
                                    .isValid(parentId)
                                ? {
                                    _id:
                                        new mongoose.Types.ObjectId(
                                            parentId
                                        ),
                                }
                                : {}),
                            replies: {
                                $elemMatch: {
                                    _id:
                                        targetObjectId,
                                    $or:
                                        ownerConditions,
                                },
                            },
                        },
                    },
                },
                {
                    $set: {
                        "comments.$[root].replies.$[reply].text":
                            normalizedText,
                        "comments.$[root].replies.$[reply].isEdited":
                            true,
                    },
                },
                {
                    new: true,
                    arrayFilters: [
                        {
                            "root.replies._id":
                                targetObjectId,
                        },
                        {
                            "reply._id":
                                targetObjectId,
                        },
                    ],
                }
            ).select("comments");

        let updatedPost = null;

        if (shouldTryReplyFirst) {
            updatedPost =
                await tryEditReply();

            if (!updatedPost) {
                updatedPost =
                    await tryEditRoot();
            }
        } else {
            updatedPost =
                await tryEditRoot();

            if (!updatedPost) {
                updatedPost =
                    await tryEditReply();
            }
        }

        if (!updatedPost) {
            const existingPost =
                await Post.findOne(
                    searchFilter
                )
                    .select("comments")
                    .lean();

            if (!existingPost) {
                return NextResponse.json(
                    {
                        message:
                            "Post not found",
                    },
                    { status: 404 }
                );
            }

            const existingMatch =
                findCommentOrReply(
                    existingPost.comments,
                    targetObjectId
                );

            if (!existingMatch) {
                return NextResponse.json(
                    {
                        message:
                            "Comment not found",
                    },
                    { status: 404 }
                );
            }

            return NextResponse.json(
                {
                    message:
                        "Unauthorized: You can only edit your own comments",
                },
                { status: 403 }
            );
        }

        const updatedMatch =
            findCommentOrReply(
                updatedPost.comments,
                targetObjectId
            );

        return NextResponse.json(
            {
                message:
                    "Comment updated successfully",
                comment:
                    toPlainComment(
                        updatedMatch?.targetComment
                    ),
            },
            { status: 200 }
        );
    } catch (error) {
        console.error(
            "PATCH comment error:",
            error
        );

        return NextResponse.json(
            {
                message: "Server error",
                error: error.message,
            },
            { status: 500 }
        );
    }
}

// ----------------------
// 🧠 UNIFIED HELPER: Telemetry, Affinity, Decay, & Optimization
// ----------------------
async function processTelemetryAndAffinity(
    fingerprint,
    post,
    candidateSources,
    action,
    weight
) {
    if (!fingerprint || !post) return;

    try {
        const user = await MobileUser.findOne({ deviceId: fingerprint })
            .select("_id affinityScores authorAffinity countryAffinity feedLearning")
            .lean();

        if (!user) return;

        const tagWeight = Number(weight) || 0;
        const authorWeight = Math.round(tagWeight * 0.5);
        const countryWeight = Math.round(tagWeight * 0.25);

        let affinityScores = user.affinityScores
            ? (
                user.affinityScores instanceof Map
                    ? Object.fromEntries(user.affinityScores)
                    : { ...user.affinityScores }
            )
            : {};

        let authorAffinity = user.authorAffinity
            ? (
                user.authorAffinity instanceof Map
                    ? Object.fromEntries(user.authorAffinity)
                    : { ...user.authorAffinity }
            )
            : {};

        let countryAffinity = user.countryAffinity
            ? (
                user.countryAffinity instanceof Map
                    ? Object.fromEntries(user.countryAffinity)
                    : { ...user.countryAffinity }
            )
            : {};

        const updateAndTrim = (obj, key, addWeight, limit) => {
            if (!key || !Number.isFinite(addWeight) || addWeight === 0) {
                return obj;
            }

            const sanitizedKey = String(key)
                .replace(/\./g, "_")
                .replace(/\$/g, "");

            if (!sanitizedKey) return obj;

            const current = typeof obj[sanitizedKey] === "number"
                ? obj[sanitizedKey]
                : 0;

            const nextValue = current + addWeight;

            // Negative feedback removes learned affinity rather than leaving a
            // negative value that the GET ranker currently treats as a fallback.
            if (nextValue <= 0) {
                delete obj[sanitizedKey];
            } else {
                obj[sanitizedKey] = Math.min(5000, nextValue);
            }

            if (Object.keys(obj).length > limit + 10) {
                return Object.fromEntries(
                    Object.entries(obj)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, limit)
                );
            }

            return obj;
        };

        if (Array.isArray(post.interests)) {
            post.interests.forEach(tag => {
                if (tag) {
                    affinityScores = updateAndTrim(
                        affinityScores,
                        tag.trim().toLowerCase(),
                        tagWeight,
                        50
                    );
                }
            });
        }

        const postAuthorUserId = post.authorUserId?.toString();
        const postAuthorDeviceId = post.authorId?.toString();
        const isOwnPost =
            postAuthorDeviceId === fingerprint
            || postAuthorUserId === user._id?.toString();

        const targetAuthor = postAuthorUserId || postAuthorDeviceId;
        if (targetAuthor && !isOwnPost) {
            authorAffinity = updateAndTrim(
                authorAffinity,
                targetAuthor,
                authorWeight,
                30
            );
        }

        if (
            post.country
            && post.country !== "Global"
            && post.country !== "Unknown"
        ) {
            countryAffinity = updateAndTrim(
                countryAffinity,
                post.country,
                countryWeight,
                10
            );
        }

        const actionMap = {
            view: "impressions",
            like: "likes",
            share: "shares",
            vote: "votes",
            watch_complete: "watch_complete",
            skip: "skips",
            not_interested: "skips",
            comment: "comments",
            hype: "votes"
        };

        const metric = actionMap[action];
        const validPools = [
            "fresh",
            "author",
            "clan",
            "interest",
            "trending",
            "explore"
        ];
        const incUpdates = {};

        if (
            metric
            && Array.isArray(candidateSources)
            && candidateSources.length > 0
        ) {
            const uniqueTypes = [
                ...new Set(
                    candidateSources
                        .slice(0, 20)
                        .map(source => source?.type)
                        .filter(type => validPools.includes(type))
                )
            ];

            if (uniqueTypes.length > 0) {
                const POOL_CONFIDENCE = {
                    explore: 1,
                    fresh: 1,
                    clan: 2,
                    trending: 4,
                    interest: 4,
                    author: 4
                };

                const scoredSources = uniqueTypes.map(type => ({
                    type,
                    confidence: POOL_CONFIDENCE[type] || 1
                }));

                const totalConfidence = scoredSources.reduce(
                    (sum, source) => sum + source.confidence,
                    0
                );

                let assignedFraction = 0;

                scoredSources.forEach((source, index) => {
                    const isLast = index === scoredSources.length - 1;
                    const normalizedFraction = isLast
                        ? Number((1 - assignedFraction).toFixed(3))
                        : Number(
                            (
                                source.confidence / totalConfidence
                            ).toFixed(3)
                        );

                    assignedFraction += normalizedFraction;

                    if (
                        Number.isFinite(normalizedFraction)
                        && normalizedFraction > 0
                    ) {
                        incUpdates[
                            `feedLearning.sourceStats.${source.type}.${metric}`
                        ] = normalizedFraction;
                    }
                });
            }
        }

        const setUpdates = {
            affinityScores,
            authorAffinity,
            countryAffinity
        };

        if (user.feedLearning) {
            const lastOptimizedAt = new Date(
                user.feedLearning.lastOptimizedAt || 0
            );
            const stats = user.feedLearning.sourceStats || {};

            let totalImpressions = 0;
            validPools.forEach(pool => {
                totalImpressions += stats[pool]?.impressions || 0;
            });

            if (
                metric === "impressions"
                && Object.keys(incUpdates).length > 0
            ) {
                totalImpressions += 1;
            }

            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (
                Date.now() - lastOptimizedAt.getTime() >= twentyFourHours
                && totalImpressions >= 100
            ) {
                const decayMap = (mapObject, factor = 0.98) => {
                    for (const key of Object.keys(mapObject)) {
                        mapObject[key] = Number(
                            (mapObject[key] * factor).toFixed(2)
                        );

                        if (mapObject[key] < 1) {
                            delete mapObject[key];
                        }
                    }
                };

                decayMap(setUpdates.affinityScores);
                decayMap(setUpdates.authorAffinity);
                decayMap(setUpdates.countryAffinity);

                let totalScore = 0;
                const rawScores = {};

                validPools.forEach(pool => {
                    const sourceStats = stats[pool] || {};
                    const impressions =
                        (sourceStats.impressions || 0)
                        + (
                            incUpdates[
                            `feedLearning.sourceStats.${pool}.impressions`
                            ] || 0
                        );

                    let score;

                    if (impressions < 20) {
                        score = 50;
                    } else {
                        const rate = metricName =>
                            (
                                (sourceStats[metricName] || 0)
                                + (
                                    incUpdates[
                                    `feedLearning.sourceStats.${pool}.${metricName}`
                                    ] || 0
                                )
                            ) / impressions;

                        score =
                            10
                            + rate("likes") * 50
                            + rate("votes") * 50
                            + rate("watch_complete") * 80
                            + rate("comments") * 100
                            + rate("shares") * 150
                            - rate("skips") * 60;
                    }

                    rawScores[pool] = Math.max(10, score);
                    totalScore += rawScores[pool];
                });

                const newWeights = {};
                validPools.forEach(pool => {
                    newWeights[pool] = rawScores[pool] / totalScore;
                });

                let clampedTotal = 0;
                validPools.forEach(pool => {
                    newWeights[pool] = Math.max(
                        0.05,
                        Math.min(0.45, newWeights[pool])
                    );
                    clampedTotal += newWeights[pool];
                });

                let assignedWeight = 0;
                validPools.forEach((pool, index) => {
                    const isLast = index === validPools.length - 1;
                    const normalizedWeight = isLast
                        ? Number((1 - assignedWeight).toFixed(3))
                        : Number(
                            (
                                newWeights[pool] / clampedTotal
                            ).toFixed(3)
                        );

                    newWeights[pool] = normalizedWeight;
                    assignedWeight += normalizedWeight;
                });

                setUpdates["feedLearning.poolWeights"] = newWeights;
                setUpdates["feedLearning.lastOptimizedAt"] = new Date();

                Object.keys(incUpdates).forEach(key => {
                    delete incUpdates[key];
                });

                validPools.forEach(pool => {
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.impressions`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.likes`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.votes`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.watch_complete`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.comments`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.shares`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.skips`
                    ] = 0;
                });

                console.log(
                    `[ML] Epoch closed for ${fingerprint}:`,
                    newWeights
                );
            }
        }

        const updateOperation = { $set: setUpdates };

        if (Object.keys(incUpdates).length > 0) {
            updateOperation.$inc = incUpdates;
        }

        await MobileUser.updateOne(
            { _id: user._id },
            updateOperation
        );
    } catch (err) {
        console.error("❌ Unified Telemetry Error:", err);
    }
}
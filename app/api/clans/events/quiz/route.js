import { sendPillParallel } from "@/app/lib/messagePillService";
import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollower";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import QuizEvent from "@/app/models/QuizEvent";
import {
    DeleteObjectCommand,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

const MAX_QUIZ_QUESTIONS = 30;
const CONCLUDED_QUIZ_STATUSES = [
    "COMPLETED",
    "CANCELLED",
];

const r2Client = new S3Client({
    region: "auto",
    endpoint:
        `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId:
            process.env.R2_ACCESS_KEY_ID,
        secretAccessKey:
            process.env.R2_SECRET_ACCESS_KEY,
    },
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

const uploadQuestionImageToR2 = async (
    base64String,
    eventId,
    uploadLabel
) => {
    const matches = String(
        base64String || ""
    ).match(
        /^data:([a-zA-Z0-9]+\/[a-zA-Z0-9-.+]+);base64,(.*)$/
    );

    if (!matches || matches.length !== 3) {
        throw new Error(
            "Invalid base64 format image data."
        );
    }

    const contentType = matches[1];
    const buffer = Buffer.from(
        matches[2],
        "base64"
    );

    const extension =
        contentType.split("/")[1] || "png";

    const key =
        `quizzes/${eventId}/question_${uploadLabel}_${Date.now()}_${new mongoose.Types.ObjectId()}.${extension}`;

    await r2Client.send(
        new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        })
    );

    const domain =
        process.env.NEW_DOMAIN
        || "https://media.oreblogda.com";

    return {
        key,
        url: `${domain}/${key}`,
    };
};

const cleanupUploadedQuestionImages =
    async keys => {
        const uniqueKeys = [
            ...new Set(
                (keys || []).filter(Boolean)
            ),
        ];

        if (uniqueKeys.length === 0) return;

        const results = await Promise.allSettled(
            uniqueKeys.map(key =>
                r2Client.send(
                    new DeleteObjectCommand({
                        Bucket:
                            process.env
                                .R2_BUCKET_NAME,
                        Key: key,
                    })
                )
            )
        );

        for (const result of results) {
            if (result.status === "rejected") {
                console.error(
                    "Failed to clean unused quiz image:",
                    result.reason
                );
            }
        }
    };

const normalizeQuestion = ({
    question,
    imageUrl,
}) => {
    const questionText = String(
        question?.questionText || ""
    ).trim();

    const options = Array.isArray(
        question?.options
    )
        ? question.options.map(option =>
            String(option || "").trim()
        )
        : [];

    const correctOptionIndex = Number(
        question?.correctOptionIndex
    );

    if (!questionText) {
        throw new Error(
            "Every quiz question requires question text."
        );
    }

    if (
        options.length < 2
        || options.some(option => !option)
    ) {
        throw new Error(
            "Every quiz question requires at least two valid options."
        );
    }

    if (
        !Number.isInteger(correctOptionIndex)
        || correctOptionIndex < 0
        || correctOptionIndex >= options.length
    ) {
        throw new Error(
            "A quiz question has an invalid correct option."
        );
    }

    return {
        questionText,
        imageUrl: imageUrl || null,
        options,
        correctOptionIndex,
        releasedAt:
            question?.releasedAt || null,
    };
};

const processQuestionBatch = async ({
    questions,
    eventId,
}) => {
    const processedQuestions = [];
    const uploadedKeys = [];

    try {
        for (
            let index = 0;
            index < questions.length;
            index += 1
        ) {
            const question = questions[index];
            let imageUrl =
                question?.imageUrl || null;

            if (
                typeof imageUrl === "string"
                && imageUrl.startsWith(
                    "data:image"
                )
            ) {
                const upload =
                    await uploadQuestionImageToR2(
                        imageUrl,
                        eventId,
                        `batch_${index}`
                    );

                imageUrl = upload.url;
                uploadedKeys.push(upload.key);
            }

            processedQuestions.push(
                normalizeQuestion({
                    question,
                    imageUrl,
                })
            );
        }

        return {
            processedQuestions,
            uploadedKeys,
        };
    } catch (error) {
        await cleanupUploadedQuestionImages(
            uploadedKeys
        );
        throw error;
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

const finalizeExpiredQuiz = async (
    eventId,
    now
) => {
    const leaderboardExpiry =
        new Date(
            now.getTime()
            + 12 * 60 * 60 * 1000
        );

    return QuizEvent.findOneAndUpdate(
        {
            _id: eventId,
            status: {
                $nin:
                    CONCLUDED_QUIZ_STATUSES,
            },
            $or: [
                {
                    endsAt: {
                        $ne: null,
                        $lte: now,
                    },
                },
                {
                    expiresAt: {
                        $lte: now,
                    },
                },
            ],
        },
        [
            {
                $set: {
                    status: {
                        $cond: [
                            {
                                $and: [
                                    {
                                        $eq: [
                                            "$status",
                                            "LIVE",
                                        ],
                                    },
                                    {
                                        $gt: [
                                            {
                                                $size: {
                                                    $ifNull:
                                                        [
                                                            "$quizQuestions",
                                                            [],
                                                        ],
                                                },
                                            },
                                            0,
                                        ],
                                    },
                                ],
                            },
                            "COMPLETED",
                            "CANCELLED",
                        ],
                    },
                    expiresAt:
                        leaderboardExpiry,
                    updatedAt: "$$NOW",
                },
            },
        ],
        {
            new: true,
        }
    )
        .select("_id status")
        .lean();
};

const buildQuestionConflictResponse =
    async ({
        eventId,
        incomingQuestionCount,
        deviceId,
        uploadedKeys,
    }) => {
        await cleanupUploadedQuestionImages(
            uploadedKeys
        );

        const latest = await QuizEvent.findById(
            eventId
        )
            .select(
                "status maxQuestions quizQuestions "
                + "leaderDeviceId moderatedBy"
            )
            .lean();

        if (!latest) {
            return NextResponse.json(
                { message: "Quiz not found." },
                { status: 404 }
            );
        }

        const authorized =
            latest.leaderDeviceId === deviceId
            || latest.moderatedBy?.includes(
                deviceId
            );

        if (!authorized) {
            return NextResponse.json(
                { message: "Access Denied." },
                { status: 403 }
            );
        }

        if (latest.status !== "COMING_SOON") {
            return NextResponse.json(
                {
                    message:
                        "Cannot modify an active quiz.",
                },
                { status: 409 }
            );
        }

        if (incomingQuestionCount === 0) {
            return NextResponse.json(
                {
                    message:
                        "The quiz changed before your settings were saved. Refresh and try again.",
                    code:
                        "EVENT_STATE_CONFLICT",
                },
                { status: 409 }
            );
        }

        const currentQuestionCount =
            latest.quizQuestions?.length || 0;

        const maxQuestions =
            Number(latest.maxQuestions)
            || MAX_QUIZ_QUESTIONS;

        const remainingSlots = Math.max(
            0,
            maxQuestions
            - currentQuestionCount
        );

        return NextResponse.json(
            {
                success: false,
                code:
                    "QUESTION_CAPACITY_CONFLICT",
                conflict: true,
                actionRequired:
                    "REFRESH_AND_COLLATE",
                message:
                    "There are questions currently loaded into this quiz by another moderator. Your batch no longer fits. Refresh the quiz, collate both question sets, and confirm the final list.",
                currentQuestionCount,
                incomingQuestionCount,
                maxQuestions,
                remainingSlots,
            },
            { status: 409 }
        );
    };

export async function POST(req) {
    await connectDB();

    let uploadedKeys = [];

    try {
        const body = await req.json();

        const {
            clanId,
            title,
            description,
            visibility,
            deliveryMode,
            streamGapMinutes,
            scheduledStartTime,
            quizQuestions,
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
            || !scheduledStartTime
        ) {
            return NextResponse.json(
                {
                    message:
                        "Missing primary details.",
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
                        "Access Denied: Only Clan Leaders and Vice Leaders hold creation clearance.",
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

        const targetVisibility =
            visibility?.toUpperCase() === "PRIVATE"
                ? "PRIVATE"
                : "PUBLIC";

        // Fast UX check. Strict cross-document enforcement requires the
        // index/slot strategy documented in the included notes.
        if (targetVisibility === "PUBLIC") {
            const activePublicCount =
                await QuizEvent.countDocuments({
                    visibility: "PUBLIC",
                    status: {
                        $in: [
                            "COMING_SOON",
                            "LIVE",
                        ],
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

        const duplicateConflict =
            await QuizEvent.findOne({
                clanId: normalizedClanId,
                status: {
                    $in: [
                        "COMING_SOON",
                        "LIVE",
                    ],
                },
            })
                .select("_id")
                .lean();

        if (duplicateConflict) {
            return NextResponse.json(
                {
                    message:
                        "Your clan already has an active Quiz.",
                },
                { status: 409 }
            );
        }

        const now = new Date();
        const scheduledTime =
            new Date(scheduledStartTime);

        if (
            Number.isNaN(
                scheduledTime.getTime()
            )
            || scheduledTime < now
            || scheduledTime
            > new Date(
                now.getTime()
                + 24 * 60 * 60 * 1000
            )
        ) {
            return NextResponse.json(
                {
                    message:
                        "Start time must be within the next 24 hours.",
                },
                { status: 400 }
            );
        }

        const generatedEventId =
            new mongoose.Types.ObjectId();

        const incomingQuestions =
            Array.isArray(quizQuestions)
                ? quizQuestions
                : [];

        if (
            incomingQuestions.length
            > MAX_QUIZ_QUESTIONS
        ) {
            return NextResponse.json(
                {
                    message:
                        `Max allowed questions is ${MAX_QUIZ_QUESTIONS}.`,
                },
                { status: 400 }
            );
        }

        const processed =
            await processQuestionBatch({
                questions: incomingQuestions,
                eventId:
                    generatedEventId.toString(),
            });

        uploadedKeys = processed.uploadedKeys;

        const maxLifespan =
            new Date(
                scheduledTime.getTime()
                + 60 * 60 * 1000
            );

        const normalizedDeliveryMode =
            deliveryMode === "STREAMED"
                ? "STREAMED"
                : "BATCH";

        const newQuiz =
            await QuizEvent.create({
                _id: generatedEventId,
                clanId: normalizedClanId,
                clanName: targetClan.name,
                leaderDeviceId: deviceId,
                moderatedBy: [deviceId],
                title: String(title).trim(),
                description:
                    String(description).trim(),
                visibility: targetVisibility,
                status: "COMING_SOON",
                deliveryMode:
                    normalizedDeliveryMode,
                streamGapMinutes:
                    normalizedDeliveryMode
                        === "STREAMED"
                        ? Math.min(
                            Number.parseInt(
                                streamGapMinutes,
                                10
                            ) || 5,
                            15
                        )
                        : null,
                scheduledStartTime:
                    scheduledTime,
                expiresAt: maxLifespan,
                maxQuestions:
                    MAX_QUIZ_QUESTIONS,
                quizQuestions:
                    processed.processedQuestions,
                leaderboard: [],
                participants: [],
                blacklistedDeviceIds: [],
                acknowledgeCount: 0,
                acknowledgedBy: [],
            });

        uploadedKeys = [];

        return NextResponse.json(
            {
                success: true,
                data: newQuiz,
            },
            { status: 201 }
        );
    } catch (error) {
        await cleanupUploadedQuestionImages(
            uploadedKeys
        );

        if (error?.code === 11000) {
            return NextResponse.json(
                {
                    message:
                        "Your clan already has an active quiz or the public event slot was claimed concurrently.",
                    code: "EVENT_SLOT_CONFLICT",
                },
                { status: 409 }
            );
        }

        console.error(
            "⛔ QUIZ_CREATION_CRASH:",
            error
        );

        return NextResponse.json(
            {
                message:
                    error?.message
                    || "Server error during creation.",
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
            username,
            userAnswers,
            answerIndex,
            questionIndex,
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
                        "Missing request details.",
                },
                { status: 400 }
            );
        }

        const now = new Date();

        const finalized =
            await finalizeExpiredQuiz(
                eventId,
                now
            );

        if (finalized) {
            return NextResponse.json(
                {
                    message:
                        "This quiz has concluded.",
                    status: finalized.status,
                },
                { status: 410 }
            );
        }

        let event = await QuizEvent.findById(
            eventId
        ).lean();

        if (!event) {
            return NextResponse.json(
                { message: "Quiz not found." },
                { status: 404 }
            );
        }

        const isLeader =
            event.leaderDeviceId === deviceId;

        const isModerator =
            event.moderatedBy?.includes(
                deviceId
            );

        if (
            event.visibility === "PRIVATE"
            && !isLeader
            && !isModerator
        ) {
            const allowed =
                await canAccessPrivateClanEvent({
                    deviceId,
                    clanTag: event.clanId,
                });

            if (!allowed) {
                return NextResponse.json(
                    {
                        message:
                            "Access Denied: Clan clearance required.",
                    },
                    { status: 403 }
                );
            }
        }

        const normalizedAction =
            String(action).toUpperCase();

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
                        event.leaderDeviceId,
                    ]);

                const updated =
                    await QuizEvent.findOneAndUpdate(
                        {
                            _id: eventId,
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
                                "Quiz changed or access was revoked. Refresh.",
                            code:
                                "EVENT_STATE_CONFLICT",
                        },
                        { status: 409 }
                    );
                }

                return NextResponse.json(
                    {
                        success: true,
                        message: "Staff updated.",
                    },
                    { status: 200 }
                );
            }

            case "UPDATE_QUIZ": {
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
                    event.status
                    !== "COMING_SOON"
                ) {
                    return NextResponse.json(
                        {
                            message:
                                "Cannot modify an active quiz.",
                        },
                        { status: 409 }
                    );
                }

                const incomingQuestions =
                    Array.isArray(
                        payload.quizQuestions
                    )
                        ? payload.quizQuestions
                        : [];

                if (
                    incomingQuestions.length
                    > MAX_QUIZ_QUESTIONS
                ) {
                    return NextResponse.json(
                        {
                            message:
                                `A single batch cannot exceed ${MAX_QUIZ_QUESTIONS} questions.`,
                        },
                        { status: 400 }
                    );
                }

                let processedQuestions = [];
                let uploadedKeys = [];

                if (
                    incomingQuestions.length > 0
                ) {
                    const processed =
                        await processQuestionBatch({
                            questions:
                                incomingQuestions,
                            eventId:
                                String(eventId),
                        });

                    processedQuestions =
                        processed.processedQuestions;
                    uploadedKeys =
                        processed.uploadedKeys;
                }

                const setChanges = {};

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
                    payload.deliveryMode
                    !== undefined
                ) {
                    setChanges.deliveryMode =
                        payload.deliveryMode
                            === "STREAMED"
                            ? "STREAMED"
                            : "BATCH";
                }

                if (
                    payload.streamGapMinutes
                    !== undefined
                ) {
                    setChanges.streamGapMinutes =
                        Math.min(
                            Math.max(
                                Number.parseInt(
                                    payload
                                        .streamGapMinutes,
                                    10
                                ) || 1,
                                1
                            ),
                            15
                        );
                }

                const query = {
                    _id: eventId,
                    status: "COMING_SOON",
                    ...moderatorFilter(
                        deviceId
                    ),
                };

                if (
                    processedQuestions.length > 0
                ) {
                    query.$expr = {
                        $lte: [
                            {
                                $add: [
                                    {
                                        $size: {
                                            $ifNull:
                                                [
                                                    "$quizQuestions",
                                                    [],
                                                ],
                                        },
                                    },
                                    processedQuestions.length,
                                ],
                            },
                            {
                                $ifNull: [
                                    "$maxQuestions",
                                    MAX_QUIZ_QUESTIONS,
                                ],
                            },
                        ],
                    };
                }

                const update = {};

                if (
                    Object.keys(setChanges).length
                    > 0
                ) {
                    update.$set = setChanges;
                }

                if (
                    processedQuestions.length > 0
                ) {
                    update.$push = {
                        quizQuestions: {
                            $each:
                                processedQuestions,
                        },
                    };
                }

                if (
                    Object.keys(update).length
                    === 0
                ) {
                    return NextResponse.json(
                        {
                            success: true,
                            message:
                                "No quiz settings changed.",
                            questionCount:
                                event.quizQuestions
                                    ?.length || 0,
                        },
                        { status: 200 }
                    );
                }

                let updated;

                try {
                    updated =
                        await QuizEvent.findOneAndUpdate(
                            query,
                            update,
                            {
                                new: true,
                                runValidators: true,
                            }
                        )
                            .select(
                                "quizQuestions maxQuestions"
                            )
                            .lean();
                } catch (error) {
                    await cleanupUploadedQuestionImages(
                        uploadedKeys
                    );
                    throw error;
                }

                if (!updated) {
                    return buildQuestionConflictResponse({
                        eventId,
                        incomingQuestionCount:
                            processedQuestions.length,
                        deviceId,
                        uploadedKeys,
                    });
                }

                const questionCount =
                    updated.quizQuestions?.length
                    || 0;

                const maxQuestions =
                    Number(updated.maxQuestions)
                    || MAX_QUIZ_QUESTIONS;

                return NextResponse.json(
                    {
                        success: true,
                        message:
                            processedQuestions.length
                                > 0
                                ? `${processedQuestions.length} questions appended successfully.`
                                : "Settings updated.",
                        appendedQuestionCount:
                            processedQuestions.length,
                        questionCount,
                        maxQuestions,
                        remainingSlots:
                            Math.max(
                                0,
                                maxQuestions
                                - questionCount
                            ),
                    },
                    { status: 200 }
                );
            }

            case "ACKNOWLEDGE": {
                if (
                    event.status
                    !== "COMING_SOON"
                ) {
                    return NextResponse.json(
                        {
                            message:
                                "Sign-up period is over.",
                        },
                        { status: 409 }
                    );
                }

                const user =
                    await MobileUser.findOne({
                        deviceId,
                    })
                        .select("username")
                        .lean();

                if (!user) {
                    return NextResponse.json(
                        {
                            message:
                                "User profile not found.",
                        },
                        { status: 404 }
                    );
                }

                const participant = {
                    deviceId,
                    username:
                        user.username
                        || "Anonymous",
                };

                const updated =
                    await QuizEvent.findOneAndUpdate(
                        {
                            _id: eventId,
                            status: "COMING_SOON",
                            acknowledgedBy: {
                                $ne: deviceId,
                            },
                            blacklistedDeviceIds: {
                                $ne: deviceId,
                            },
                        },
                        [
                            {
                                $set: {
                                    acknowledgedBy: {
                                        $concatArrays:
                                            [
                                                {
                                                    $ifNull:
                                                        [
                                                            "$acknowledgedBy",
                                                            [],
                                                        ],
                                                },
                                                [deviceId],
                                            ],
                                    },
                                    acknowledgeCount: {
                                        $add: [
                                            {
                                                $size: {
                                                    $ifNull:
                                                        [
                                                            "$acknowledgedBy",
                                                            [],
                                                        ],
                                                },
                                            },
                                            1,
                                        ],
                                    },
                                    participants: {
                                        $cond: [
                                            {
                                                $in: [
                                                    deviceId,
                                                    {
                                                        $map: {
                                                            input: {
                                                                $ifNull:
                                                                    [
                                                                        "$participants",
                                                                        [],
                                                                    ],
                                                            },
                                                            as: "participant",
                                                            in: "$$participant.deviceId",
                                                        },
                                                    },
                                                ],
                                            },
                                            {
                                                $ifNull: [
                                                    "$participants",
                                                    [],
                                                ],
                                            },
                                            {
                                                $concatArrays:
                                                    [
                                                        {
                                                            $ifNull:
                                                                [
                                                                    "$participants",
                                                                    [],
                                                                ],
                                                        },
                                                        [
                                                            participant,
                                                        ],
                                                    ],
                                            },
                                        ],
                                    },
                                    updatedAt: "$$NOW",
                                },
                            },
                        ],
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
                        await QuizEvent.findById(
                            eventId
                        )
                            .select(
                                "status acknowledgedBy blacklistedDeviceIds"
                            )
                            .lean();

                    if (
                        latest?.blacklistedDeviceIds
                            ?.includes(deviceId)
                    ) {
                        return NextResponse.json(
                            {
                                message:
                                    "You are banned from this event.",
                            },
                            { status: 403 }
                        );
                    }

                    if (
                        latest?.acknowledgedBy
                            ?.includes(deviceId)
                    ) {
                        return NextResponse.json(
                            {
                                message:
                                    "You have already joined.",
                            },
                            { status: 409 }
                        );
                    }

                    return NextResponse.json(
                        {
                            message:
                                "Sign-up period changed. Refresh the quiz.",
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
                            "You joined the quiz!",
                        acknowledgeCount:
                            updated.acknowledgeCount,
                    },
                    { status: 200 }
                );
            }

            case "START_QUIZ": {
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

                let startedQuiz = null;

                await mongoose.connection.transaction(
                    async session => {
                        const quiz =
                            await QuizEvent.findOne({
                                _id: eventId,
                                status:
                                    "COMING_SOON",
                                ...moderatorFilter(
                                    deviceId
                                ),
                                "quizQuestions.0": {
                                    $exists: true,
                                },
                            }).session(session);

                        if (!quiz) return;

                        const startedAt =
                            new Date();

                        quiz.status = "LIVE";
                        quiz.startedAt =
                            startedAt;

                        if (
                            quiz.deliveryMode
                            === "STREAMED"
                        ) {
                            const gapMs =
                                (
                                    quiz
                                        .streamGapMinutes
                                    || 5
                                )
                                * 60
                                * 1000;

                            quiz.endsAt =
                                new Date(
                                    startedAt.getTime()
                                    + quiz
                                        .quizQuestions
                                        .length
                                    * gapMs
                                );

                            quiz.currentStreamIndex =
                                0;

                            quiz.quizQuestions[
                                0
                            ].releasedAt =
                                startedAt;

                            if (
                                quiz.quizQuestions
                                    .length > 1
                            ) {
                                quiz.quizQuestions[
                                    1
                                ].releasedAt =
                                    new Date(
                                        startedAt.getTime()
                                        + gapMs
                                    );
                            }
                        } else {
                            quiz.endsAt =
                                new Date(
                                    startedAt.getTime()
                                    + 2
                                    * 60
                                    * 60
                                    * 1000
                                );
                        }

                        quiz.expiresAt =
                            new Date(
                                quiz.endsAt.getTime()
                                + 12
                                * 60
                                * 60
                                * 1000
                            );

                        await quiz.save({
                            session,
                        });

                        startedQuiz = {
                            title: quiz.title,
                            clanName:
                                quiz.clanName,
                            acknowledgedBy:
                                [
                                    ...(
                                        quiz
                                            .acknowledgedBy
                                        || []
                                    ),
                                ],
                        };
                    }
                );

                if (!startedQuiz) {
                    return NextResponse.json(
                        {
                            message:
                                "Quiz could not be started. It may already be live, empty, or your access changed.",
                            code:
                                "EVENT_STATE_CONFLICT",
                        },
                        { status: 409 }
                    );
                }

                if (
                    startedQuiz
                        .acknowledgedBy.length > 0
                ) {
                    try {
                        const users =
                            await MobileUser.find({
                                deviceId: {
                                    $in:
                                        startedQuiz
                                            .acknowledgedBy,
                                },
                                pushToken: {
                                    $nin: [null, ""],
                                },
                            })
                                .select(
                                    "deviceId pushToken"
                                )
                                .lean();

                        await Promise.allSettled(
                            users.map(user =>
                                sendPillParallel(
                                    [user.pushToken],
                                    `🟢 Quiz LIVE: ${startedQuiz.title}`,
                                    `The quiz in ${startedQuiz.clanName} has just started! Jump in now to secure your spot.`,
                                    {
                                        screen:
                                            `/screens/events?id=${eventId}`,
                                        eventId:
                                            String(eventId),
                                        type:
                                            "quiz_live",
                                    },
                                    {
                                        type: "event",
                                        targetAudience:
                                            "user",
                                        targetId:
                                            user.deviceId,
                                        groupId:
                                            String(eventId),
                                        expiresInHours: 2,
                                    }
                                )
                            )
                        );
                    } catch (error) {
                        console.error(
                            "Failed to send quiz start notifications:",
                            error
                        );
                    }
                }

                return NextResponse.json(
                    {
                        success: true,
                        message:
                            "Quiz is now LIVE!",
                    },
                    { status: 200 }
                );
            }

            case "SUBMIT_ENTRY": {
                if (
                    event.status !== "LIVE"
                ) {
                    return NextResponse.json(
                        {
                            message:
                                "Quiz is not accepting answers.",
                        },
                        { status: 409 }
                    );
                }

                if (!username?.trim()) {
                    return NextResponse.json(
                        {
                            message:
                                "Missing player name.",
                        },
                        { status: 400 }
                    );
                }

                if (
                    event.blacklistedDeviceIds
                        ?.includes(deviceId)
                ) {
                    return NextResponse.json(
                        {
                            message:
                                "You are banned from this event.",
                        },
                        { status: 403 }
                    );
                }

                if (
                    event.deliveryMode === "BATCH"
                ) {
                    if (
                        !Array.isArray(
                            userAnswers
                        )
                    ) {
                        return NextResponse.json(
                            {
                                message:
                                    "Invalid format.",
                            },
                            { status: 400 }
                        );
                    }

                    let score = 0;
                    const answeredQuestionIndexes =
                        [];
                    const responses = [];

                    event.quizQuestions.forEach(
                        (question, index) => {
                            const selected =
                                userAnswers[index];

                            if (
                                selected === undefined
                                || selected === -1
                            ) {
                                return;
                            }

                            const isCorrect =
                                selected
                                === question
                                    .correctOptionIndex;

                            if (isCorrect) {
                                score += 1;
                            }

                            answeredQuestionIndexes.push(
                                index
                            );

                            responses.push({
                                questionIndex:
                                    index,
                                selectedOptionIndex:
                                    selected,
                                isCorrect,
                            });
                        }
                    );

                    const result =
                        await QuizEvent.updateOne(
                            {
                                _id: eventId,
                                status: "LIVE",
                                deliveryMode:
                                    "BATCH",
                                blacklistedDeviceIds:
                                {
                                    $ne:
                                        deviceId,
                                },
                                "leaderboard.deviceId":
                                {
                                    $ne:
                                        deviceId,
                                },
                                $or: [
                                    {
                                        endsAt: null,
                                    },
                                    {
                                        endsAt: {
                                            $gt: now,
                                        },
                                    },
                                ],
                            },
                            {
                                $push: {
                                    leaderboard: {
                                        deviceId,
                                        username:
                                            username.trim(),
                                        score,
                                        answeredQuestionIndexes,
                                        responses,
                                    },
                                },
                            }
                        );

                    if (
                        result.modifiedCount === 0
                    ) {
                        return NextResponse.json(
                            {
                                message:
                                    "You have already finished or the quiz state changed.",
                                code:
                                    "ANSWER_CONFLICT",
                            },
                            { status: 409 }
                        );
                    }
                } else {
                    const numericQuestionIndex =
                        Number(questionIndex);

                    const numericAnswerIndex =
                        Number(answerIndex);

                    if (
                        !Number.isInteger(
                            numericQuestionIndex
                        )
                        || !Number.isInteger(
                            numericAnswerIndex
                        )
                        || numericQuestionIndex < 0
                        || numericQuestionIndex
                        >= event
                            .quizQuestions
                            .length
                    ) {
                        return NextResponse.json(
                            {
                                message:
                                    "Invalid question or answer.",
                            },
                            { status: 400 }
                        );
                    }

                    const targetQuestion =
                        event.quizQuestions[
                        numericQuestionIndex
                        ];

                    if (
                        numericAnswerIndex < 0
                        || numericAnswerIndex
                        >= targetQuestion
                            .options.length
                    ) {
                        return NextResponse.json(
                            {
                                message:
                                    "Invalid answer.",
                            },
                            { status: 400 }
                        );
                    }

                    if (
                        numericQuestionIndex
                        > Number(
                            event.currentStreamIndex
                            || 0
                        )
                    ) {
                        if (
                            !targetQuestion
                                .releasedAt
                            || now
                            < new Date(
                                targetQuestion
                                    .releasedAt
                            )
                        ) {
                            return NextResponse.json(
                                {
                                    message:
                                        "Hold up, this question is not active yet.",
                                },
                                { status: 409 }
                            );
                        }

                        const nextReleaseTime =
                            new Date(
                                now.getTime()
                                + (
                                    event
                                        .streamGapMinutes
                                    || 5
                                )
                                * 60
                                * 1000
                            );

                        const streamSet = {
                            currentStreamIndex:
                                numericQuestionIndex,
                        };

                        if (
                            numericQuestionIndex + 1
                            < event.quizQuestions.length
                        ) {
                            streamSet[
                                `quizQuestions.${numericQuestionIndex + 1}.releasedAt`
                            ] = nextReleaseTime;
                        }

                        await QuizEvent.updateOne(
                            {
                                _id: eventId,
                                status: "LIVE",
                                currentStreamIndex: {
                                    $lt:
                                        numericQuestionIndex,
                                },
                            },
                            {
                                $set: streamSet,
                            }
                        );
                    } else if (
                        numericQuestionIndex
                        < Number(
                            event.currentStreamIndex
                            || 0
                        )
                    ) {
                        return NextResponse.json(
                            {
                                message:
                                    "This question has already passed.",
                            },
                            { status: 409 }
                        );
                    }

                    const isCorrect =
                        targetQuestion
                            .correctOptionIndex
                        === numericAnswerIndex;

                    const answerFilter = {
                        _id: eventId,
                        status: "LIVE",
                        deliveryMode:
                            "STREAMED",
                        currentStreamIndex:
                            numericQuestionIndex,
                        blacklistedDeviceIds: {
                            $ne: deviceId,
                        },
                        $or: [
                            { endsAt: null },
                            {
                                endsAt: {
                                    $gt: now,
                                },
                            },
                        ],
                    };

                    const existingResult =
                        await QuizEvent.updateOne(
                            {
                                ...answerFilter,
                                leaderboard: {
                                    $elemMatch: {
                                        deviceId,
                                        answeredQuestionIndexes:
                                        {
                                            $ne:
                                                numericQuestionIndex,
                                        },
                                    },
                                },
                            },
                            {
                                $inc: {
                                    "leaderboard.$.score":
                                        isCorrect
                                            ? 1
                                            : 0,
                                },
                                $push: {
                                    "leaderboard.$.answeredQuestionIndexes":
                                        numericQuestionIndex,
                                    "leaderboard.$.responses":
                                    {
                                        questionIndex:
                                            numericQuestionIndex,
                                        selectedOptionIndex:
                                            numericAnswerIndex,
                                        isCorrect,
                                    },
                                },
                            }
                        );

                    if (
                        existingResult.modifiedCount
                        === 0
                    ) {
                        const insertResult =
                            await QuizEvent.updateOne(
                                {
                                    ...answerFilter,
                                    "leaderboard.deviceId":
                                    {
                                        $ne:
                                            deviceId,
                                    },
                                },
                                {
                                    $push: {
                                        leaderboard: {
                                            deviceId,
                                            username:
                                                username.trim(),
                                            score:
                                                isCorrect
                                                    ? 1
                                                    : 0,
                                            answeredQuestionIndexes:
                                                [
                                                    numericQuestionIndex,
                                                ],
                                            responses: [
                                                {
                                                    questionIndex:
                                                        numericQuestionIndex,
                                                    selectedOptionIndex:
                                                        numericAnswerIndex,
                                                    isCorrect,
                                                },
                                            ],
                                        },
                                    },
                                }
                            );

                        if (
                            insertResult.modifiedCount
                            === 0
                        ) {
                            return NextResponse.json(
                                {
                                    message:
                                        "You already answered or the active question changed.",
                                    code:
                                        "ANSWER_CONFLICT",
                                },
                                { status: 409 }
                            );
                        }
                    }
                }

                const updatedEvent =
                    await QuizEvent.findById(
                        eventId
                    ).lean();

                const sortedLeaderboard = [
                    ...(
                        updatedEvent
                            ?.leaderboard || []
                    ),
                ].sort(
                    (a, b) =>
                        Number(b.score || 0)
                        - Number(a.score || 0)
                );

                return NextResponse.json(
                    {
                        success: true,
                        leaderboard:
                            sortedLeaderboard,
                        event: updatedEvent,
                    },
                    { status: 200 }
                );
            }

            case "STREAM_NEXT": {
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

                let result = null;

                await mongoose.connection.transaction(
                    async session => {
                        const quiz =
                            await QuizEvent.findOne({
                                _id: eventId,
                                deliveryMode:
                                    "STREAMED",
                                status: "LIVE",
                                ...moderatorFilter(
                                    deviceId
                                ),
                            }).session(session);

                        if (!quiz) return;

                        const nextIndex =
                            Number(
                                quiz.currentStreamIndex
                                || 0
                            ) + 1;

                        if (
                            nextIndex
                            >= quiz.quizQuestions.length
                        ) {
                            quiz.status =
                                "COMPLETED";
                            quiz.expiresAt =
                                new Date(
                                    Date.now()
                                    + 12
                                    * 60
                                    * 60
                                    * 1000
                                );
                        } else {
                            quiz.currentStreamIndex =
                                nextIndex;

                            const releaseTime =
                                new Date();

                            quiz.quizQuestions[
                                nextIndex
                            ].releasedAt =
                                releaseTime;

                            if (
                                nextIndex + 1
                                < quiz
                                    .quizQuestions
                                    .length
                            ) {
                                quiz.quizQuestions[
                                    nextIndex + 1
                                ].releasedAt =
                                    new Date(
                                        releaseTime.getTime()
                                        + (
                                            quiz
                                                .streamGapMinutes
                                            || 5
                                        )
                                        * 60
                                        * 1000
                                    );
                            }
                        }

                        await quiz.save({
                            session,
                        });

                        result = {
                            currentStreamIndex:
                                quiz.currentStreamIndex,
                            status: quiz.status,
                        };
                    }
                );

                if (!result) {
                    return NextResponse.json(
                        {
                            message:
                                "The stream changed before this action completed. Refresh.",
                            code:
                                "EVENT_STATE_CONFLICT",
                        },
                        { status: 409 }
                    );
                }

                return NextResponse.json(
                    {
                        success: true,
                        ...result,
                    },
                    { status: 200 }
                );
            }

            case "BLACKLIST_USER": {
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

                const targetDeviceId =
                    String(
                        payload.targetDeviceId
                        || ""
                    ).trim();

                if (!targetDeviceId) {
                    return NextResponse.json(
                        {
                            message:
                                "Target player ID required.",
                        },
                        { status: 400 }
                    );
                }

                const updated =
                    await QuizEvent.findOneAndUpdate(
                        {
                            _id: eventId,
                            ...moderatorFilter(
                                deviceId
                            ),
                        },
                        [
                            {
                                $set: {
                                    blacklistedDeviceIds:
                                    {
                                        $setUnion: [
                                            {
                                                $ifNull:
                                                    [
                                                        "$blacklistedDeviceIds",
                                                        [],
                                                    ],
                                            },
                                            [
                                                targetDeviceId,
                                            ],
                                        ],
                                    },
                                    participants: {
                                        $filter: {
                                            input: {
                                                $ifNull: [
                                                    "$participants",
                                                    [],
                                                ],
                                            },
                                            as: "participant",
                                            cond: {
                                                $ne: [
                                                    "$$participant.deviceId",
                                                    targetDeviceId,
                                                ],
                                            },
                                        },
                                    },
                                    leaderboard: {
                                        $filter: {
                                            input: {
                                                $ifNull: [
                                                    "$leaderboard",
                                                    [],
                                                ],
                                            },
                                            as: "entry",
                                            cond: {
                                                $ne: [
                                                    "$$entry.deviceId",
                                                    targetDeviceId,
                                                ],
                                            },
                                        },
                                    },
                                    acknowledgedBy: {
                                        $filter: {
                                            input: {
                                                $ifNull: [
                                                    "$acknowledgedBy",
                                                    [],
                                                ],
                                            },
                                            as: "acknowledgedDeviceId",
                                            cond: {
                                                $ne: [
                                                    "$$acknowledgedDeviceId",
                                                    targetDeviceId,
                                                ],
                                            },
                                        },
                                    },
                                    updatedAt: "$$NOW",
                                },
                            },
                            {
                                $set: {
                                    acknowledgeCount: {
                                        $size: {
                                            $ifNull: [
                                                "$acknowledgedBy",
                                                [],
                                            ],
                                        },
                                    },
                                },
                            },
                        ],
                        { new: true }
                    )
                        .select(
                            "_id acknowledgeCount"
                        )
                        .lean();

                if (!updated) {
                    return NextResponse.json(
                        {
                            message:
                                "Quiz changed or access was revoked. Refresh.",
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
                            "Player removed and banned.",
                        acknowledgeCount:
                            updated.acknowledgeCount,
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
                    await QuizEvent.findOneAndUpdate(
                        {
                            _id: eventId,
                            ...moderatorFilter(
                                deviceId
                            ),
                            status: {
                                $nin:
                                    CONCLUDED_QUIZ_STATUSES,
                            },
                        },
                        {
                            $set: {
                                status: "COMPLETED",
                                expiresAt:
                                    new Date(
                                        Date.now()
                                        + 12
                                        * 60
                                        * 60
                                        * 1000
                                    ),
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
                                "Quiz already ended or the event changed. Refresh.",
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
                            "Quiz ended early.",
                    },
                    { status: 200 }
                );
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
            "⛔ QUIZ_PATCH_CRASH:",
            error
        );

        return NextResponse.json(
            {
                message:
                    error?.message
                    || "Server error during update.",
            },
            { status: 500 }
        );
    }
}
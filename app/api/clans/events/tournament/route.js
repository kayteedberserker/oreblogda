import { sendPillParallel } from "@/app/lib/messagePillService";
import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollower";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import Tournament from "@/app/models/Tournament";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

const ACTIVE_EVENT_STATUSES = ["REGISTRATION", "LIVE"];
const CONCLUDED_EVENT_STATUSES = ["COMPLETED", "CANCELLED"];
const MATCH_STATUSES = [
    "PENDING",
    "REGISTRATION",
    "LIVE",
    "COMPLETED",
    "CANCELLED",
];

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

const rebuildLeaderboard = tournament => {
    const aggregateCalcMap = {};

    for (const matchItem of tournament.matches || []) {
        if (
            !matchItem.trackPerformance
            || !Array.isArray(matchItem.results)
        ) {
            continue;
        }

        for (const result of matchItem.results) {
            const targetId = String(result.targetId || "");
            if (!targetId) continue;

            if (!aggregateCalcMap[targetId]) {
                aggregateCalcMap[targetId] = {
                    targetId,
                    displayName:
                        result.displayName || "Unknown",
                    totalMatchesPlayed: 0,
                    totalKills: 0,
                    highestPlacement:
                        Number(result.position) || 0,
                    finalAccumulatedScore: 0,
                };
            }

            const cache = aggregateCalcMap[targetId];
            const position =
                Number(result.position) || 0;

            cache.totalMatchesPlayed += 1;
            cache.totalKills +=
                Number(result.kills) || 0;
            cache.finalAccumulatedScore +=
                Number(result.calculatedScore) || 0;

            if (
                position > 0
                && (
                    cache.highestPlacement <= 0
                    || position < cache.highestPlacement
                )
            ) {
                cache.highestPlacement = position;
            }
        }
    }

    return Object.values(aggregateCalcMap).sort(
        (a, b) =>
            b.finalAccumulatedScore
            - a.finalAccumulatedScore
    );
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

const getTournamentFailureResponse = async ({
    eventId,
    deviceId,
    matchNumber = null,
    registration = false,
}) => {
    const tournament = await Tournament.findById(
        eventId
    )
        .select(
            "status formatType matches blacklistedDeviceIds "
            + "leaderDeviceId moderatedBy visibility clanId"
        )
        .lean();

    if (!tournament) {
        return NextResponse.json(
            { message: "Tournament not found." },
            { status: 404 }
        );
    }

    const authorized =
        tournament.leaderDeviceId === deviceId
        || tournament.moderatedBy?.includes(deviceId);

    if (!registration && !authorized) {
        return NextResponse.json(
            { message: "Access Denied." },
            { status: 403 }
        );
    }

    if (
        CONCLUDED_EVENT_STATUSES.includes(
            tournament.status
        )
    ) {
        return NextResponse.json(
            {
                message:
                    "Tournament has already concluded.",
            },
            { status: 409 }
        );
    }

    if (registration) {
        if (
            tournament.blacklistedDeviceIds?.includes(
                deviceId
            )
        ) {
            return NextResponse.json(
                {
                    message:
                        "You are restricted from joining this event.",
                },
                { status: 403 }
            );
        }

        const match = tournament.matches?.find(
            item =>
                Number(item.matchNumber)
                === Number(matchNumber)
        );

        if (!match) {
            return NextResponse.json(
                { message: "Match not found." },
                { status: 404 }
            );
        }

        if (match.status !== "REGISTRATION") {
            return NextResponse.json(
                {
                    message:
                        "Registration is not open for this match.",
                },
                { status: 409 }
            );
        }

        if (
            match.participants?.some(
                participant =>
                    participant.deviceId === deviceId
            )
        ) {
            return NextResponse.json(
                {
                    message:
                        "Already registered for this match.",
                },
                { status: 409 }
            );
        }
    }

    // return NextResponse.json(
    //     {
    //         message:
    //             "The tournament changed before this operation completed. Refresh and try again.",
    //         code: "EVENT_STATE_CONFLICT",
    //     },
    //     { status: 409 }
    // );
};

export async function POST(req) {
    await connectDB();

    try {
        const body = await req.json();

        const {
            clanId,
            title,
            description,
            visibility,
            gameName,
            formatType,
            teamFormat,
            groupingId,
            leaderboardWeights,
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

        if (!clanId || !title) {
            return NextResponse.json(
                {
                    message:
                        "Missing required details.",
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

        const upperFormat =
            formatType?.toUpperCase() === "LEAGUE"
                ? "LEAGUE"
                : "SINGLE_MATCH";

        const targetVisibility =
            visibility?.toUpperCase() === "PRIVATE"
                ? "PRIVATE"
                : "PUBLIC";

        // This is a fast UX check. Enforce strict cross-document limits with
        // the model indexes/slot strategy described in the included notes.
        if (targetVisibility === "PUBLIC") {
            const activePublicCount =
                await Tournament.countDocuments({
                    visibility: "PUBLIC",
                    formatType: upperFormat,
                    status: {
                        $in: ACTIVE_EVENT_STATUSES,
                    },
                });

            if (activePublicCount >= 5) {
                return NextResponse.json(
                    {
                        message:
                            `The global limit for public ${upperFormat} events (5) has been reached. Try again later or set visibility to PRIVATE.`,
                    },
                    { status: 429 }
                );
            }
        }

        if (upperFormat === "LEAGUE") {
            const leagueConflict =
                await Tournament.findOne({
                    clanId: normalizedClanId,
                    formatType: "LEAGUE",
                    status: {
                        $in: ACTIVE_EVENT_STATUSES,
                    },
                })
                    .select("_id")
                    .lean();

            if (leagueConflict) {
                return NextResponse.json(
                    {
                        message:
                            "An active League is already running for your clan.",
                    },
                    { status: 409 }
                );
            }
        }

        const initialMatches = [];

        if (upperFormat === "SINGLE_MATCH") {
            initialMatches.push({
                matchNumber: 1,
                matchName: "Match 1",
                status: "PENDING",
                scheduledAt: new Date(),
                trackPerformance:
                    body.trackPerformance !== undefined
                        ? Boolean(body.trackPerformance)
                        : true,
                lobbyConfig: {
                    roomId: null,
                    roomPin: null,
                    additionalInstructions: null,
                },
                participants: [],
                results: [],
            });
        }

        const maxLifespan = new Date(
            Date.now()
            + (
                upperFormat === "LEAGUE"
                    ? 30 * 24
                    : 48
            )
            * 60
            * 60
            * 1000
        );

        const newTournament =
            await Tournament.create({
                clanId: normalizedClanId,
                clanName: targetClan.name,
                leaderDeviceId: deviceId,
                moderatedBy: [deviceId],
                title: String(title).trim(),
                description:
                    String(description || "").trim(),
                visibility: targetVisibility,
                gameName:
                    String(
                        gameName || "Bloodstrike"
                    ).trim(),
                formatType: upperFormat,
                teamFormat:
                    teamFormat?.toUpperCase() === "TEAM"
                        ? "TEAM"
                        : "SOLO",
                status: "REGISTRATION",
                groupingId:
                    upperFormat === "SINGLE_MATCH"
                        ? groupingId || null
                        : null,
                expiresAt: maxLifespan,
                leaderboardWeights:
                    leaderboardWeights || {
                        pointsPerKill: 1,
                        pointsPerMatchPlayed: 0,
                        placementScoring: {
                            "1": 15,
                            "2": 12,
                            "3": 10,
                            "4": 8,
                            "5": 6,
                        },
                    },
                matches: initialMatches,
                liveLeaderboard: [],
                participants: [],
                blacklistedDeviceIds: [],
            });

        return NextResponse.json(
            {
                success: true,
                data: newTournament,
            },
            { status: 201 }
        );
    } catch (error) {
        if (error?.code === 11000) {
            return NextResponse.json(
                {
                    message:
                        "An active tournament already occupies this event slot.",
                    code: "EVENT_SLOT_CONFLICT",
                },
                { status: 409 }
            );
        }

        console.error(
            "⛔ TOURNAMENT_POST_FAIL:",
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
            matchNumber,
            matchName,
            username,
            teamName,
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

        const normalizedAction =
            String(action).toUpperCase();

        switch (normalizedAction) {
            case "REGISTER_MATCH": {
                const numericMatchNumber =
                    Number(matchNumber);

                if (
                    !Number.isInteger(
                        numericMatchNumber
                    )
                    || !username?.trim()
                ) {
                    return NextResponse.json(
                        {
                            message:
                                "Match number and Player Name required.",
                        },
                        { status: 400 }
                    );
                }

                const accessSnapshot =
                    await Tournament.findById(eventId)
                        .select(
                            "visibility clanId status"
                        )
                        .lean();

                if (!accessSnapshot) {
                    return NextResponse.json(
                        {
                            message:
                                "Tournament not found.",
                        },
                        { status: 404 }
                    );
                }

                if (
                    accessSnapshot.visibility
                    === "PRIVATE"
                ) {
                    const allowed =
                        await canAccessPrivateClanEvent({
                            deviceId,
                            clanTag:
                                accessSnapshot.clanId,
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

                const participant = {
                    deviceId,
                    username:
                        String(username).trim(),
                    teamName:
                        teamName?.trim() || null,
                };

                const updated =
                    await Tournament.findOneAndUpdate(
                        {
                            _id: eventId,
                            status: {
                                $nin:
                                    CONCLUDED_EVENT_STATUSES,
                            },
                            blacklistedDeviceIds: {
                                $ne: deviceId,
                            },
                            matches: {
                                $elemMatch: {
                                    matchNumber:
                                        numericMatchNumber,
                                    status:
                                        "REGISTRATION",
                                    "participants.deviceId":
                                    {
                                        $ne: deviceId,
                                    },
                                },
                            },
                        },
                        [
                            {
                                $set: {
                                    matches: {
                                        $map: {
                                            input: {
                                                $ifNull: [
                                                    "$matches",
                                                    [],
                                                ],
                                            },
                                            as: "match",
                                            in: {
                                                $cond: [
                                                    {
                                                        $eq: [
                                                            "$$match.matchNumber",
                                                            numericMatchNumber,
                                                        ],
                                                    },
                                                    {
                                                        $mergeObjects: [
                                                            "$$match",
                                                            {
                                                                participants:
                                                                {
                                                                    $concatArrays:
                                                                        [
                                                                            {
                                                                                $ifNull:
                                                                                    [
                                                                                        "$$match.participants",
                                                                                        [],
                                                                                    ],
                                                                            },
                                                                            [
                                                                                participant,
                                                                            ],
                                                                        ],
                                                                },
                                                            },
                                                        ],
                                                    },
                                                    "$$match",
                                                ],
                                            },
                                        },
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
                            runValidators: true,
                        }
                    )
                        .select("matches")
                        .lean();

                if (!updated) {
                    return getTournamentFailureResponse({
                        eventId,
                        deviceId,
                        matchNumber:
                            numericMatchNumber,
                        registration: true,
                    });
                }

                const registeredMatch =
                    updated.matches?.find(
                        item =>
                            Number(item.matchNumber)
                            === numericMatchNumber
                    );

                return NextResponse.json(
                    {
                        success: true,
                        message:
                            `Registered for ${registeredMatch?.matchName || `Match ${numericMatchNumber}`}!`,
                    },
                    { status: 200 }
                );
            }

            case "UPDATE_MODERATORS": {
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

                const snapshot =
                    await Tournament.findOne({
                        _id: eventId,
                        ...moderatorFilter(deviceId),
                    })
                        .select("leaderDeviceId")
                        .lean();

                if (!snapshot) {
                    return getTournamentFailureResponse({
                        eventId,
                        deviceId,
                    });
                }

                const moderators =
                    normalizeDeviceIds([
                        ...payload.moderators,
                        snapshot.leaderDeviceId,
                    ]);

                await Tournament.updateOne(
                    {
                        _id: eventId,
                        ...moderatorFilter(deviceId),
                    },
                    {
                        $set: {
                            moderatedBy: moderators,
                        },
                    }
                );

                return NextResponse.json(
                    {
                        success: true,
                        message:
                            "Moderators updated.",
                    },
                    { status: 200 }
                );
            }

            case "UPDATE_TOURNAMENT": {
                const changes = {};

                if (payload.title !== undefined) {
                    changes.title =
                        String(payload.title).trim();
                }

                if (
                    payload.description
                    !== undefined
                ) {
                    changes.description =
                        String(
                            payload.description
                        ).trim();
                }

                if (
                    payload.gameName !== undefined
                ) {
                    changes.gameName =
                        String(payload.gameName).trim();
                }

                if (
                    payload.leaderboardWeights
                    !== undefined
                ) {
                    changes.leaderboardWeights =
                        payload.leaderboardWeights;
                }

                if (
                    Object.keys(changes).length === 0
                ) {
                    return NextResponse.json(
                        {
                            success: true,
                            message:
                                "No settings changed.",
                        },
                        { status: 200 }
                    );
                }

                const updated =
                    await Tournament.findOneAndUpdate(
                        {
                            _id: eventId,
                            ...moderatorFilter(deviceId),
                            status: {
                                $nin:
                                    CONCLUDED_EVENT_STATUSES,
                            },
                        },
                        {
                            $set: changes,
                        },
                        {
                            new: true,
                            runValidators: true,
                        }
                    )
                        .select("_id")
                        .lean();

                if (!updated) {
                    return getTournamentFailureResponse({
                        eventId,
                        deviceId,
                    });
                }

                return NextResponse.json(
                    {
                        success: true,
                        message: "Settings saved.",
                    },
                    { status: 200 }
                );
            }

            case "ADD_MATCH": {
                const scheduledAt =
                    payload.scheduledAt
                        ? new Date(
                            payload.scheduledAt
                        )
                        : new Date();

                if (
                    Number.isNaN(
                        scheduledAt.getTime()
                    )
                ) {
                    return NextResponse.json(
                        {
                            message:
                                "Invalid scheduled time.",
                        },
                        { status: 400 }
                    );
                }

                const suppliedName =
                    matchName?.trim() || null;

                const updated =
                    await Tournament.findOneAndUpdate(
                        {
                            _id: eventId,
                            ...moderatorFilter(deviceId),
                            formatType: "LEAGUE",
                            status: {
                                $nin:
                                    CONCLUDED_EVENT_STATUSES,
                            },
                        },
                        [
                            {
                                $set: {
                                    matches: {
                                        $let: {
                                            vars: {
                                                nextNumber: {
                                                    $add: [
                                                        {
                                                            $ifNull:
                                                                [
                                                                    {
                                                                        $max:
                                                                            "$matches.matchNumber",
                                                                    },
                                                                    0,
                                                                ],
                                                        },
                                                        1,
                                                    ],
                                                },
                                            },
                                            in: {
                                                $concatArrays:
                                                    [
                                                        {
                                                            $ifNull:
                                                                [
                                                                    "$matches",
                                                                    [],
                                                                ],
                                                        },
                                                        [
                                                            {
                                                                matchNumber:
                                                                    "$$nextNumber",
                                                                matchName:
                                                                    suppliedName
                                                                    || {
                                                                        $concat:
                                                                            [
                                                                                "Match ",
                                                                                {
                                                                                    $toString:
                                                                                        "$$nextNumber",
                                                                                },
                                                                            ],
                                                                    },
                                                                status:
                                                                    "PENDING",
                                                                scheduledAt,
                                                                trackPerformance:
                                                                    payload.trackPerformance
                                                                        !== undefined
                                                                        ? Boolean(
                                                                            payload.trackPerformance
                                                                        )
                                                                        : true,
                                                                lobbyConfig:
                                                                {
                                                                    roomId:
                                                                        null,
                                                                    roomPin:
                                                                        null,
                                                                    additionalInstructions:
                                                                        null,
                                                                },
                                                                participants:
                                                                    [],
                                                                results:
                                                                    [],
                                                            },
                                                        ],
                                                    ],
                                            },
                                        },
                                    },
                                    updatedAt: "$$NOW",
                                },
                            },
                        ],
                        {
                            new: true,
                            runValidators: true,
                        }
                    )
                        .select("matches")
                        .lean();

                if (!updated) {
                    return getTournamentFailureResponse({
                        eventId,
                        deviceId,
                    });
                }

                const addedMatch =
                    updated.matches?.at(-1);

                return NextResponse.json(
                    {
                        success: true,
                        message:
                            `${addedMatch?.matchName || "New Match"} added to schedule.`,
                        match: addedMatch,
                    },
                    { status: 200 }
                );
            }

            case "UPDATE_MATCH_CONFIG": {
                const numericMatchNumber =
                    Number(matchNumber);

                if (
                    !Number.isInteger(
                        numericMatchNumber
                    )
                ) {
                    return NextResponse.json(
                        {
                            message:
                                "Match number required.",
                        },
                        { status: 400 }
                    );
                }

                const setChanges = {};

                if (matchName !== undefined) {
                    setChanges[
                        "matches.$[match].matchName"
                    ] = String(matchName).trim();
                }

                if (payload.roomId !== undefined) {
                    setChanges[
                        "matches.$[match].lobbyConfig.roomId"
                    ] = payload.roomId;
                }

                if (payload.roomPin !== undefined) {
                    setChanges[
                        "matches.$[match].lobbyConfig.roomPin"
                    ] = payload.roomPin;
                }

                if (
                    payload.additionalInstructions
                    !== undefined
                ) {
                    setChanges[
                        "matches.$[match].lobbyConfig.additionalInstructions"
                    ] =
                        payload.additionalInstructions;
                }

                let requestedStatus = null;

                if (payload.status !== undefined) {
                    requestedStatus =
                        String(
                            payload.status
                        ).toUpperCase();

                    if (
                        !MATCH_STATUSES.includes(
                            requestedStatus
                        )
                    ) {
                        return NextResponse.json(
                            {
                                message:
                                    "Invalid match status.",
                            },
                            { status: 400 }
                        );
                    }

                    setChanges[
                        "matches.$[match].status"
                    ] = requestedStatus;
                }

                if (
                    Object.keys(setChanges).length
                    === 0
                ) {
                    return NextResponse.json(
                        {
                            success: true,
                            message:
                                "No match details changed.",
                        },
                        { status: 200 }
                    );
                }

                const previousTournament =
                    await Tournament.findOneAndUpdate(
                        {
                            _id: eventId,
                            ...moderatorFilter(deviceId),
                            "matches.matchNumber":
                                numericMatchNumber,
                        },
                        {
                            $set: setChanges,
                        },
                        {
                            new: false,
                            arrayFilters: [
                                {
                                    "match.matchNumber":
                                        numericMatchNumber,
                                },
                            ],
                            runValidators: true,
                        }
                    )
                        .select("matches")
                        .lean();

                if (!previousTournament) {
                    return getTournamentFailureResponse({
                        eventId,
                        deviceId,
                        matchNumber:
                            numericMatchNumber,
                    });
                }

                const previousMatch =
                    previousTournament.matches?.find(
                        item =>
                            Number(item.matchNumber)
                            === numericMatchNumber
                    );

                const becameLive =
                    requestedStatus === "LIVE"
                    && previousMatch?.status !== "LIVE";

                if (
                    becameLive
                    && previousMatch?.participants?.length
                    > 0
                ) {
                    try {
                        const participantIds =
                            previousMatch.participants.map(
                                participant =>
                                    participant.deviceId
                            );

                        const users =
                            await MobileUser.find({
                                deviceId: {
                                    $in: participantIds,
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
                                    `⚔️ Match LIVE: ${matchName?.trim() || previousMatch.matchName || `Match ${numericMatchNumber}`}`,
                                    "The lobby is open! Check the event page for room details.",
                                    {
                                        screen:
                                            `/screens/events?id=${eventId}`,
                                        eventId:
                                            String(eventId),
                                        type:
                                            "tournament_match_live",
                                    },
                                    {
                                        type: "event",
                                        targetAudience:
                                            "user",
                                        targetId:
                                            user.deviceId,
                                        groupId:
                                            `match_${numericMatchNumber}_${eventId}`,
                                        expiresInHours: 2,
                                    }
                                )
                            )
                        );
                    } catch (error) {
                        console.error(
                            "Live match notification error:",
                            error
                        );
                    }
                }

                return NextResponse.json(
                    {
                        success: true,
                        message:
                            "Match details saved.",
                    },
                    { status: 200 }
                );
            }

            case "DELETE_MATCH": {
                const numericMatchNumber =
                    Number(matchNumber);

                if (
                    !Number.isInteger(
                        numericMatchNumber
                    )
                ) {
                    return NextResponse.json(
                        {
                            message:
                                "Match number required.",
                        },
                        { status: 400 }
                    );
                }

                let deleted = false;

                await mongoose.connection.transaction(
                    async session => {
                        const tournament =
                            await Tournament.findOne({
                                _id: eventId,
                                ...moderatorFilter(
                                    deviceId
                                ),
                                "matches.matchNumber":
                                    numericMatchNumber,
                            }).session(session);

                        if (!tournament) return;

                        tournament.matches =
                            tournament.matches.filter(
                                item =>
                                    Number(
                                        item.matchNumber
                                    )
                                    !== numericMatchNumber
                            );

                        tournament.liveLeaderboard =
                            rebuildLeaderboard(
                                tournament
                            );

                        await tournament.save({
                            session,
                        });

                        deleted = true;
                    }
                );

                if (!deleted) {
                    return getTournamentFailureResponse({
                        eventId,
                        deviceId,
                        matchNumber:
                            numericMatchNumber,
                    });
                }

                return NextResponse.json(
                    {
                        success: true,
                        message:
                            "Match deleted successfully.",
                    },
                    { status: 200 }
                );
            }

            case "LOG_MATCH_RESULTS": {
                const numericMatchNumber =
                    Number(matchNumber);

                if (
                    !Number.isInteger(
                        numericMatchNumber
                    )
                    || !Array.isArray(
                        payload.rawResults
                    )
                ) {
                    return NextResponse.json(
                        {
                            message:
                                "Match number and valid score data are required.",
                        },
                        { status: 400 }
                    );
                }

                let completedMatch = null;
                let eventSnapshot = null;

                await mongoose.connection.transaction(
                    async session => {
                        const tournament =
                            await Tournament.findOne({
                                _id: eventId,
                                ...moderatorFilter(
                                    deviceId
                                ),
                                matches: {
                                    $elemMatch: {
                                        matchNumber:
                                            numericMatchNumber,
                                        status: "LIVE",
                                    },
                                },
                            }).session(session);

                        if (!tournament) return;

                        const targetMatch =
                            tournament.matches.find(
                                item =>
                                    Number(
                                        item.matchNumber
                                    )
                                    === numericMatchNumber
                            );

                        if (!targetMatch) return;

                        const killWeight =
                            tournament
                                .leaderboardWeights
                                ?.pointsPerKill ?? 1;

                        const matchWeight =
                            tournament
                                .leaderboardWeights
                                ?.pointsPerMatchPlayed
                            ?? 0;

                        const placementScoring =
                            tournament
                                .leaderboardWeights
                                ?.placementScoring
                            || {};

                        const processedResults =
                            payload.rawResults.map(
                                row => {
                                    const position =
                                        Number.parseInt(
                                            row.position,
                                            10
                                        );

                                    const kills =
                                        Number.parseInt(
                                            row.kills,
                                            10
                                        ) || 0;

                                    const positionKey =
                                        String(position);

                                    const positionBonus =
                                        placementScoring
                                            instanceof Map
                                            ? placementScoring.get(
                                                positionKey
                                            ) || 0
                                            : placementScoring[
                                            positionKey
                                            ] || 0;

                                    return {
                                        targetId:
                                            String(
                                                row.targetId
                                                || ""
                                            ),
                                        displayName:
                                            String(
                                                row.displayName
                                                || "Unknown"
                                            ),
                                        position,
                                        kills,
                                        calculatedScore:
                                            positionBonus
                                            + kills
                                            * killWeight
                                            + matchWeight,
                                    };
                                }
                            );

                        targetMatch.results =
                            processedResults;
                        targetMatch.loggedByDeviceId =
                            deviceId;
                        targetMatch.loggedAt =
                            new Date();
                        targetMatch.status =
                            "COMPLETED";

                        tournament.liveLeaderboard =
                            rebuildLeaderboard(
                                tournament
                            );

                        if (
                            tournament.formatType
                            === "SINGLE_MATCH"
                        ) {
                            tournament.status =
                                "COMPLETED";
                            tournament.expiresAt =
                                new Date(
                                    Date.now()
                                    + 12
                                    * 60
                                    * 60
                                    * 1000
                                );
                        }

                        await tournament.save({
                            session,
                        });

                        completedMatch = {
                            matchName:
                                targetMatch.matchName,
                            participantIds:
                                targetMatch.participants.map(
                                    participant =>
                                        participant.deviceId
                                ),
                        };

                        eventSnapshot = {
                            title: tournament.title,
                        };
                    }
                );

                if (!completedMatch) {
                    return getTournamentFailureResponse({
                        eventId,
                        deviceId,
                        matchNumber:
                            numericMatchNumber,
                    });
                }

                if (
                    completedMatch.participantIds.length
                    > 0
                ) {
                    try {
                        const users =
                            await MobileUser.find({
                                deviceId: {
                                    $in:
                                        completedMatch.participantIds,
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
                                    "🏆 Match Concluded",
                                    `Scores for ${completedMatch.matchName || `Match ${numericMatchNumber}`} are in! Check your standings.`,
                                    {
                                        screen:
                                            `/screens/events?id=${eventId}`,
                                        eventId:
                                            String(eventId),
                                        type:
                                            "tournament_results",
                                        title:
                                            eventSnapshot?.title,
                                    },
                                    {
                                        type: "event",
                                        targetAudience:
                                            "user",
                                        targetId:
                                            user.deviceId,
                                        groupId:
                                            `res_${numericMatchNumber}_${eventId}`,
                                        expiresInHours: 6,
                                    }
                                )
                            )
                        );
                    } catch (error) {
                        console.error(
                            "Match result notification error:",
                            error
                        );
                    }
                }

                return NextResponse.json(
                    {
                        success: true,
                        message:
                            "Scores locked in successfully.",
                    },
                    { status: 200 }
                );
            }

            case "BLACKLIST_USER": {
                const targetDeviceId =
                    String(
                        payload.targetDeviceId || ""
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
                    await Tournament.findOneAndUpdate(
                        {
                            _id: eventId,
                            ...moderatorFilter(deviceId),
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
                                                $ifNull:
                                                    [
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
                                    matches: {
                                        $map: {
                                            input: {
                                                $ifNull: [
                                                    "$matches",
                                                    [],
                                                ],
                                            },
                                            as: "match",
                                            in: {
                                                $cond: [
                                                    {
                                                        $in: [
                                                            "$$match.status",
                                                            [
                                                                "PENDING",
                                                                "REGISTRATION",
                                                            ],
                                                        ],
                                                    },
                                                    {
                                                        $mergeObjects: [
                                                            "$$match",
                                                            {
                                                                participants:
                                                                {
                                                                    $filter:
                                                                    {
                                                                        input:
                                                                        {
                                                                            $ifNull:
                                                                                [
                                                                                    "$$match.participants",
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
                                                            },
                                                        ],
                                                    },
                                                    "$$match",
                                                ],
                                            },
                                        },
                                    },
                                    updatedAt: "$$NOW",
                                },
                            },
                        ],
                        {
                            new: true,
                        }
                    )
                        .select("_id")
                        .lean();

                if (!updated) {
                    return getTournamentFailureResponse({
                        eventId,
                        deviceId,
                    });
                }

                return NextResponse.json(
                    {
                        success: true,
                        message:
                            "Player removed and banned from league.",
                    },
                    { status: 200 }
                );
            }

            case "TERMINATE": {
                const updated =
                    await Tournament.findOneAndUpdate(
                        {
                            _id: eventId,
                            ...moderatorFilter(deviceId),
                            status: {
                                $nin:
                                    CONCLUDED_EVENT_STATUSES,
                            },
                        },
                        {
                            $set: {
                                status: "CANCELLED",
                                expiresAt: new Date(
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
                    return getTournamentFailureResponse({
                        eventId,
                        deviceId,
                    });
                }

                return NextResponse.json(
                    {
                        success: true,
                        message:
                            "Event cancelled successfully.",
                    },
                    { status: 200 }
                );
            }

            case "SET_TOURNAMENT_STATUS": {
                const status =
                    String(
                        payload.status || ""
                    ).toUpperCase();

                if (
                    ![
                        "REGISTRATION",
                        "LIVE",
                        "COMPLETED",
                        "CANCELLED",
                    ].includes(status)
                ) {
                    return NextResponse.json(
                        {
                            message:
                                "Invalid status.",
                        },
                        { status: 400 }
                    );
                }

                const update = {
                    status,
                };

                if (
                    status === "COMPLETED"
                    || status === "CANCELLED"
                ) {
                    update.expiresAt =
                        new Date(
                            Date.now()
                            + 12
                            * 60
                            * 60
                            * 1000
                        );
                }

                const updated =
                    await Tournament.findOneAndUpdate(
                        {
                            _id: eventId,
                            ...moderatorFilter(deviceId),
                        },
                        {
                            $set: update,
                        },
                        {
                            new: true,
                            runValidators: true,
                        }
                    )
                        .select("status")
                        .lean();

                if (!updated) {
                    return getTournamentFailureResponse({
                        eventId,
                        deviceId,
                    });
                }

                return NextResponse.json(
                    {
                        success: true,
                        currentStatus:
                            updated.status,
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
            "⛔ TOURNAMENT_PATCH_CRASH:",
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
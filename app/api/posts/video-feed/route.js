import connectDB from "@/app/lib/mongodb";
import ClanFollower from "@/app/models/ClanFollower";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

const VIDEO_TYPE_QUERY = {
    $regex: "^video",
    $options: "i"
};

const LOW_INFO_ENTITY_TAGS = new Set([
    "anime",
    "action",
    "fantasy",
    "game",
    "gaming",
    "games",
    "movie",
    "comedy",
    "shonen",
    "shooter",
    "japan",
    "fps",
    "rpg",
    "manga",
    "scifi",
    "adventure",
    "drama",
    "romance",
    "slice of life",
    "sports",
    "edit",
    "amv",
    "meme"
]);

const normalizeTag = value =>
    typeof value === "string"
        ? value.trim().toLowerCase()
        : "";

const isContentTypeTag = tag =>
    typeof tag === "string"
    && tag.startsWith("type:")
    && tag.length > 5;

const uniqueStrings = values => [
    ...new Set(
        values
            .map(normalizeTag)
            .filter(Boolean)
    )
];

function seededRandom(seed) {
    let value = seed % 2147483647;

    if (value <= 0) {
        value += 2147483646;
    }

    return () => {
        value = (value * 16807) % 2147483647;
        return (value - 1) / 2147483646;
    };
}

function hashString(value) {
    let hash = 0;

    for (let index = 0; index < value.length; index++) {
        hash = (
            (hash << 5)
            - hash
            + value.charCodeAt(index)
        ) | 0;
    }

    return Math.abs(hash);
}

function seededShuffle(items, seed) {
    const result = [...items];
    const random = seededRandom(seed);

    for (let index = result.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(
            random() * (index + 1)
        );

        [
            result[index],
            result[randomIndex]
        ] = [
                result[randomIndex],
                result[index]
            ];
    }

    return result;
}

function normalizePoolWeights(defaultWeights, learnedWeights) {
    const result = {};
    let total = 0;

    for (const key of Object.keys(defaultWeights)) {
        const learnedValue = Number(learnedWeights?.[key]);
        const value = Number.isFinite(learnedValue)
            ? Math.max(0.01, learnedValue)
            : defaultWeights[key];

        result[key] = value;
        total += value;
    }

    if (total <= 0) {
        return { ...defaultWeights };
    }

    for (const key of Object.keys(result)) {
        result[key] = result[key] / total;
    }

    return result;
}

function getPreferredTypeTags(
    affinityScores,
    minimumScore = 3,
    limit = 3
) {
    return Object.entries(affinityScores || {})
        .filter(([tag, score]) =>
            isContentTypeTag(tag)
            && Number(score) >= minimumScore
        )
        .sort(([, firstScore], [, secondScore]) =>
            Number(secondScore) - Number(firstScore)
        )
        .slice(0, limit)
        .map(([tag]) => normalizeTag(tag));
}

function applyDiversityPass(posts, maxConsecutive = 2) {
    const result = [];
    const heldBack = [];

    const getAuthorKey = post =>
        (post.authorUserId || post.authorId)?.toString();

    const getClanKey = post =>
        (post.clanTag || post.clanId)?.toString();

    const canPlacePost = post => {
        const recent = result.slice(-maxConsecutive);
        const authorKey = getAuthorKey(post);
        const clanKey = getClanKey(post);
        const category = normalizeTag(post.category);

        const authorRepeats = authorKey
            ? recent.filter(item =>
                getAuthorKey(item) === authorKey
            ).length
            : 0;

        const clanRepeats = clanKey
            ? recent.filter(item =>
                getClanKey(item) === clanKey
            ).length
            : 0;

        const categoryRepeats = category
            ? recent.filter(item =>
                normalizeTag(item.category) === category
            ).length
            : 0;

        return (
            authorRepeats < maxConsecutive
            && clanRepeats < maxConsecutive
            && categoryRepeats < maxConsecutive
        );
    };

    for (const post of posts) {
        if (canPlacePost(post)) {
            result.push(post);

            const safeIndex = heldBack.findIndex(
                canPlacePost
            );

            if (safeIndex !== -1) {
                result.push(
                    heldBack.splice(safeIndex, 1)[0]
                );
            }
        } else {
            heldBack.push(post);
        }
    }

    return result.concat(heldBack);
}

function getExploreOnlyCandidateIds(
    exploreCandidateIdSet,
    candidateMap
) {
    const prioritySourceTypes = new Set([
        "interest",
        "author",
        "clan",
        "trending"
    ]);

    return [...exploreCandidateIdSet].filter(postId => {
        const sources =
            candidateMap.get(postId)?.sources || [];

        return !sources.some(source =>
            prioritySourceTypes.has(source.type)
        );
    });
}

function buildExpansionTagScores(
    posts,
    excludedTags
) {
    const excluded = new Set(
        [...excludedTags].map(normalizeTag)
    );
    const scores = {};

    for (const post of posts) {
        const likesCount =
            post.likesCount
            ?? post.likeCount
            ?? 0;

        const hypePoints = post.hypePoints ?? 0;
        const viewsCount =
            post.viewsCount
            ?? post.views
            ?? 0;

        const engagementWeight =
            1
            + Math.log1p(Math.max(0, likesCount)) * 0.8
            + Math.sqrt(Math.max(0, hypePoints)) * 0.12
            + Math.log1p(Math.max(0, viewsCount)) * 0.25;

        for (const rawTag of post.interests || []) {
            const tag = normalizeTag(rawTag);

            if (
                !tag
                || isContentTypeTag(tag)
                || LOW_INFO_ENTITY_TAGS.has(tag)
                || excluded.has(tag)
            ) {
                continue;
            }

            scores[tag] =
                (scores[tag] || 0)
                + engagementWeight;
        }
    }

    return scores;
}

async function fetchCompactVideoRowsInOrder(
    rankedRows,
    deviceId = ""
) {
    if (!rankedRows.length) {
        return [];
    }

    const rankedIds = rankedRows
        .map(row => row._id?.toString())
        .filter(Boolean);

    const uniquePostIds = [
        ...new Set(rankedIds)
    ];

    const pageObjectIds = uniquePostIds
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

    if (pageObjectIds.length === 0) {
        return [];
    }

    const hasViewer = Boolean(deviceId);

    const compactPosts = await Post.aggregate([
        {
            $match: {
                _id: { $in: pageObjectIds }
            }
        },
        {
            $project: {
                title: 1,
                message: 1,
                slug: 1,

                mediaUrl: 1,
                mediaType: 1,
                media: 1,

                authorId: 1,
                authorUserId: 1,
                authorName: 1,

                clanId: 1,
                clanTag: 1,

                category: 1,
                interests: 1,
                country: 1,

                createdAt: 1,
                updatedAt: 1,
                boostedUntil: 1,
                resurrectedAt: 1,

                hypePoints: {
                    $ifNull: ["$hypePoints", 0]
                },
                hypeCount: {
                    $ifNull: ["$hypeCount", 0]
                },

                likesCount: {
                    $ifNull: [
                        "$likesCount",
                        "$likeCount",
                        0
                    ]
                },
                commentsCount: {
                    $ifNull: ["$commentsCount", 0]
                },
                discussionCount: {
                    $ifNull: ["$discussionCount", 0]
                },
                viewsCount: {
                    $ifNull: [
                        "$viewsCount",
                        "$views",
                        0
                    ]
                },
                sharesCount: {
                    $ifNull: [
                        "$sharesCount",
                        "$shares",
                        0
                    ]
                },

                hasLiked: hasViewer
                    ? {
                        $anyElementTrue: {
                            $map: {
                                input: {
                                    $ifNull: ["$likes", []]
                                },
                                as: "like",
                                in: {
                                    $or: [
                                        {
                                            $eq: [
                                                "$$like",
                                                deviceId
                                            ]
                                        },
                                        {
                                            $eq: [
                                                "$$like.fingerprint",
                                                deviceId
                                            ]
                                        },
                                        {
                                            $eq: [
                                                "$$like.deviceId",
                                                deviceId
                                            ]
                                        }
                                    ]
                                }
                            }
                        }
                    }
                    : { $literal: false }
            }
        }
    ]);

    const compactPostMap = new Map(
        compactPosts.map(post => [
            post._id.toString(),
            post
        ])
    );

    return rankedRows
        .map(row => {
            const postId = row._id.toString();
            const post = compactPostMap.get(postId);

            if (!post) {
                return null;
            }

            const mediaIndex = Number.isInteger(row.mediaIndex)
                ? row.mediaIndex
                : Number(row.mediaIndex) || 0;

            const indexedMedia =
                post.media?.[mediaIndex] || null;

            const selectedMedia =
                indexedMedia?.url === row.rankedMediaUrl
                    ? indexedMedia
                    : post.media?.find(media =>
                        media?.url === row.rankedMediaUrl
                    ) || indexedMedia;

            if (!selectedMedia?.url) {
                return null;
            }

            return {
                ...post,
                mediaIndex,
                selectedMedia,
                finalScore: row.finalScore,
                effectiveDate: row.effectiveDate
            };
        })
        .filter(Boolean);
}

export async function GET(req) {
    const requestStartedAt = Date.now();

    try {
        const connectionStartedAt = Date.now();
        await connectDB();

        console.log(
            "Video feed DB connection:",
            Date.now() - connectionStartedAt,
            "ms"
        );

        const { searchParams } = new URL(req.url);

        const parsedPage = Number.parseInt(
            searchParams.get("page") || "1",
            10
        );
        const page = Number.isFinite(parsedPage)
            ? Math.max(1, parsedPage)
            : 1;

        const parsedLimit = Number.parseInt(
            searchParams.get("limit") || "10",
            10
        );
        const limit = Number.isFinite(parsedLimit)
            ? Math.min(30, Math.max(1, parsedLimit))
            : 10;

        const startingId =
            searchParams.get("startingId");

        const viewerId =
            searchParams.get("viewerId");

        const authorFilter =
            searchParams.get("author");

        const clanFilter =
            searchParams.get("clan");

        const categoryFilter =
            searchParams.get("category");

        const deviceId =
            req.headers.get("x-user-deviceId") || "";

        const userCountry =
            req.headers.get("x-user-country") || "Global";

        const favAnimes =
            req.headers
                .get("x-user-animes")
                ?.split(",")
                .map(normalizeTag)
                .filter(Boolean)
            || [];

        const favGenres =
            req.headers
                .get("x-user-genres")
                ?.split(",")
                .map(normalizeTag)
                .filter(Boolean)
            || [];

        const favCharacter =
            normalizeTag(
                req.headers.get("x-user-character")
            );

        const staticUserInterests = uniqueStrings([
            ...favAnimes,
            ...favGenres,
            favCharacter
        ]);

        const skip = (page - 1) * limit;
        const now = new Date();

        const fortyEightHoursAgo = new Date(
            now.getTime()
            - 48 * 60 * 60 * 1000
        );

        const fourteenDaysAgo = new Date(
            now.getTime()
            - 14 * 24 * 60 * 60 * 1000
        );

        // ================================================================
        // VIEWER CONTEXT
        // ================================================================
        const contextStartedAt = Date.now();

        const defaultWeights = {
            interest: 0.50,
            fresh: 0.20,
            author: 0.10,
            clan: 0.05,
            trending: 0.10,
            explore: 0.05
        };

        const [userProfile, follows, memberships] =
            await Promise.all([
                deviceId
                    ? MobileUser.findOne({ deviceId })
                        .select(
                            "affinityScores "
                            + "authorAffinity "
                            + "countryAffinity "
                            + "feedLearning "
                            + "blockedUsers "
                            + "blockedClans"
                        )
                        .lean()
                    : Promise.resolve(null),

                viewerId
                    ? ClanFollower.find({
                        userId: viewerId
                    })
                        .select("clanTag")
                        .lean()
                    : Promise.resolve([]),

                viewerId
                    ? Clan.find({
                        $or: [
                            { leader: viewerId },
                            { viceLeader: viewerId },
                            { members: viewerId }
                        ]
                    })
                        .select("tag _id")
                        .lean()
                    : Promise.resolve([])
            ]);

        const safeAffinity =
            userProfile?.affinityScores || {};

        const safeAuthorAffinity =
            userProfile?.authorAffinity || {};

        const safeCountryAffinity =
            userProfile?.countryAffinity || {};

        const dynamicWeights = normalizePoolWeights(
            defaultWeights,
            userProfile?.feedLearning?.poolWeights
        );

        const blockedUserValues =
            userProfile?.blockedUsers || [];

        const blockedUserObjectIds =
            blockedUserValues
                .map(value =>
                    mongoose.Types.ObjectId.isValid(value)
                        ? new mongoose.Types.ObjectId(value)
                        : null
                )
                .filter(Boolean);

        const blockedUserStrings =
            blockedUserValues
                .map(value => value?.toString())
                .filter(Boolean);

        let blockedClanTags = [];

        if (userProfile?.blockedClans?.length > 0) {
            const blockedClans = await Clan.find({
                _id: {
                    $in: userProfile.blockedClans
                }
            })
                .select("tag")
                .lean();

            blockedClanTags = blockedClans
                .map(clan => clan.tag)
                .filter(Boolean);
        }

        const followedClanTags = follows
            .map(follow => follow.clanTag)
            .filter(Boolean);

        const viewerClanTags = memberships
            .flatMap(clan => [
                clan.tag,
                clan._id?.toString()
            ])
            .filter(Boolean);

        const activeClanTags = [
            ...new Set([
                ...followedClanTags,
                ...viewerClanTags
            ])
        ];

        const preferredTypeTags =
            getPreferredTypeTags(safeAffinity);

        const personalizedInterestTags =
            uniqueStrings([
                ...staticUserInterests,
                ...preferredTypeTags
            ]);

        console.log(
            "Video feed viewer context:",
            Date.now() - contextStartedAt,
            "ms"
        );

        // ================================================================
        // BASE VIDEO FILTER
        // ================================================================
        const basePoolQuery = {
            status: "approved",
            "media.type": VIDEO_TYPE_QUERY
        };

        const excludedObjectIds = [];

        if (
            startingId
            && mongoose.Types.ObjectId.isValid(startingId)
        ) {
            excludedObjectIds.push(
                new mongoose.Types.ObjectId(startingId)
            );
        }

        if (excludedObjectIds.length > 0) {
            basePoolQuery._id = {
                $nin: excludedObjectIds
            };
        }

        if (categoryFilter) {
            basePoolQuery.category = categoryFilter;
        }

        const blockFilters = [];

        if (
            !authorFilter
            && (
                blockedUserObjectIds.length > 0
                || blockedUserStrings.length > 0
            )
        ) {
            blockFilters.push({
                authorUserId: {
                    $nin: blockedUserObjectIds
                },
                authorId: {
                    $nin: blockedUserStrings
                }
            });
        }

        if (
            !clanFilter
            && blockedClanTags.length > 0
        ) {
            blockFilters.push({
                clanId: {
                    $nin: blockedClanTags
                },
                clanTag: {
                    $nin: blockedClanTags
                }
            });
        }

        if (blockFilters.length > 0) {
            basePoolQuery.$and = blockFilters;
        }

        // ================================================================
        // STARTING-VIDEO SEMANTIC GRAPH
        // ================================================================
        const graphStartedAt = Date.now();

        let seedEntityTags = [];
        let seedTypeTags = [];
        let hopOneEntityTags = [];
        let hopTwoEntityTags = [];

        if (
            startingId
            && mongoose.Types.ObjectId.isValid(startingId)
        ) {
            const seedVideo = await Post.findById(startingId)
                .select("interests")
                .lean();

            const rawSeedTags = uniqueStrings(
                seedVideo?.interests || []
            );

            seedTypeTags = rawSeedTags.filter(
                isContentTypeTag
            );

            const rawSeedEntityTags = rawSeedTags.filter(
                tag => !isContentTypeTag(tag)
            );

            seedEntityTags =
                rawSeedEntityTags.filter(
                    tag =>
                        !LOW_INFO_ENTITY_TAGS.has(tag)
                );

            // Old videos may only contain broad legacy tags. Keep them
            // only when no useful entity was extracted.
            if (
                seedEntityTags.length === 0
                && rawSeedEntityTags.length > 0
            ) {
                seedEntityTags = rawSeedEntityTags;
            }

            if (seedEntityTags.length > 0) {
                const hopOneMatches = await Post.find({
                    ...basePoolQuery,
                    interests: {
                        $in: seedEntityTags
                    }
                })
                    .sort({
                        hypePoints: -1,
                        likesCount: -1,
                        views: -1,
                        createdAt: -1
                    })
                    .limit(40)
                    .select(
                        "interests "
                        + "likesCount "
                        + "likeCount "
                        + "viewsCount "
                        + "views "
                        + "hypePoints"
                    )
                    .lean();

                const hopOneScores =
                    buildExpansionTagScores(
                        hopOneMatches,
                        seedEntityTags
                    );

                hopOneEntityTags = Object.entries(
                    hopOneScores
                )
                    .sort(([, first], [, second]) =>
                        second - first
                    )
                    .slice(0, 15)
                    .map(([tag]) => tag);
            }

            if (hopOneEntityTags.length > 0) {
                const hopTwoMatches = await Post.find({
                    ...basePoolQuery,
                    interests: {
                        $in: hopOneEntityTags
                    }
                })
                    .sort({
                        hypePoints: -1,
                        likesCount: -1,
                        views: -1,
                        createdAt: -1
                    })
                    .limit(30)
                    .select(
                        "interests "
                        + "likesCount "
                        + "likeCount "
                        + "viewsCount "
                        + "views "
                        + "hypePoints"
                    )
                    .lean();

                const hopTwoScores =
                    buildExpansionTagScores(
                        hopTwoMatches,
                        new Set([
                            ...seedEntityTags,
                            ...hopOneEntityTags
                        ])
                    );

                hopTwoEntityTags = Object.entries(
                    hopTwoScores
                )
                    .sort(([, first], [, second]) =>
                        second - first
                    )
                    .slice(0, 10)
                    .map(([tag]) => tag);
            }
        }

        const expandedEntityTags = uniqueStrings([
            ...hopOneEntityTags,
            ...hopTwoEntityTags
        ]);

        console.log(
            "Video feed semantic graph:",
            Date.now() - graphStartedAt,
            "ms",
            {
                seedEntityTags,
                seedTypeTags,
                expandedEntityCount:
                    expandedEntityTags.length
            }
        );

        // ================================================================
        // CANDIDATE TRACKING
        // ================================================================
        const candidateMap = new Map();

        const seedEntityCandidateIdSet = new Set();
        const seedTypeCandidateIdSet = new Set();
        const expandedCandidateIdSet = new Set();
        const exploreCandidateIdSet = new Set();

        const addCandidate = (
            postId,
            type,
            reason = null,
            weight = 1
        ) => {
            const id = postId.toString();

            if (!candidateMap.has(id)) {
                candidateMap.set(id, {
                    _id: id,
                    sources: []
                });
            }

            const sources =
                candidateMap.get(id).sources;

            if (
                !sources.some(source =>
                    source.type === type
                    && source.reason === reason
                )
            ) {
                sources.push({
                    type,
                    reason,
                    weight
                });
            }
        };

        const addPool = (
            posts,
            sourceType,
            reason,
            weight,
            targetSet = null
        ) => {
            for (const post of posts) {
                const id = post._id.toString();

                addCandidate(
                    id,
                    sourceType,
                    reason,
                    weight
                );

                if (targetSet) {
                    targetSet.add(id);
                }
            }
        };

        let query = {};
        let total = 0;

        // ================================================================
        // CANDIDATE RETRIEVAL
        // ================================================================
        const poolingStartedAt = Date.now();

        if (authorFilter) {
            const isObjectId =
                mongoose.Types.ObjectId.isValid(
                    authorFilter
                );

            const authorConditions = [
                { authorId: authorFilter }
            ];

            if (isObjectId) {
                authorConditions.unshift({
                    authorUserId:
                        new mongoose.Types.ObjectId(
                            authorFilter
                        )
                });
            }

            query = {
                ...basePoolQuery,
                $or: authorConditions
            };

            total = await Post.countDocuments(query);
        } else if (clanFilter) {
            query = {
                ...basePoolQuery,
                $or: [
                    { clanId: clanFilter },
                    { clanTag: clanFilter }
                ]
            };

            total = await Post.countDocuments(query);
        } else if (
            startingId
            && (
                seedEntityTags.length > 0
                || seedTypeTags.length > 0
                || expandedEntityTags.length > 0
            )
        ) {
            // The strict candidate universe is ordered by semantic depth:
            // exact entities -> exact content type -> graph expansion.
            // Fallback candidates are added only when the current page would
            // otherwise exhaust the strict universe.
            const sessionPoolBudget = Math.min(
                Math.max(
                    (skip + limit) * 4,
                    300
                ),
                800
            );

            const exactEntityLimit = Math.max(
                1,
                Math.ceil(sessionPoolBudget * 0.50)
            );

            const exactTypeLimit = Math.max(
                1,
                Math.ceil(sessionPoolBudget * 0.25)
            );

            const expandedLimit = Math.max(
                1,
                Math.ceil(sessionPoolBudget * 0.25)
            );

            const [
                exactEntityPool,
                exactTypePool,
                expandedPool
            ] = await Promise.all([
                seedEntityTags.length > 0
                    ? Post.find({
                        ...basePoolQuery,
                        interests: {
                            $in: seedEntityTags
                        }
                    })
                        .sort({ createdAt: -1 })
                        .limit(exactEntityLimit)
                        .select("_id interests")
                        .lean()
                    : Promise.resolve([]),

                seedTypeTags.length > 0
                    ? Post.find({
                        ...basePoolQuery,
                        interests: {
                            $in: seedTypeTags
                        }
                    })
                        .sort({ createdAt: -1 })
                        .limit(exactTypeLimit)
                        .select("_id interests")
                        .lean()
                    : Promise.resolve([]),

                expandedEntityTags.length > 0
                    ? Post.find({
                        ...basePoolQuery,
                        interests: {
                            $in: expandedEntityTags
                        }
                    })
                        .sort({ createdAt: -1 })
                        .limit(expandedLimit)
                        .select("_id interests")
                        .lean()
                    : Promise.resolve([])
            ]);

            addPool(
                exactEntityPool,
                "interest",
                "seed_entity",
                100,
                seedEntityCandidateIdSet
            );

            addPool(
                exactTypePool,
                "interest",
                seedTypeTags[0] || "seed_type",
                55,
                seedTypeCandidateIdSet
            );

            addPool(
                expandedPool,
                "interest",
                "expanded_entity",
                20,
                expandedCandidateIdSet
            );

            let candidateIdStrings = [
                ...new Set([
                    ...exactEntityPool,
                    ...exactTypePool,
                    ...expandedPool
                ].map(post => post._id.toString()))
            ];

            const requiredCandidateCount =
                skip
                + limit
                + Math.max(limit * 2, 20);

            if (
                candidateIdStrings.length
                < requiredCandidateCount
            ) {
                const strictObjectIds =
                    candidateIdStrings.map(
                        id => new mongoose.Types.ObjectId(id)
                    );

                const fallbackExclusions = [
                    ...excludedObjectIds,
                    ...strictObjectIds
                ];

                const fallbackLimit = Math.min(
                    120,
                    Math.max(
                        requiredCandidateCount
                        - candidateIdStrings.length,
                        limit * 3
                    )
                );

                const [
                    viewerInterestFallback,
                    qualityFallback
                ] = await Promise.all([
                    personalizedInterestTags.length > 0
                        ? Post.find({
                            ...basePoolQuery,
                            _id: {
                                $nin: fallbackExclusions
                            },
                            interests: {
                                $in: personalizedInterestTags
                            }
                        })
                            .sort({ createdAt: -1 })
                            .limit(fallbackLimit)
                            .select("_id interests")
                            .lean()
                        : Promise.resolve([]),

                    Post.find({
                        ...basePoolQuery,
                        _id: {
                            $nin: fallbackExclusions
                        }
                    })
                        .sort({
                            hypePoints: -1,
                            likesCount: -1,
                            createdAt: -1
                        })
                        .limit(fallbackLimit)
                        .select("_id")
                        .lean()
                ]);

                addPool(
                    viewerInterestFallback,
                    "interest",
                    "viewer_fallback",
                    8
                );

                addPool(
                    qualityFallback,
                    "explore",
                    "controlled_expansion",
                    1,
                    exploreCandidateIdSet
                );

                candidateIdStrings = [
                    ...new Set([
                        ...candidateIdStrings,
                        ...viewerInterestFallback.map(
                            post => post._id.toString()
                        ),
                        ...qualityFallback.map(
                            post => post._id.toString()
                        )
                    ])
                ];
            }

            const uniqueCandidateIds =
                candidateIdStrings
                    .filter(id =>
                        mongoose.Types.ObjectId.isValid(id)
                    )
                    .map(id =>
                        new mongoose.Types.ObjectId(id)
                    );

            query = {
                ...basePoolQuery,
                _id: {
                    $in: uniqueCandidateIds
                }
            };

            total = uniqueCandidateIds.length;
        } else {
            // Initial video discovery uses the same personalized source
            // architecture as the standard feed, but keeps video-specific
            // source weights.
            const poolBudget = Math.min(
                Math.max(limit * 30, 300),
                600
            );

            const poolConfig = {
                interest: Math.max(
                    1,
                    Math.floor(
                        poolBudget
                        * dynamicWeights.interest
                    )
                ),
                fresh: Math.max(
                    1,
                    Math.floor(
                        poolBudget
                        * dynamicWeights.fresh
                    )
                ),
                author: Math.max(
                    1,
                    Math.floor(
                        poolBudget
                        * dynamicWeights.author
                    )
                ),
                clan: Math.max(
                    1,
                    Math.floor(
                        poolBudget
                        * dynamicWeights.clan
                    )
                ),
                trending: Math.max(
                    1,
                    Math.floor(
                        poolBudget
                        * dynamicWeights.trending
                    )
                ),
                explore: Math.max(
                    1,
                    Math.floor(
                        poolBudget
                        * dynamicWeights.explore
                    )
                )
            };

            const topAuthors = Object.entries(
                safeAuthorAffinity
            )
                .filter(([, score]) =>
                    Number(score) >= 10
                )
                .sort(([, first], [, second]) =>
                    Number(second) - Number(first)
                )
                .slice(0, 15)
                .map(([id]) => id);

            const topAuthorObjectIds = topAuthors
                .filter(id =>
                    mongoose.Types.ObjectId.isValid(id)
                )
                .map(id =>
                    new mongoose.Types.ObjectId(id)
                );

            const exploreSeed = hashString(
                `${deviceId || viewerId || userCountry}`
                + `-${Math.floor(
                    Date.now() / (60 * 60 * 1000)
                )}`
            );

            const [
                interestPool,
                freshPool,
                authorPool,
                clanPool,
                trendingPool,
                exploreSource
            ] = await Promise.all([
                personalizedInterestTags.length > 0
                    ? Post.find({
                        ...basePoolQuery,
                        interests: {
                            $in: personalizedInterestTags
                        }
                    })
                        .sort({ createdAt: -1 })
                        .limit(poolConfig.interest)
                        .select("_id interests")
                        .lean()
                    : Promise.resolve([]),

                Post.find(basePoolQuery)
                    .sort({ createdAt: -1 })
                    .limit(poolConfig.fresh)
                    .select("_id")
                    .lean(),

                topAuthors.length > 0
                    ? Post.find({
                        ...basePoolQuery,
                        $or: [
                            {
                                authorUserId: {
                                    $in: topAuthorObjectIds
                                }
                            },
                            {
                                authorId: {
                                    $in: topAuthors
                                }
                            }
                        ]
                    })
                        .sort({ createdAt: -1 })
                        .limit(poolConfig.author)
                        .select(
                            "_id authorUserId authorId"
                        )
                        .lean()
                    : Promise.resolve([]),

                activeClanTags.length > 0
                    ? Post.find({
                        ...basePoolQuery,
                        $or: [
                            {
                                clanId: {
                                    $in: activeClanTags
                                }
                            },
                            {
                                clanTag: {
                                    $in: activeClanTags
                                }
                            }
                        ]
                    })
                        .sort({ createdAt: -1 })
                        .limit(poolConfig.clan)
                        .select("_id clanId clanTag")
                        .lean()
                    : Promise.resolve([]),

                Post.find({
                    ...basePoolQuery,
                    $or: [
                        {
                            boostedUntil: {
                                $gt: now
                            }
                        },
                        {
                            resurrectedAt: {
                                $gte:
                                    fortyEightHoursAgo
                            }
                        },
                        {
                            createdAt: {
                                $gte:
                                    fortyEightHoursAgo
                            },
                            $expr: {
                                $or: [
                                    {
                                        $gte: [
                                            {
                                                $ifNull: [
                                                    "$likesCount",
                                                    0
                                                ]
                                            },
                                            50
                                        ]
                                    },
                                    {
                                        $gte: [
                                            {
                                                $ifNull: [
                                                    "$commentsCount",
                                                    0
                                                ]
                                            },
                                            20
                                        ]
                                    },
                                    {
                                        $gte: [
                                            {
                                                $ifNull: [
                                                    "$hypePoints",
                                                    0
                                                ]
                                            },
                                            100
                                        ]
                                    }
                                ]
                            }
                        }
                    ]
                })
                    .sort({ createdAt: -1 })
                    .limit(poolConfig.trending)
                    .select("_id")
                    .lean(),

                Post.find({
                    ...basePoolQuery,
                    createdAt: {
                        $gte: fourteenDaysAgo,
                        $lt: fortyEightHoursAgo
                    }
                })
                    .sort({ createdAt: -1 })
                    .limit(
                        Math.min(
                            poolConfig.explore * 4,
                            200
                        )
                    )
                    .select("_id")
                    .lean()
            ]);

            const explorePool = seededShuffle(
                exploreSource,
                exploreSeed
            ).slice(0, poolConfig.explore);

            addPool(
                interestPool,
                "interest",
                "viewer_interest",
                10
            );

            addPool(
                freshPool,
                "fresh",
                "recent",
                1
            );

            for (const post of authorPool) {
                const authorKey =
                    (
                        post.authorUserId
                        || post.authorId
                    )?.toString();

                addCandidate(
                    post._id,
                    "author",
                    authorKey,
                    safeAuthorAffinity[authorKey]
                    || 10
                );
            }

            for (const post of clanPool) {
                addCandidate(
                    post._id,
                    "clan",
                    (
                        post.clanTag
                        || post.clanId
                    )?.toString(),
                    20
                );
            }

            addPool(
                trendingPool,
                "trending",
                "viral_or_boosted",
                50
            );

            addPool(
                explorePool,
                "explore",
                "video_discovery",
                1,
                exploreCandidateIdSet
            );

            const mergedIds = [
                ...interestPool,
                ...freshPool,
                ...authorPool,
                ...clanPool,
                ...trendingPool,
                ...explorePool
            ].map(post => post._id.toString());

            const uniqueCandidateIds = [
                ...new Set(mergedIds)
            ]
                .filter(id =>
                    mongoose.Types.ObjectId.isValid(id)
                )
                .map(id =>
                    new mongoose.Types.ObjectId(id)
                );

            query = {
                ...basePoolQuery,
                _id: {
                    $in: uniqueCandidateIds
                }
            };

            total = uniqueCandidateIds.length;
        }

        console.log(
            "Video feed candidate pooling:",
            Date.now() - poolingStartedAt,
            "ms"
        );

        // ================================================================
        // LIGHTWEIGHT VIDEO RANKING
        // ================================================================
        const config = {
            likeWeight: 2.0,
            commentWeight: 4.0,
            hypeBaseWeight: 10.0,
            hypeDecayRate: 0.15,

            freshnessBoost: 20,
            freshnessWindow: 3,

            normalHalfLifeHours: 24,
            clanHalfLifeHours: 72,
            relatedHalfLifeHours: 96,
            exploreHalfLifeHours: 120,

            normalGravityPower: 1.15,
            clanGravityPower: 1.0,
            relatedGravityPower: 0.95,
            exploreGravityPower: 1.0,

            staticPrefBonus: 3,
            staticLocalBonus: 4,
            clanBonus: 15,
            affinityMultiplier: 1.5,

            seedEntityBonus: 180,
            seedTypeBonus: 80,
            expandedEntityBonus: 35,
            exploreBonus: 1.5,

            postBoostMultiplier: 3.0,
            boostIgnitionScore: 15,
            trendingThreshold: 1000
        };

        const exploreOnlyCandidateIds =
            getExploreOnlyCandidateIds(
                exploreCandidateIdSet,
                candidateMap
            );

        const lightweightPipeline = [
            { $match: query },
            {
                $project: {
                    media: 1,

                    createdAt: 1,
                    resurrectedAt: 1,
                    boostedUntil: 1,
                    isAdminPost: 1,

                    authorUserId: 1,
                    authorId: 1,
                    clanId: 1,
                    clanTag: 1,

                    country: 1,
                    category: 1,
                    interests: 1,

                    likesCountForRanking: {
                        $ifNull: [
                            "$likesCount",
                            0
                        ]
                    },
                    commentsCountForRanking: {
                        $ifNull: [
                            "$commentsCount",
                            0
                        ]
                    },
                    hypePointsForRanking: {
                        $ifNull: [
                            "$hypePoints",
                            0
                        ]
                    }
                }
            },
            {
                $unwind: {
                    path: "$media",
                    includeArrayIndex: "mediaIndex"
                }
            },
            {
                $match: {
                    "media.type": VIDEO_TYPE_QUERY
                }
            },
            {
                $addFields: {
                    effectiveDate: {
                        $max: [
                            "$createdAt",
                            {
                                $ifNull: [
                                    "$resurrectedAt",
                                    "$createdAt"
                                ]
                            }
                        ]
                    },
                    normalizedInterests: {
                        $map: {
                            input: {
                                $ifNull: [
                                    "$interests",
                                    []
                                ]
                            },
                            as: "rawTag",
                            in: {
                                $toLower: {
                                    $trim: {
                                        input: "$$rawTag"
                                    }
                                }
                            }
                        }
                    },
                    isSeedEntityCandidate: {
                        $in: [
                            { $toString: "$_id" },
                            [...seedEntityCandidateIdSet]
                        ]
                    },
                    isSeedTypeCandidate: {
                        $in: [
                            { $toString: "$_id" },
                            [...seedTypeCandidateIdSet]
                        ]
                    },
                    isExpandedCandidate: {
                        $in: [
                            { $toString: "$_id" },
                            [...expandedCandidateIdSet]
                        ]
                    },
                    isExploreCandidate: {
                        $in: [
                            { $toString: "$_id" },
                            exploreOnlyCandidateIds
                        ]
                    }
                }
            },
            {
                $addFields: {
                    ageInHours: {
                        $max: [
                            0.5,
                            {
                                $divide: [
                                    {
                                        $subtract: [
                                            now,
                                            "$effectiveDate"
                                        ]
                                    },
                                    3600000
                                ]
                            }
                        ]
                    },
                    isActiveBoost: {
                        $and: [
                            {
                                $ne: [
                                    "$boostedUntil",
                                    null
                                ]
                            },
                            {
                                $gt: [
                                    "$boostedUntil",
                                    now
                                ]
                            }
                        ]
                    },
                    isViewerConnectedToClan: {
                        $or: [
                            {
                                $in: [
                                    "$clanId",
                                    activeClanTags
                                ]
                            },
                            {
                                $in: [
                                    "$clanTag",
                                    activeClanTags
                                ]
                            }
                        ]
                    },
                    seedEntityOverlapCount: {
                        $size: {
                            $setIntersection: [
                                "$normalizedInterests",
                                seedEntityTags
                            ]
                        }
                    },
                    seedTypeOverlapCount: {
                        $size: {
                            $setIntersection: [
                                "$normalizedInterests",
                                seedTypeTags
                            ]
                        }
                    },
                    expandedEntityOverlapCount: {
                        $size: {
                            $setIntersection: [
                                "$normalizedInterests",
                                expandedEntityTags
                            ]
                        }
                    }
                }
            },
            {
                $addFields: {
                    tagAffinityTotal: {
                        $sum: {
                            $map: {
                                input: "$normalizedInterests",
                                as: "cleanTag",
                                in: {
                                    $let: {
                                        vars: {
                                            dynamicScore: {
                                                $ifNull: [
                                                    {
                                                        $getField: {
                                                            field: "$$cleanTag",
                                                            input: {
                                                                $literal:
                                                                    safeAffinity
                                                            }
                                                        }
                                                    },
                                                    0
                                                ]
                                            },
                                            isStaticMatch: {
                                                $in: [
                                                    "$$cleanTag",
                                                    personalizedInterestTags
                                                ]
                                            }
                                        },
                                        in: {
                                            $cond: [
                                                {
                                                    $gt: [
                                                        "$$dynamicScore",
                                                        0
                                                    ]
                                                },
                                                "$$dynamicScore",
                                                {
                                                    $cond: [
                                                        "$$isStaticMatch",
                                                        config.staticPrefBonus,
                                                        0
                                                    ]
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    authorAffinityScore: {
                        $ifNull: [
                            {
                                $getField: {
                                    field: {
                                        $toString: {
                                            $ifNull: [
                                                "$authorUserId",
                                                "$authorId"
                                            ]
                                        }
                                    },
                                    input: {
                                        $literal:
                                            safeAuthorAffinity
                                    }
                                }
                            },
                            0
                        ]
                    },
                    countryAffinityScore: {
                        $let: {
                            vars: {
                                dynamicCountryScore: {
                                    $ifNull: [
                                        {
                                            $getField: {
                                                field: {
                                                    $ifNull: [
                                                        "$country",
                                                        "Global"
                                                    ]
                                                },
                                                input: {
                                                    $literal:
                                                        safeCountryAffinity
                                                }
                                            }
                                        },
                                        0
                                    ]
                                },
                                isStaticCountry: {
                                    $eq: [
                                        "$country",
                                        userCountry
                                    ]
                                }
                            },
                            in: {
                                $cond: [
                                    {
                                        $gt: [
                                            "$$dynamicCountryScore",
                                            0
                                        ]
                                    },
                                    "$$dynamicCountryScore",
                                    {
                                        $cond: [
                                            "$$isStaticCountry",
                                            config.staticLocalBonus,
                                            0
                                        ]
                                    }
                                ]
                            }
                        }
                    },
                    decayedHypeWeight: {
                        $divide: [
                            config.hypeBaseWeight,
                            {
                                $max: [
                                    1,
                                    {
                                        $multiply: [
                                            "$ageInHours",
                                            config.hypeDecayRate
                                        ]
                                    }
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $addFields: {
                    isRelatedCandidate: {
                        $or: [
                            "$isSeedEntityCandidate",
                            "$isSeedTypeCandidate",
                            "$isExpandedCandidate",
                            {
                                $gt: [
                                    "$seedEntityOverlapCount",
                                    0
                                ]
                            },
                            {
                                $gt: [
                                    "$seedTypeOverlapCount",
                                    0
                                ]
                            },
                            {
                                $gt: [
                                    "$expandedEntityOverlapCount",
                                    0
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $addFields: {
                    decayHalfLifeHours: {
                        $switch: {
                            branches: [
                                {
                                    case: "$isRelatedCandidate",
                                    then:
                                        config.relatedHalfLifeHours
                                },
                                {
                                    case:
                                        "$isViewerConnectedToClan",
                                    then:
                                        config.clanHalfLifeHours
                                },
                                {
                                    case:
                                        "$isExploreCandidate",
                                    then:
                                        config.exploreHalfLifeHours
                                }
                            ],
                            default:
                                config.normalHalfLifeHours
                        }
                    },
                    gravityPowerForPost: {
                        $switch: {
                            branches: [
                                {
                                    case: "$isRelatedCandidate",
                                    then:
                                        config.relatedGravityPower
                                },
                                {
                                    case:
                                        "$isViewerConnectedToClan",
                                    then:
                                        config.clanGravityPower
                                },
                                {
                                    case:
                                        "$isExploreCandidate",
                                    then:
                                        config.exploreGravityPower
                                }
                            ],
                            default:
                                config.normalGravityPower
                        }
                    }
                }
            },
            {
                $addFields: {
                    engagementScore: {
                        $multiply: [
                            {
                                $add: [
                                    {
                                        $cond: [
                                            "$isActiveBoost",
                                            config.boostIgnitionScore,
                                            0
                                        ]
                                    },
                                    {
                                        $multiply: [
                                            "$likesCountForRanking",
                                            config.likeWeight
                                        ]
                                    },
                                    {
                                        $multiply: [
                                            "$commentsCountForRanking",
                                            config.commentWeight
                                        ]
                                    },
                                    {
                                        $multiply: [
                                            {
                                                $sqrt: {
                                                    $max: [
                                                        0,
                                                        "$hypePointsForRanking"
                                                    ]
                                                }
                                            },
                                            "$decayedHypeWeight"
                                        ]
                                    }
                                ]
                            },
                            {
                                $cond: [
                                    "$isActiveBoost",
                                    config.postBoostMultiplier,
                                    1
                                ]
                            }
                        ]
                    },
                    relevanceBonus: {
                        $add: [
                            {
                                $multiply: [
                                    "$tagAffinityTotal",
                                    config.affinityMultiplier
                                ]
                            },
                            {
                                $multiply: [
                                    "$authorAffinityScore",
                                    config.affinityMultiplier
                                ]
                            },
                            {
                                $multiply: [
                                    "$countryAffinityScore",
                                    config.affinityMultiplier
                                ]
                            },
                            {
                                $cond: [
                                    "$isViewerConnectedToClan",
                                    config.clanBonus,
                                    0
                                ]
                            },
                            {
                                $multiply: [
                                    "$seedEntityOverlapCount",
                                    config.seedEntityBonus
                                ]
                            },
                            {
                                $multiply: [
                                    "$seedTypeOverlapCount",
                                    config.seedTypeBonus
                                ]
                            },
                            {
                                $multiply: [
                                    "$expandedEntityOverlapCount",
                                    config.expandedEntityBonus
                                ]
                            }
                        ]
                    },
                    noveltyScore: {
                        $cond: [
                            {
                                $lt: [
                                    "$ageInHours",
                                    config.freshnessWindow
                                ]
                            },
                            config.freshnessBoost,
                            0
                        ]
                    }
                }
            },
            {
                $addFields: {
                    decayDenominator: {
                        $pow: [
                            {
                                $add: [
                                    1,
                                    {
                                        $divide: [
                                            "$ageInHours",
                                            "$decayHalfLifeHours"
                                        ]
                                    }
                                ]
                            },
                            "$gravityPowerForPost"
                        ]
                    }
                }
            },
            {
                $addFields: {
                    finalScore: {
                        $add: [
                            {
                                $divide: [
                                    {
                                        $add: [
                                            "$engagementScore",
                                            "$relevanceBonus",
                                            "$noveltyScore"
                                        ]
                                    },
                                    "$decayDenominator"
                                ]
                            },
                            {
                                $cond: [
                                    "$isExploreCandidate",
                                    config.exploreBonus,
                                    0
                                ]
                            }
                        ]
                    }
                }
            },
            {
                $sort: {
                    finalScore: -1,
                    isAdminPost: -1,
                    effectiveDate: -1,
                    mediaIndex: 1
                }
            },
            {
                $project: {
                    _id: 1,
                    mediaIndex: 1,
                    rankedMediaUrl: "$media.url",

                    authorUserId: 1,
                    authorId: 1,
                    clanId: 1,
                    clanTag: 1,

                    category: 1,
                    interests: 1,

                    finalScore: 1,
                    effectiveDate: 1,

                    seedEntityOverlapCount: 1,
                    seedTypeOverlapCount: 1,
                    expandedEntityOverlapCount: 1
                }
            }
        ];

        const rankingStartedAt = Date.now();
        let rankedRows = await Post.aggregate(
            lightweightPipeline
        );

        console.log(
            "Video feed lightweight ranking:",
            Date.now() - rankingStartedAt,
            "ms"
        );

        if (
            rankedRows.length > 0
            && !authorFilter
            && !clanFilter
        ) {
            rankedRows = applyDiversityPass(
                rankedRows,
                2
            );
        }

        const pageRankedRows = rankedRows.slice(
            skip,
            skip + limit
        );

        console.log(
            "Video feed ranking diagnostics:",
            {
                page,
                pageSize: pageRankedRows.length,
                totalCandidatePosts: total,
                totalRankedVideoItems:
                    rankedRows.length,
                seedEntityMatches:
                    pageRankedRows.filter(row =>
                        row.seedEntityOverlapCount > 0
                    ).length,
                seedTypeMatches:
                    pageRankedRows.filter(row =>
                        row.seedTypeOverlapCount > 0
                    ).length,
                expandedMatches:
                    pageRankedRows.filter(row =>
                        row.expandedEntityOverlapCount > 0
                    ).length,
                seedTypeTags
            }
        );

        const fullFetchStartedAt = Date.now();

        const posts = await fetchCompactVideoRowsInOrder(
            pageRankedRows,
            deviceId
        );

        console.log(
            "Video feed final post fetch:",
            Date.now() - fullFetchStartedAt,
            "ms"
        );

        // ================================================================
        // COMPACT AUTHOR / CLAN POPULATION
        // ================================================================
        const populationStartedAt = Date.now();

        let userMap = {};
        let clanMap = {};

        try {
            const uniqueAuthorKeys = [
                ...new Set(
                    posts
                        .map(post =>
                            (
                                post.authorUserId
                                || post.authorId
                            )?.toString()
                        )
                        .filter(Boolean)
                )
            ];

            const authorObjectIds =
                uniqueAuthorKeys
                    .filter(id =>
                        mongoose.Types.ObjectId.isValid(id)
                    )
                    .map(id =>
                        new mongoose.Types.ObjectId(id)
                    );

            const legacyAuthorIds =
                uniqueAuthorKeys.filter(id =>
                    !mongoose.Types.ObjectId.isValid(id)
                );

            const uniqueClanKeys = [
                ...new Set(
                    posts
                        .map(post =>
                            (
                                post.clanTag
                                || post.clanId
                            )?.toString()
                        )
                        .filter(Boolean)
                )
            ];

            const clanObjectIds =
                uniqueClanKeys
                    .filter(id =>
                        mongoose.Types.ObjectId.isValid(id)
                    )
                    .map(id =>
                        new mongoose.Types.ObjectId(id)
                    );

            const [users, clans] = await Promise.all([
                uniqueAuthorKeys.length > 0
                    ? MobileUser.aggregate([
                        {
                            $match: {
                                $or: [
                                    {
                                        _id: {
                                            $in:
                                                authorObjectIds
                                        }
                                    },
                                    {
                                        deviceId: {
                                            $in:
                                                legacyAuthorIds
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $project: {
                                deviceId: 1,
                                username: 1,
                                "profilePic.url": 1,
                                lastStreak: 1,
                                previousRank: 1,
                                peakLevel: 1,
                                currentRankLevel: 1,
                                aura: 1,
                                equippedTitle: 1,
                                nameLockedUntil: 1,
                                inventory: {
                                    $filter: {
                                        input: {
                                            $cond: [
                                                {
                                                    $isArray:
                                                        "$inventory"
                                                },
                                                "$inventory",
                                                {
                                                    $cond: [
                                                        {
                                                            $isArray:
                                                                "$specialInventory"
                                                        },
                                                        "$specialInventory",
                                                        []
                                                    ]
                                                }
                                            ]
                                        },
                                        as: "item",
                                        cond: {
                                            $eq: [
                                                "$$item.isEquipped",
                                                true
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    ])
                    : Promise.resolve([]),

                uniqueClanKeys.length > 0
                    ? Clan.aggregate([
                        {
                            $match: {
                                $or: [
                                    {
                                        tag: {
                                            $in:
                                                uniqueClanKeys
                                        }
                                    },
                                    {
                                        _id: {
                                            $in:
                                                clanObjectIds
                                        }
                                    }
                                ]
                            }
                        },
                        {
                            $project: {
                                tag: 1,
                                name: 1,
                                displayName: 1,
                                rank: 1,
                                totalPoints: 1,
                                followerCount: 1,
                                isInWar: 1,
                                verifiedUntil: 1,
                                verifiedClan: 1,
                                primeLevel: 1,
                                nameLockedUntil: 1,
                                "activeCustomizations.verifiedTier": 1,
                                "activeCustomizations.verifiedBadgeXml": 1,
                                activeGlowColor: 1,
                                specialInventory: {
                                    $filter: {
                                        input: {
                                            $cond: [
                                                {
                                                    $isArray:
                                                        "$specialInventory"
                                                },
                                                "$specialInventory",
                                                []
                                            ]
                                        },
                                        as: "item",
                                        cond: {
                                            $eq: [
                                                "$$item.isEquipped",
                                                true
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    ])
                    : Promise.resolve([])
            ]);

            for (const user of users) {
                const userId = user._id.toString();

                const rankInfo =
                    typeof resolveUserRankServer
                        === "function"
                        ? resolveUserRankServer(
                            user.currentRankLevel || 1
                        )
                        : { rankName: "Rookie" };

                const auraInfo =
                    typeof getAuraVisualsServer
                        === "function"
                        ? getAuraVisualsServer(
                            user.previousRank || 0
                        )
                        : null;

                const inventory =
                    Array.isArray(user.inventory)
                        ? user.inventory
                        : [];

                const enrichedUser = {
                    _id: userId,
                    userId,
                    name: user.username,
                    username: user.username,
                    image:
                        user.profilePic?.url || null,
                    streak: user.lastStreak || 0,
                    rank: user.previousRank || 0,
                    peakLevel: user.peakLevel || 0,
                    inventory,
                    rankLevel:
                        user.currentRankLevel || 1,
                    aura: user.aura || 0,
                    displayRank: rankInfo.rankName,
                    auraVisuals: auraInfo,
                    equippedGlow:
                        inventory.find(item =>
                            (
                                item.category === "GLOW"
                                || item.category
                                === "NAME_GLOW"
                            )
                            && item.isEquipped
                        ) || null,
                    equippedBadges:
                        inventory
                            .filter(item =>
                                item.category === "BADGE"
                                && item.isEquipped
                            )
                            .slice(0, 3),
                    equippedTitle:
                        user.equippedTitle || null,
                    nameLockedUntil:
                        user.nameLockedUntil || null
                };

                userMap[userId] = enrichedUser;

                if (user.deviceId) {
                    userMap[user.deviceId] =
                        enrichedUser;
                }
            }

            for (const clan of clans) {
                const clanId =
                    clan._id.toString();

                const enrichedClan = {
                    ...clan,
                    _id: clanId,
                    displayRank:
                        typeof resolveClanDisplayRank
                            === "function"
                            ? resolveClanDisplayRank(
                                clan.totalPoints || 0
                            )
                            : "Rank 1"
                };

                if (clan.tag) {
                    clanMap[clan.tag] =
                        enrichedClan;
                }

                clanMap[clanId] = enrichedClan;
            }
        } catch (populationError) {
            console.error(
                "Video feed population error:",
                populationError
            );
        }

        console.log(
            "Video feed population:",
            Date.now() - populationStartedAt,
            "ms"
        );

        // ================================================================
        // EXPLICIT VIDEO-CARD SERIALIZATION
        // ================================================================
        const serializationStartedAt = Date.now();

        const serializedPosts = posts.map(post => {
            const postId = post._id.toString();

            const authorKey =
                (
                    post.authorUserId
                    || post.authorId
                )?.toString();

            const clanKey =
                (
                    post.clanTag
                    || post.clanId
                )?.toString();

            const feedMessage = (post.message || "")
                .replace(
                    /s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs,
                    "$1$2$3$4$5$6$8$10"
                )
                .replace(/\n+/g, " ")
                .trim();

            const likesCount =
                post.likesCount ?? 0;

            const commentsCount =
                post.commentsCount ?? 0;

            const discussionCount =
                post.discussionCount ?? 0;

            const hypePoints =
                post.hypePoints ?? 0;

            const hypeCount =
                post.hypeCount ?? 0;

            const sharesCount =
                post.sharesCount ?? 0;

            const viewsCount =
                post.viewsCount ?? 0;

            const isTrending =
                hypePoints
                >= config.trendingThreshold;

            const isBoosted = Boolean(
                post.boostedUntil
                && new Date(
                    post.boostedUntil
                ).getTime() > now.getTime()
            );

            const isResurrected = Boolean(
                post.resurrectedAt
                && new Date(
                    post.resurrectedAt
                ) > fortyEightHoursAgo
            );

            const isFollowingClan = Boolean(
                clanKey
                && followedClanTags.includes(
                    clanKey
                )
            );

            const candidateSources =
                candidateMap.get(postId)?.sources
                || [];

            const contentTypeTag =
                (post.interests || [])
                    .map(normalizeTag)
                    .find(isContentTypeTag)
                || null;

            return {
                _id: postId,
                postId,
                videoId:
                    `${postId}_${post.mediaIndex}`,

                slug: post.slug || null,

                mediaUrl:
                    post.selectedMedia.url,
                mediaType:
                    post.selectedMedia.type
                    || "video",
                mediaIndex: post.mediaIndex,
                media: post.selectedMedia,

                title: post.title,
                content:
                    feedMessage.length > 150
                        ? `${feedMessage.slice(
                            0,
                            150
                        )}...`
                        : feedMessage,

                authorUserId:
                    post.authorUserId?.toString?.()
                    || post.authorUserId
                    || post.authorId
                    || null,

                authorId:
                    post.authorId || null,

                authorName:
                    post.authorName || "Anonymous",

                clanId: clanKey || null,
                category:
                    post.category || "News",
                country:
                    post.country || "Global",

                interests:
                    Array.isArray(post.interests)
                        ? post.interests
                        : [],

                contentTypeTag,

                createdAt: post.createdAt,
                updatedAt: post.updatedAt,
                resurrectedAt:
                    post.resurrectedAt || null,
                boostedUntil:
                    post.boostedUntil || null,

                stats: {
                    likes: likesCount,
                    comments: commentsCount,
                    discussions: discussionCount,
                    hype: hypePoints,
                    hypeCount,
                    shares: sharesCount,
                    views: viewsCount
                },

                likesCount,
                commentsCount,
                discussionCount,
                hypePoints,
                hypeCount,
                sharesCount,
                viewsCount,

                isLiked: Boolean(post.hasLiked),
                hasLiked: Boolean(post.hasLiked),

                isTrending,
                isBoosted,
                isResurrected,
                isFollowingClan,

                candidateSources,

                authorData:
                    userMap[authorKey] || null,

                clanData:
                    clanMap[clanKey] || null
            };
        });

        console.log(
            "Video feed serialization:",
            Date.now() - serializationStartedAt,
            "ms"
        );

        const responseStartedAt = Date.now();

        const response = NextResponse.json(
            {
                posts: serializedPosts,
                total,
                page,
                limit
            },
            { status: 200 }
        );

        console.log(
            "Video feed response construction:",
            Date.now() - responseStartedAt,
            "ms"
        );

        console.log(
            "Total video feed request:",
            Date.now() - requestStartedAt,
            "ms"
        );

        return response;
    } catch (error) {
        console.error(
            "GET Video Feed Error:",
            error
        );

        return NextResponse.json(
            {
                message:
                    "Failed to fetch video feed"
            },
            { status: 500 }
        );
    }
}
const DEFAULT_REFERRAL_CONFIG = Object.freeze({
    maxReferrals: 5,
    spinTokensPerReferral: 10,
    referralSpinTokenRewards: null,
    reviewRewardSpinTokens: 10,
});

const DEFAULT_PULL_PRICING = Object.freeze({
    "1x": {
        pulls: 1,
        spinTokenCost: 1,
        gridOcCost: 25,
        rouletteOcCost: 50,
    },

    // Existing frontend bundle: 11 rewards for either 10 spin tokens or OC.
    "11x": {
        pulls: 11,
        spinTokenCost: 10,
        gridOcCost: 250,
        rouletteOcCost: 500,
    },

    // Optional future true 10-pull button.
    "10x": {
        pulls: 10,
        spinTokenCost: 10,
        gridOcCost: 250,
        rouletteOcCost: 500,
    },
});

const cloneEvent = event => ({
    ...event,

    rewards: event.rewards
        ? { ...event.rewards }
        : undefined,

    tokenVisual: event.tokenVisual
        ? { ...event.tokenVisual }
        : undefined,

    referralConfig: event.referralConfig
        ? {
            ...event.referralConfig,
            referralSpinTokenRewards:
                Array.isArray(
                    event.referralConfig
                        .referralSpinTokenRewards
                )
                    ? [
                        ...event.referralConfig
                            .referralSpinTokenRewards,
                    ]
                    : null,
        }
        : undefined,

    pullPricing: event.pullPricing
        ? { ...event.pullPricing }
        : undefined,
});

/**
 * Shared manual/system events.
 *
 * Import this module from routes. Do not import values from another route.js.
 */
export const RAW_SYSTEM_EVENTS = Object.freeze([
    Object.freeze({
        id: "claim-3k-posts-event",
        type: "CLAIM",
        title: "3K Posts Celebration!",
        description:
            "Oreblogda has officially reached 3,000 community posts! Thank you for every post, comment, and moment shared.",
        isSystem: true,
        rewards: {
            oc: 100,
            mysteryItem: true,
        },
        startsAt:
            new Date(
                "2026-07-22T19:00:00Z"
            ).toISOString(),
        endsAt:
            new Date(
                "2026-07-25T23:59:59Z"
            ).toISOString(),
        themeColor: "#F59E0B",
        visibility: "PUBLIC",
    }),

    Object.freeze({
        id: "ninja_art",
        type: "gacha",
        gachaType: "GRID",
        title: "Ninja Arts",
        description:
            "Recruit allies, earn Chakra Orbs, and use them to summon limited rewards.",
        startsAt:
            new Date(
                "2026-08-01T00:00:00Z"
            ).toISOString(),
        endsAt:
            new Date(
                "2026-09-01T00:00:00Z"
            ).toISOString(),
        eventType: "seasonal",

        // This is the summon currency, not eventPoints.
        tokenName: "Chakra Orb",
        tokenVisual: {
            svgCode: `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="a" x1="15%" y1="10%" x2="85%" y2="90%"><stop offset="0%" stop-color="#f8fafc"/><stop offset="22%" stop-color="#94a3b8"/><stop offset="48%" stop-color="#e2e8f0"/><stop offset="72%" stop-color="#64748b"/><stop offset="100%" stop-color="#cbd5e1"/></linearGradient><linearGradient id="c" x1="20%" y1="0%" x2="80%" y2="100%"><stop offset="0%" stop-color="#475569"/><stop offset="50%" stop-color="#0f172a"/><stop offset="100%" stop-color="#334155"/></linearGradient><filter id="d" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.5" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="b" x="-50%" y="-50%" width="200%" height="200%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-color="#020617" flood-opacity=".65"/></filter><radialGradient id="e" cx="50%" cy="42%" r="60%"><stop offset="0%" stop-color="#fff"/><stop offset="28%" stop-color="#dbeafe"/><stop offset="58%" stop-color="#7dd3fc"/><stop offset="82%" stop-color="#2563eb"/><stop offset="100%" stop-color="#172554"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="#38bdf8" opacity=".1"/><circle cx="50" cy="50" r="44" fill="#0f172a" opacity=".15"/><circle cx="50" cy="50" r="42" fill="url(#a)" filter="url(#b)"/><circle cx="50" cy="50" r="35.5" fill="url(#c)"/><circle cx="50" cy="50" r="31" fill="none" stroke="#cbd5e1" stroke-width="1.3" opacity=".55"/><path d="M50 17a33 33 0 0 1 19 6" fill="none" stroke="#38bdf8" stroke-width="5" stroke-linecap="round"/><path d="M75 27a33 33 0 0 1 7 20" fill="none" stroke="#f97316" stroke-width="5" stroke-linecap="round"/><path d="M81 56a33 33 0 0 1-14 20" fill="none" stroke="#eab308" stroke-width="5" stroke-linecap="round"/><path d="M59 81a33 33 0 0 1-21-1" fill="none" stroke="#22c55e" stroke-width="5" stroke-linecap="round"/><path d="M30 75a33 33 0 0 1-12-19" fill="none" stroke="#a78bfa" stroke-width="5" stroke-linecap="round"/><path d="M18 45a33 33 0 0 1 17-23" fill="none" stroke="#d6b17a" stroke-width="5" stroke-linecap="round"/><g filter="url(#d)"><circle cx="50" cy="16.5" r="2.2" fill="#e0f2fe"/><circle cx="80.5" cy="32" r="2.2" fill="#fed7aa"/><circle cx="78.5" cy="67.5" r="2.2" fill="#fde68a"/><circle cx="50" cy="83.5" r="2.2" fill="#bbf7d0"/><circle cx="20.5" cy="67.5" r="2.2" fill="#ddd6fe"/><circle cx="19.5" cy="32.5" r="2.2" fill="#fde7c3"/></g><circle cx="50" cy="50" r="20" fill="url(#e)" filter="url(#d)"/><path d="M37 52c2-10 10-16 20-14 9 2 13 11 9 19s-14 11-22 6c-6-4-7-11-3-16s12-5 16 0c3 4 1 9-3 11-5 2-9-1-9-5" fill="none" stroke="#fff" stroke-width="3" stroke-linecap="round" opacity=".92"/><path d="m50 40 7 10-7 10-7-10Z" fill="#e0f2fe" opacity=".85"/><path d="m50 44 4 6-4 6-4-6Z" fill="#1d4ed8"/><circle cx="44" cy="43" r="3.2" fill="#fff" opacity=".9"/><circle cx="57" cy="58" r="1.7" fill="#fff" opacity=".75"/><g fill="#e2e8f0" opacity=".75"><circle cx="50" cy="11.5" r="1"/><circle cx="88.5" cy="50" r="1"/><circle cx="50" cy="88.5" r="1"/><circle cx="11.5" cy="50" r="1"/></g></svg>
            `,
        },

        icon: "flare",
        themeColor: "#8bf755",
        visibility: "PUBLIC",

        includeReferral: true,

        referralConfig: {
            maxReferrals: 3,
            spinTokensPerReferral: 10,
            reviewRewardSpinTokens: 10,

            // Optional increasing rewards:
            referralSpinTokenRewards: [10, 15, 25,],
        },

        pullPricing: DEFAULT_PULL_PRICING,

        // Only used by roulette events.
        pityThreshold: 50,
    }),
]);

export const assertSafeEventId = value => {
    const eventId =
        String(value || "").trim();

    if (
        !eventId
        || eventId.includes(".")
        || eventId.startsWith("$")
        || eventId.length > 100
    ) {
        throw new Error(
            "Invalid event ID."
        );
    }

    return eventId;
};

const parseDate = value => {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(
        date.getTime()
    )
        ? null
        : date;
};

export const getSystemEventState = (
    event,
    now = new Date()
) => {
    if (!event) {
        return {
            exists: false,
            isComing: false,
            isActive: false,
            isExpired: false,
            status: "missing",
        };
    }

    const currentDate =
        now instanceof Date
            ? now
            : new Date(now);

    const startsAt =
        parseDate(event.startsAt);

    const endsAt =
        parseDate(event.endsAt);

    const isComing = Boolean(
        startsAt
        && startsAt > currentDate
    );

    const isExpired = Boolean(
        endsAt
        && endsAt <= currentDate
    );

    return {
        exists: true,
        startsAt,
        endsAt,
        isComing,
        isExpired,
        isActive:
            !isComing
            && !isExpired,
        status: isComing
            ? "coming_soon"
            : isExpired
                ? "expired"
                : "active",
    };
};

export const getRawSystemEvents = () =>
    RAW_SYSTEM_EVENTS.map(cloneEvent);

export const getSystemEventById = value => {
    const eventId =
        assertSafeEventId(value);

    const event =
        RAW_SYSTEM_EVENTS.find(
            candidate =>
                candidate.id === eventId
        );

    return event
        ? cloneEvent(event)
        : null;
};

export const getAvailableSystemEvents = (
    now = new Date()
) => (
    RAW_SYSTEM_EVENTS
        .filter(event => (
            !getSystemEventState(
                event,
                now
            ).isExpired
        ))
        .map(event => {
            const state =
                getSystemEventState(
                    event,
                    now
                );

            return {
                ...cloneEvent(event),
                isComing:
                    state.isComing,
                status:
                    state.status,
            };
        })
);

export const getActiveGachaEventById = (
    value,
    now = new Date()
) => {
    const event =
        getSystemEventById(value);

    if (
        !event
        || String(
            event.type
        ).toLowerCase() !== "gacha"
        || !getSystemEventState(
            event,
            now
        ).isActive
    ) {
        return null;
    }

    return event;
};

export const getActiveReferralGachaEvents = (
    now = new Date()
) => (
    RAW_SYSTEM_EVENTS
        .filter(event => (
            String(
                event.type
            ).toLowerCase() === "gacha"
            && event.includeReferral === true
            && getSystemEventState(
                event,
                now
            ).isActive
        ))
        .map(cloneEvent)
);

export const getReferralConfig = event => {
    const supplied =
        event?.referralConfig || {};

    const rewards =
        Array.isArray(
            supplied
                .referralSpinTokenRewards
        )
            ? supplied
                .referralSpinTokenRewards
                .map(value => (
                    Math.max(
                        0,
                        Number(value) || 0
                    )
                ))
            : null;

    return {
        maxReferrals:
            Math.max(
                1,
                Number(
                    supplied.maxReferrals
                    ?? DEFAULT_REFERRAL_CONFIG
                        .maxReferrals
                ) || 1
            ),

        spinTokensPerReferral:
            Math.max(
                0,
                Number(
                    supplied
                        .spinTokensPerReferral
                    ?? DEFAULT_REFERRAL_CONFIG
                        .spinTokensPerReferral
                ) || 0
            ),

        referralSpinTokenRewards:
            rewards,

        reviewRewardSpinTokens:
            Math.max(
                0,
                Number(
                    supplied
                        .reviewRewardSpinTokens
                    ?? DEFAULT_REFERRAL_CONFIG
                        .reviewRewardSpinTokens
                ) || 0
            ),
    };
};

export const getNextReferralSpinTokenReward = (
    event,
    rewardedReferralCount
) => {
    const config =
        getReferralConfig(event);

    const currentCount =
        Math.max(
            0,
            Number(
                rewardedReferralCount
            ) || 0
        );

    if (
        currentCount
        >= config.maxReferrals
    ) {
        return {
            eligible: false,
            milestone:
                currentCount + 1,
            spinTokens: 0,
            config,
        };
    }

    const spinTokens =
        config
            .referralSpinTokenRewards
        ?.[currentCount]
        ?? config
            .spinTokensPerReferral;

    return {
        eligible:
            spinTokens > 0,
        milestone:
            currentCount + 1,
        spinTokens:
            Math.max(
                0,
                Number(spinTokens) || 0
            ),
        config,
    };
};

export const getPullPricing = (
    event,
    requestedPullType
) => {
    const pullType =
        ["1x", "10x", "11x"].includes(
            String(requestedPullType)
        )
            ? String(requestedPullType)
            : "1x";

    const supplied =
        event?.pullPricing
        ?.[pullType]
        || DEFAULT_PULL_PRICING[
        pullType
        ];

    const isRoulette =
        String(
            event?.gachaType
        ).toUpperCase()
        === "ROULETTE";

    return {
        pullType,
        pulls:
            Math.max(
                1,
                Number(
                    supplied.pulls
                ) || 1
            ),
        spinTokenCost:
            Math.max(
                0,
                Number(
                    supplied
                        .spinTokenCost
                ) || 0
            ),
        ocCost:
            Math.max(
                0,
                Number(
                    isRoulette
                        ? supplied
                            .rouletteOcCost
                        : supplied
                            .gridOcCost
                ) || 0
            ),
    };
};

import {
    getActiveReferralGachaEvents,
    getReferralConfig,
} from "@/app/lib/eventRegistry";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

const toPlainMap = value => {
    if (value instanceof Map) {
        return Object.fromEntries(
            value.entries()
        );
    }

    if (
        value
        && typeof value === "object"
    ) {
        return { ...value };
    }

    return {};
};

const readMapValue = (
    value,
    key
) => {
    if (value instanceof Map) {
        return value.get(key);
    }

    return value?.[key];
};

const toPlainValue = value => (
    value
        && typeof value.toObject
        === "function"
        ? value.toObject()
        : value && typeof value === "object"
            ? { ...value }
            : {}
);

export async function GET(req) {
    try {
        await connectDB();

        const { searchParams } =
            new URL(req.url);

        const deviceId =
            req.headers.get(
                "x-user-deviceId"
            )
            || searchParams.get(
                "deviceId"
            );

        if (!deviceId) {
            return NextResponse.json(
                {
                    message:
                        "Authentication missing.",
                },
                { status: 401 }
            );
        }

        const [
            user,
            leaderboardUsers,
        ] = await Promise.all([
            MobileUser.findOne({
                deviceId,
            })
                .select(
                    "_id username referralCode "
                    + "referralCount invitedUsers "
                    + "eventPoints eventSpinTokens referralCampaigns"
                )
                .lean(),

            MobileUser.find({
                referralCount: {
                    $gt: 0,
                },
            })
                .select(
                    "_id username referralCount"
                )
                .sort({
                    referralCount: -1,
                    createdAt: 1,
                })
                .limit(20)
                .lean(),
        ]);

        if (!user) {
            return NextResponse.json(
                {
                    message:
                        "User not found.",
                },
                { status: 404 }
            );
        }

        const storedCampaigns =
            toPlainMap(
                user.referralCampaigns
            );

        const activeCampaigns =
            getActiveReferralGachaEvents(
                new Date()
            );

        const campaigns = {};

        for (
            const event
            of activeCampaigns
        ) {
            const config =
                getReferralConfig(event);

            const stored =
                toPlainValue(
                    storedCampaigns[
                    event.id
                    ]
                );

            campaigns[event.id] = {
                eventId: event.id,
                eventTitle:
                    event.title,
                spinTokenName:
                    event.spinTokenName
                    || event.tokenName
                    || "Spin Token",

                // Compatibility alias for the current frontend.
                tokenName:
                    event.spinTokenName
                    || event.tokenName
                    || "Spin Token",
                referralCount:
                    Number(
                        stored
                            .referralCount
                    ) || 0,
                rewardedReferralCount:
                    Number(
                        stored
                            .rewardedReferralCount
                        ?? stored
                            .referralCount
                    ) || 0,
                spinTokensEarned:
                    Number(
                        stored
                            .spinTokensEarned
                    ) || 0,

                spinTokenBalance:
                    Number(
                        readMapValue(
                            user.eventSpinTokens,
                            event.id
                        )
                    ) || 0,

                // Existing exchange currency, kept completely separate.
                eventPoints:
                    Number(
                        readMapValue(
                            user.eventPoints,
                            event.id
                        )
                    ) || 0,

                // Compatibility aliases for the current frontend component.
                tokensEarned:
                    Number(
                        stored
                            .spinTokensEarned
                    ) || 0,
                tokenBalance:
                    Number(
                        readMapValue(
                            user.eventSpinTokens,
                            event.id
                        )
                    ) || 0,
                reviewRewardClaimed:
                    Boolean(
                        stored
                            .reviewRewardClaimed
                    ),
                reviewRewardClaimedAt:
                    stored
                        .reviewRewardClaimedAt
                    || null,
                lastReferralAt:
                    stored
                        .lastReferralAt
                    || null,
                maxReferrals:
                    config.maxReferrals,
                spinTokensPerReferral:
                    config
                        .spinTokensPerReferral,
                referralSpinTokenRewards:
                    config
                        .referralSpinTokenRewards,
                reviewRewardSpinTokens:
                    config
                        .reviewRewardSpinTokens,

                // Compatibility aliases.
                tokensPerReferral:
                    config
                        .spinTokensPerReferral,
                referralRewards:
                    config
                        .referralSpinTokenRewards,
                reviewRewardTokens:
                    config
                        .reviewRewardSpinTokens,
                startsAt:
                    event.startsAt,
                endsAt:
                    event.endsAt,
            };
        }

        const invitedUsers =
            Array.isArray(
                user.invitedUsers
            )
                ? user.invitedUsers.map(
                    invitation => ({
                        userId:
                            invitation
                                .userId
                                ?.toString?.()
                            || invitation
                                .userId
                            || null,
                        username:
                            invitation
                                .username
                            || "New User",
                        date:
                            invitation.date
                            || invitation
                                .createdAt
                            || null,
                    })
                )
                : [];

        return NextResponse.json({
            success: true,
            referralCode:
                user.referralCode,
            referralCount:
                Number(
                    user.referralCount
                ) || 0,
            invitedUsers,
            myReferrals:
                invitedUsers,
            leaderboard:
                leaderboardUsers.map(
                    (
                        leaderboardUser,
                        index
                    ) => ({
                        rank:
                            index + 1,
                        userId:
                            leaderboardUser
                                ._id
                                .toString(),
                        username:
                            leaderboardUser
                                .username,
                        count:
                            Number(
                                leaderboardUser
                                    .referralCount
                            ) || 0,
                    })
                ),
            campaigns,
        });
    } catch (error) {
        console.error(
            "Referral stats error:",
            error
        );

        return NextResponse.json(
            {
                message:
                    "Unable to load referral stats.",
            },
            { status: 500 }
        );
    }
}

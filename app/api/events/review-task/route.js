import {
    assertSafeEventId,
    getActiveGachaEventById,
    getReferralConfig,
} from "@/app/lib/eventRegistry";
import connectDB from "@/app/lib/mongodb";
import MobileUser from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";

const readMapValue = (
    value,
    key
) => {
    if (value instanceof Map) {
        return value.get(key);
    }

    return value?.[key];
};

/**
 * This rewards opening the Play Store review task once per campaign.
 * Google Play does not expose proof that this specific user submitted a review.
 */
export async function POST(req) {
    try {
        await connectDB();

        const deviceId =
            req.headers.get(
                "x-user-deviceId"
            );

        const {
            eventId: rawEventId,
        } = await req.json();

        if (!deviceId) {
            return NextResponse.json(
                {
                    message:
                        "Authentication missing.",
                },
                { status: 401 }
            );
        }

        let eventId;

        try {
            eventId =
                assertSafeEventId(
                    rawEventId
                );
        } catch {
            return NextResponse.json(
                {
                    message:
                        "Invalid event ID.",
                },
                { status: 400 }
            );
        }

        const event =
            getActiveGachaEventById(
                eventId,
                new Date()
            );

        if (
            !event
            || event.includeReferral
            !== true
        ) {
            return NextResponse.json(
                {
                    message:
                        "This referral campaign is not active.",
                    code:
                        "REFERRAL_CAMPAIGN_INACTIVE",
                },
                { status: 410 }
            );
        }

        const {
            reviewRewardSpinTokens,
        } = getReferralConfig(event);

        if (
            reviewRewardSpinTokens <= 0
        ) {
            return NextResponse.json(
                {
                    message:
                        "This campaign has no review-task reward.",
                },
                { status: 409 }
            );
        }

        const reviewClaimPath =
            `referralCampaigns.${eventId}.reviewRewardClaimed`;

        const reviewClaimedAtPath =
            `referralCampaigns.${eventId}.reviewRewardClaimedAt`;

        const spinTokensEarnedPath =
            `referralCampaigns.${eventId}.spinTokensEarned`;

        const spinTokenBalancePath =
            `eventSpinTokens.${eventId}`;

        const updatedUser =
            await MobileUser.findOneAndUpdate(
                {
                    deviceId,
                    [reviewClaimPath]: {
                        $ne: true,
                    },
                },
                {
                    $inc: {
                        [spinTokenBalancePath]:
                            reviewRewardSpinTokens,
                        [spinTokensEarnedPath]:
                            reviewRewardSpinTokens,
                    },
                    $set: {
                        [reviewClaimPath]:
                            true,
                        [reviewClaimedAtPath]:
                            new Date(),
                    },
                },
                {
                    new: true,
                    runValidators: true,
                }
            )
                .select(
                    "eventSpinTokens referralCampaigns"
                )
                .lean();

        if (!updatedUser) {
            const existingUser =
                await MobileUser.findOne({
                    deviceId,
                })
                    .select(
                        "_id referralCampaigns"
                    )
                    .lean();

            if (!existingUser) {
                return NextResponse.json(
                    {
                        message:
                            "User not found.",
                    },
                    { status: 404 }
                );
            }

            return NextResponse.json(
                {
                    success: false,
                    code:
                        "REVIEW_TASK_ALREADY_CLAIMED",
                    message:
                        "This review task has already been claimed for the campaign.",
                },
                { status: 409 }
            );
        }

        return NextResponse.json({
            success: true,
            eventId,
            spinTokenName:
                event.spinTokenName
                || event.tokenName
                || "Spin Token",
            spinTokensAwarded:
                reviewRewardSpinTokens,
            spinTokens:
                Number(
                    readMapValue(
                        updatedUser
                            .eventSpinTokens,
                        eventId
                    )
                ) || 0,
            reviewRewardClaimed:
                true,
        });
    } catch (error) {
        console.error(
            "Review task claim error:",
            error
        );

        return NextResponse.json(
            {
                message:
                    error?.message
                    || "Unable to claim review task.",
            },
            { status: 500 }
        );
    }
}

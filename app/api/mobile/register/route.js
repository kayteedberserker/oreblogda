import {
    getActiveReferralGachaEvents,
    getNextReferralSpinTokenReward,
    getSystemEventState,
} from "@/app/lib/eventRegistry";
import { sendPillParallel } from "@/app/lib/messagePillService";
import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import ReferralEvent from "@/app/models/ReferralEvent";
import SecurityEvent from "@/app/models/SecurityEvent";
import crypto from "crypto";
import geoip from "geoip-lite";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { NextResponse } from "next/server";

const generateSecureSuffix = () => {
    const characters =
        "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    while (true) {
        let suffix = "";

        for (
            let index = 0;
            index < 4;
            index += 1
        ) {
            suffix += characters.charAt(
                Math.floor(
                    Math.random()
                    * characters.length
                )
            );
        }

        if (
            !/^(\w)\1+$/.test(suffix)
            && !"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                .includes(suffix)
        ) {
            return suffix;
        }
    }
};

const generateReferralCodeCandidate =
    username => {
        const prefix =
            String(username || "")
                .substring(0, 3)
                .toUpperCase()
                .replace(/[^A-Z]/g, "Z");

        const random =
            crypto.randomBytes(3)
                .toString("hex")
                .toUpperCase();

        return `ORE-${prefix}-${random}`;
    };

const createUniqueReferralCode =
    async ({
        username,
        session,
    }) => {
        for (
            let attempt = 0;
            attempt < 8;
            attempt += 1
        ) {
            const candidate =
                generateReferralCodeCandidate(
                    username
                );

            const exists =
                await MobileUser.exists({
                    referralCode: candidate,
                }).session(session);

            if (!exists) {
                return candidate;
            }
        }

        throw new Error(
            "Unable to generate a unique referral code."
        );
    };

const toMap = value => {
    if (value instanceof Map) {
        return value;
    }

    if (
        value
        && typeof value === "object"
    ) {
        return new Map(
            Object.entries(value)
        );
    }

    return new Map();
};

const readCampaignProgress = (
    campaignMap,
    eventId
) => {
    const value =
        campaignMap.get(eventId);

    const plain =
        value
            && typeof value.toObject
            === "function"
            ? value.toObject()
            : value
                ? { ...value }
                : {};

    return {
        referralCount:
            Number(
                plain.referralCount
            ) || 0,

        rewardedReferralCount:
            Number(
                plain
                    .rewardedReferralCount
                ?? plain.referralCount
            ) || 0,

        spinTokensEarned:
            Number(
                plain.spinTokensEarned
            ) || 0,

        lastReferralAt:
            plain.lastReferralAt
            || null,

        reviewRewardClaimed:
            Boolean(
                plain.reviewRewardClaimed
            ),

        reviewRewardClaimedAt:
            plain.reviewRewardClaimedAt
            || null,
    };
};

const createHttpError = (
    message,
    statusCode
) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    return error;
};

const getRequestIp = req => {
    const forwarded =
        req.headers.get(
            "x-forwarded-for"
        );

    return forwarded
        ? forwarded
            .split(",")[0]
            .trim()
        : "127.0.0.1";
};

const sendNotifications =
    async notifications => {
        if (
            !Array.isArray(
                notifications
            )
            || notifications.length === 0
        ) {
            return;
        }

        const results =
            await Promise.allSettled(
                notifications.map(
                    notification =>
                        sendPillParallel(
                            notification.pushToken
                                ? [
                                    notification
                                        .pushToken,
                                ]
                                : [],
                            notification.title,
                            notification.message,
                            notification.data,
                            notification.pill
                        )
                )
            );

        for (const result of results) {
            if (
                result.status
                === "rejected"
            ) {
                console.error(
                    "Registration notification failed:",
                    result.reason
                );
            }
        }
    };

export async function POST(req) {
    try {
        await connectDB();

        const {
            deviceId,
            hardwareId,
            username,
            pushToken,
            referredBy,
            preferences,
            character,
        } = await req.json();

        if (
            !deviceId
            || typeof deviceId
            !== "string"
            || !username
            || !String(username).trim()
        ) {
            return NextResponse.json(
                {
                    message:
                        "Neural credentials incomplete.",
                },
                { status: 400 }
            );
        }

        const normalizedUsername =
            String(username).trim();

        const normalizedHardwareId =
            String(
                hardwareId || deviceId
            ).trim();

        const safeRegexName =
            normalizedUsername.replace(
                /[.*+?^${}()|[\]\\]/g,
                "\\$&"
            );

        const canonicalUsername =
            normalizedUsername
                .toUpperCase()
                .replace(
                    /[^A-Z0-9]/g,
                    ""
                );

        const accessTokenSecret =
            process.env.JWT_SECRET;

        const refreshTokenSecret =
            process.env
                .REFRESH_TOKEN_SECRET;

        if (
            !accessTokenSecret
            || !refreshTokenSecret
        ) {
            throw new Error(
                "Authentication secrets are missing."
            );
        }

        const requestIp =
            getRequestIp(req);

        const geo =
            geoip.lookup(requestIp);

        const detectedCountry =
            geo?.country
            || "Unknown";

        // Snapshot used for fast filtering. Every campaign is checked again
        // inside the transaction before a reward is written.
        const referralCampaigns =
            getActiveReferralGachaEvents(
                new Date()
            );

        const defaultWardrobe = [
            {
                clothingId:
                    "default_hair",
                name:
                    "Standard Hair",
                type: "hair",
                isDefault: true,
            },
            {
                clothingId:
                    "default_top",
                name:
                    "Recruit Uniform",
                type: "top",
                isDefault: true,
            },
            {
                clothingId:
                    "default_pant",
                name:
                    "Training Slacks",
                type: "pant",
                isDefault: true,
            },
            {
                clothingId:
                    "default_shoe",
                name:
                    "Issued Boots",
                type: "shoe",
                isDefault: true,
            },
        ];

        const transactionOutput = {
            user: null,
            accessToken: null,
            refreshToken: null,
            notifications: [],
            hardwareAccountCount: 0,
        };

        await mongoose.connection.transaction(
            async session => {
                // transaction() can retry this callback.
                transactionOutput.user = null;
                transactionOutput.accessToken = null;
                transactionOutput.refreshToken = null;
                transactionOutput.notifications = [];

                const now = new Date();

                const [
                    activeUserLock,
                    activeClanLock,
                    exactNameMatch,
                    globalUserCount,
                    hardwareAccountCount,
                ] = await Promise.all([
                    MobileUser.findOne({
                        nameLockedUntil: {
                            $gt: now,
                        },
                        canonicalUsername,
                    })
                        .select("_id")
                        .session(session),

                    Clan.findOne({
                        nameLockedUntil: {
                            $gt: now,
                        },
                        canonicalName:
                            canonicalUsername,
                    })
                        .select("_id")
                        .session(session),

                    MobileUser.findOne({
                        username: {
                            $regex:
                                new RegExp(
                                    `^${safeRegexName}$`,
                                    "i"
                                ),
                        },
                    })
                        .select("_id")
                        .session(session),

                    MobileUser.countDocuments(
                        {}
                    ).session(session),

                    MobileUser.countDocuments({
                        hardwareId:
                            normalizedHardwareId,
                    }).session(session),
                ]);

                if (activeUserLock) {
                    throw createHttpError(
                        `Identity lock active. A variation of '${normalizedUsername}' is reserved by a Player.`,
                        403
                    );
                }

                if (activeClanLock) {
                    throw createHttpError(
                        `Identity lock active. A variation of '${normalizedUsername}' is reserved by a CLAN.`,
                        403
                    );
                }

                if (exactNameMatch) {
                    throw createHttpError(
                        "This exact username is already claimed by an active operator.",
                        409
                    );
                }

                transactionOutput
                    .hardwareAccountCount =
                    hardwareAccountCount;

                const finalDeviceId =
                    hardwareAccountCount > 0
                        ? `${deviceId}-ACC${hardwareAccountCount + 1}`
                        : deviceId;

                const cleanName =
                    normalizedUsername
                        .toUpperCase()
                        .replace(
                            /\s+/g,
                            "_"
                        );

                const generatedUid =
                    `ORE-${cleanName}-${generateSecureSuffix()}-DA`;

                const generatedReferralCode =
                    await createUniqueReferralCode({
                        username:
                            normalizedUsername,
                        session,
                    });

                const accessToken =
                    jwt.sign(
                        {
                            userId:
                                finalDeviceId,
                            uid:
                                generatedUid,
                            level: 1,
                        },
                        accessTokenSecret,
                        {
                            expiresIn:
                                "15m",
                        }
                    );

                const refreshToken =
                    jwt.sign(
                        {
                            uid:
                                generatedUid,
                        },
                        refreshTokenSecret,
                        {
                            expiresIn:
                                "90d",
                        }
                    );

                const normalizedReferralCode =
                    String(
                        referredBy || ""
                    )
                        .trim()
                        .toUpperCase();

                let referrer = null;

                if (normalizedReferralCode) {
                    referrer =
                        await MobileUser.findOne({
                            referralCode:
                                normalizedReferralCode,
                        }).session(session);

                    // Prevent same-device referrals.
                    if (
                        referrer
                        && referrer.hardwareId
                        === normalizedHardwareId
                    ) {
                        referrer = null;
                    }
                }

                const boostExpiry =
                    new Date(
                        now.getTime()
                        + 72
                        * 60
                        * 60
                        * 1000
                    );

                const [createdUser] =
                    await MobileUser.create(
                        [
                            {
                                uid:
                                    generatedUid,
                                deviceId:
                                    finalDeviceId,
                                hardwareId:
                                    normalizedHardwareId,

                                trustedDevices: [
                                    {
                                        hardwareId:
                                            normalizedHardwareId,
                                        deviceId:
                                            finalDeviceId,
                                        addedAt:
                                            now,
                                        lastActive:
                                            now,
                                    },
                                ],

                                activeSessionDeviceId:
                                    finalDeviceId,
                                username:
                                    normalizedUsername,
                                canonicalUsername,
                                pushToken:
                                    pushToken || null,
                                country:
                                    detectedCountry,
                                referralCode:
                                    generatedReferralCode,
                                referredBy:
                                    referrer
                                        ? normalizedReferralCode
                                        : null,
                                preferences,

                                character:
                                    character
                                    || {
                                        base: {
                                            gender:
                                                "male",
                                            skinTone:
                                                "medium",
                                            name:
                                                normalizedUsername,
                                        },
                                        equipped: {
                                            hair:
                                                "default_hair",
                                            top:
                                                "default_top",
                                            pant:
                                                "default_pant",
                                            shoe:
                                                "default_shoe",
                                            action:
                                                "idle",
                                        },
                                    },

                                wardrobe:
                                    defaultWardrobe,

                                coins: 20,

                                // Preserve the old referred-user bonus.
                                aura:
                                    referrer
                                        ? 20
                                        : 0,

                                weeklyAura:
                                    referrer
                                        ? 20
                                        : 0,

                                doubleStreakUntil:
                                    referrer
                                        ? boostExpiry
                                        : null,

                                lastActive:
                                    now,
                                totalPosts: 0,
                                unlockedTitles:
                                    [],
                                securityLevel: 1,
                                refreshToken,

                                // Explicit initialization for clarity.
                                gachaPityCounters:
                                    {},
                                eventPoints:
                                    {},
                                eventSpinTokens:
                                    {},
                                referralCampaigns:
                                    {},
                            },
                        ],
                        { session }
                    );

                if (referrer) {
                    referrer.invitedUsers =
                        Array.isArray(
                            referrer.invitedUsers
                        )
                            ? referrer.invitedUsers
                            : [];

                    referrer.invitedUsers.push({
                        userId:
                            createdUser._id,
                        username:
                            createdUser.username,
                        date: now,
                    });

                    referrer.referralCount =
                        (
                            Number(
                                referrer.referralCount
                            ) || 0
                        ) + 1;

                    referrer.weeklyAura =
                        (
                            Number(
                                referrer.weeklyAura
                            ) || 0
                        ) + 20;

                    referrer.coins =
                        (
                            Number(
                                referrer.coins
                            ) || 0
                        ) + 50;

                    if (
                        !referrer
                            .doubleStreakUntil
                        || new Date(
                            referrer
                                .doubleStreakUntil
                        ) < boostExpiry
                    ) {
                        referrer
                            .doubleStreakUntil =
                            boostExpiry;
                    }

                    referrer.eventSpinTokens =
                        toMap(
                            referrer
                                .eventSpinTokens
                        );

                    referrer.referralCampaigns =
                        toMap(
                            referrer
                                .referralCampaigns
                        );

                    for (
                        const campaign
                        of referralCampaigns
                    ) {
                        // Prevent a reward when the event expired while this
                        // registration request was being processed.
                        if (
                            !getSystemEventState(
                                campaign,
                                new Date()
                            ).isActive
                        ) {
                            continue;
                        }

                        const eventId =
                            campaign.id;

                        const progress =
                            readCampaignProgress(
                                referrer
                                    .referralCampaigns,
                                eventId
                            );

                        const reward =
                            getNextReferralSpinTokenReward(
                                campaign,
                                progress
                                    .rewardedReferralCount
                            );

                        const nextProgress = {
                            ...progress,
                            referralCount:
                                progress
                                    .referralCount
                                + 1,
                            lastReferralAt:
                                now,
                        };

                        if (reward.eligible) {
                            const currentBalance =
                                Number(
                                    referrer
                                        .eventSpinTokens
                                        .get(eventId)
                                ) || 0;

                            referrer
                                .eventSpinTokens
                                .set(
                                    eventId,
                                    currentBalance
                                    + reward
                                        .spinTokens
                                );

                            nextProgress
                                .rewardedReferralCount =
                                progress
                                    .rewardedReferralCount
                                + 1;

                            nextProgress
                                .spinTokensEarned =
                                progress
                                    .spinTokensEarned
                                + reward
                                    .spinTokens;

                            transactionOutput
                                .notifications
                                .push({
                                    pushToken:
                                        referrer
                                            .pushToken,
                                    title:
                                        `${campaign.tokenName || "Spin Tokens"} Earned!`,
                                    message:
                                        `${createdUser.username} completed referral milestone ${reward.milestone}. You earned ${reward.spinTokens} ${campaign.tokenName || "spin tokens"}.`,
                                    data: {
                                        type:
                                            "referral_spin_token_reward",
                                        eventId,
                                        spinTokens:
                                            String(
                                                reward
                                                    .spinTokens
                                            ),
                                    },
                                    pill: {
                                        type:
                                            "event",
                                        targetAudience:
                                            "user",
                                        targetId:
                                            referrer.uid
                                            || referrer.deviceId,
                                        singleUser:
                                            true,
                                        groupId:
                                            `referral:${eventId}`,
                                    },
                                });
                        }

                        referrer
                            .referralCampaigns
                            .set(
                                eventId,
                                nextProgress
                            );
                    }

                    const unlockedTitles =
                        Array.isArray(
                            referrer.unlockedTitles
                        )
                            ? referrer.unlockedTitles
                            : [];

                    const isEligibleForAlpha =
                        globalUserCount < 400;

                    if (
                        isEligibleForAlpha
                        && !unlockedTitles.some(
                            title =>
                                title.name
                                === "Alpha Lead"
                        )
                    ) {
                        unlockedTitles.push({
                            name:
                                "Alpha Lead",
                            tier: "EPIC",
                        });

                        transactionOutput
                            .notifications
                            .push({
                                pushToken:
                                    referrer
                                        .pushToken,
                                title:
                                    "Legendary Title Unlocked! 🏆",
                                message:
                                    "You've earned 'Alpha Lead' for expanding the network in its early stages!",
                                data: {
                                    type:
                                        "milestone_unlock",
                                },
                                pill: {
                                    type:
                                        "achievement",
                                    targetAudience:
                                        "user",
                                    targetId:
                                        referrer.uid
                                        || referrer.deviceId,
                                    singleUser:
                                        true,
                                    groupId:
                                        "title:alpha-lead",
                                },
                            });
                    }

                    if (
                        referrer.referralCount
                        >= 2
                        && !unlockedTitles.some(
                            title =>
                                title.name
                                === "The Recruiter"
                        )
                    ) {
                        unlockedTitles.push({
                            name:
                                "The Recruiter",
                            tier: "RARE",
                        });

                        transactionOutput
                            .notifications
                            .push({
                                pushToken:
                                    referrer
                                        .pushToken,
                                title:
                                    "Achievement Unlocked! 🎖",
                                message:
                                    "You've earned the title: 'The Recruiter'!",
                                data: {
                                    type:
                                        "milestone_unlock",
                                },
                                pill: {
                                    type:
                                        "achievement",
                                    targetAudience:
                                        "user",
                                    targetId:
                                        referrer.uid
                                        || referrer.deviceId,
                                    singleUser:
                                        true,
                                    groupId:
                                        "title:recruiter",
                                },
                            });
                    }

                    referrer.unlockedTitles =
                        unlockedTitles;

                    referrer.markModified(
                        "eventSpinTokens"
                    );

                    referrer.markModified(
                        "referralCampaigns"
                    );

                    await referrer.save({
                        session,
                    });

                    await ReferralEvent.create(
                        [
                            {
                                referrerId:
                                    referrer._id,
                                referredId:
                                    createdUser._id,
                                referredUsername:
                                    createdUser
                                        .username,
                                deviceId:
                                    normalizedHardwareId,
                                status:
                                    "verified",
                            },
                        ],
                        { session }
                    );

                    transactionOutput
                        .notifications
                        .unshift({
                            pushToken:
                                referrer.pushToken,
                            title:
                                "New Recruit Joined! 🌀",
                            message:
                                `${createdUser.username} joined using your referral link. Your permanent referral rewards are active.`,
                            data: {
                                type:
                                    "referral_success",
                                referredUserId:
                                    createdUser
                                        ._id
                                        .toString(),
                            },
                            pill: {
                                type:
                                    "system",
                                targetAudience:
                                    "user",
                                targetId:
                                    referrer.uid
                                    || referrer.deviceId,
                                singleUser:
                                    true,
                                groupId:
                                    "referrals",
                            },
                        });
                }

                transactionOutput.user =
                    createdUser;

                transactionOutput.accessToken =
                    accessToken;

                transactionOutput.refreshToken =
                    refreshToken;
            }
        );

        if (
            transactionOutput
                .hardwareAccountCount
            >= 5
        ) {
            try {
                await SecurityEvent.create({
                    eventType:
                        "HARDWARE_LIMIT_WARNING",
                    severity:
                        "moderate",
                    hardwareId:
                        normalizedHardwareId,
                    username:
                        normalizedUsername,
                    ipAddress:
                        requestIp,
                    message:
                        `[SECURITY] ${transactionOutput.hardwareAccountCount} accounts already share hardware fingerprint ${normalizedHardwareId}`,
                    metadata: {
                        associatedAccountsCount:
                            transactionOutput
                                .hardwareAccountCount,
                    },
                });
            } catch (securityError) {
                console.error(
                    "Security warning log failed:",
                    securityError
                );
            }
        }

        await sendNotifications(
            transactionOutput.notifications
        );

        const user =
            transactionOutput.user;

        return NextResponse.json(
            {
                message:
                    "Neural Link Established",
                accessToken:
                    transactionOutput
                        .accessToken,
                refreshToken:
                    transactionOutput
                        .refreshToken,
                user: {
                    uid:
                        user.uid,
                    username:
                        user.username,
                    deviceId:
                        user.deviceId,
                    securityLevel:
                        user.securityLevel,
                    preferences:
                        user.preferences,
                },
            },
            { status: 201 }
        );
    } catch (error) {
        console.error(
            "Registration Error:",
            error
        );

        if (error?.code === 11000) {
            return NextResponse.json(
                {
                    message:
                        "An account with these identity details already exists.",
                },
                { status: 409 }
            );
        }

        return NextResponse.json(
            {
                message:
                    error?.message
                    || "Uplink Error",
            },
            {
                status:
                    error?.statusCode
                    || 500,
            }
        );
    }
}

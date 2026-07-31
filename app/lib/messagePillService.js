import connectDB from "@/app/lib/mongodb";
import MessagePillModel from "../models/MessagePillModel";

const MAX_PILL_TEXT_LENGTH = 100;
const DEFAULT_PILL_EXPIRY_HOURS = 6;

const normalizeTokenList = (tokens) => {
    const tokenArray = Array.isArray(tokens)
        ? tokens
        : tokens
            ? [tokens]
            : [];

    return [
        ...new Set(
            tokenArray
                .map(token => String(token || "").trim())
                .filter(Boolean)
        ),
    ];
};

const truncatePillText = (text) => {
    const normalized = String(text || "").trim();

    if (normalized.length <= MAX_PILL_TEXT_LENGTH) {
        return normalized;
    }

    return `${normalized.slice(0, MAX_PILL_TEXT_LENGTH - 3)}...`;
};

const appendNavigationParams = (rawLink, data = {}) => {
    if (!rawLink) return null;

    try {
        const originalLink = String(rawLink);
        const isAbsolute = /^[a-z][a-z0-9+.-]*:\/\//i.test(originalLink);
        const url = new URL(
            originalLink,
            "https://oreblogda.local"
        );

        if (
            data.tab
            && !url.searchParams.has("tab")
        ) {
            url.searchParams.set("tab", String(data.tab));
        }

        if (
            data.commentId
            && !url.searchParams.has("commentId")
            && !url.searchParams.has("discussion")
            && !url.searchParams.has("discussionId")
        ) {
            url.searchParams.set(
                "commentId",
                String(data.commentId)
            );
        } else if (
            (data.discussionId || data.discussion)
            && !url.searchParams.has("discussion")
            && !url.searchParams.has("discussionId")
            && !url.searchParams.has("commentId")
        ) {
            url.searchParams.set(
                "discussion",
                String(
                    data.discussionId
                    || data.discussion
                )
            );
        } else if (
            data.comment
            && !url.searchParams.has("comment")
            && !url.searchParams.has("commentId")
            && !url.searchParams.has("discussion")
        ) {
            url.searchParams.set(
                "comment",
                String(data.comment)
            );
        }

        if (isAbsolute) {
            return url.toString();
        }

        return `${url.pathname}${url.search}${url.hash}`;
    } catch (error) {
        if (process.env.NODE_ENV !== "production") {
            console.warn(
                "Unable to append MessagePill navigation params:",
                error
            );
        }

        return String(rawLink);
    }
};

const extractAccumulatedAmount = (text) => {
    const match = String(text || "").match(/-?\d[\d,]*/);
    if (!match) return null;

    const amount = Number(
        match[0].replace(/,/g, "")
    );

    return Number.isFinite(amount)
        ? amount
        : null;
};

const createAccumulatedPill = async ({
    text,
    type,
    link,
    targetAudience,
    targetId,
    groupId,
    priority,
    expiresAt,
}) => {
    const filter = {
        targetAudience,
        targetId,
        type,
        groupId,
        isActive: true,
    };

    const existingPill = await MessagePillModel.findOne(
        filter
    );

    let finalText = text;

    if (existingPill) {
        const oldAmount =
            extractAccumulatedAmount(existingPill.text);
        const incomingAmount =
            extractAccumulatedAmount(text);

        if (
            oldAmount !== null
            && incomingAmount !== null
        ) {
            const totalAmount =
                oldAmount + incomingAmount;

            finalText =
                type === "aura_gain"
                    ? `+${totalAmount} Aura Gained.`
                    : `+${totalAmount} Clan Points Gained!`;
        }

        existingPill.text = finalText;
        existingPill.link = link;
        existingPill.priority = priority;
        existingPill.expiresAt = expiresAt;
        existingPill.isActive = true;

        return existingPill.save();
    }

    return MessagePillModel.create({
        text: finalText,
        type,
        link,
        targetAudience,
        targetId:
            targetAudience !== "global"
                ? targetId
                : null,
        groupId,
        priority,
        isActive: true,
        expiresAt,
    });
};

export async function createMessagePill({
    text,
    type = "system",
    link = null,
    targetAudience = "global",
    targetId = null,
    groupId = null,
    priority = 0,
    expiresInHours = null,
    replaceExistingType = false,
}) {
    try {
        await connectDB();

        const normalizedText = String(text || "").trim();

        if (!normalizedText) {
            return null;
        }

        if (
            targetAudience !== "global"
            && !targetId
        ) {
            console.warn(
                "MessagePill skipped because a non-global audience requires targetId.",
                {
                    type,
                    targetAudience,
                    groupId,
                }
            );
            return null;
        }

        const normalizedGroupId =
            groupId ? String(groupId) : "default";

        const expiresAt =
            Number(expiresInHours) > 0
                ? new Date(
                    Date.now()
                    + Number(expiresInHours)
                    * 60
                    * 60
                    * 1000
                )
                : null;

        const commonDocument = {
            text: normalizedText,
            type,
            link,
            targetAudience,
            targetId:
                targetAudience !== "global"
                    ? targetId
                    : null,
            groupId: normalizedGroupId,
            priority,
            isActive: true,
            expiresAt,
        };

        if (
            replaceExistingType
            && (
                type === "aura_gain"
                || type === "clan_points"
            )
        ) {
            return createAccumulatedPill({
                ...commonDocument,
            });
        }

        if (replaceExistingType) {
            return MessagePillModel.findOneAndUpdate(
                {
                    targetAudience,
                    targetId:
                        targetAudience !== "global"
                            ? targetId
                            : null,
                    type,
                    groupId: normalizedGroupId,
                },
                {
                    $set: commonDocument,
                },
                {
                    new: true,
                    upsert: true,
                    setDefaultsOnInsert: true,
                    runValidators: true,
                }
            );
        }

        return MessagePillModel.create(
            commonDocument
        );
    } catch (error) {
        console.error(
            "MessagePill Creation Service Error:",
            error
        );
        return null;
    }
}

export async function sendPillParallel(
    tokens,
    title,
    body,
    data = {},
    pillContext = {}
) {
    const uniqueTokens = normalizeTokenList(tokens);

    const {
        type = "system",
        targetId = null,
        link: explicitLink = null,
        targetAudience = "user",
        priority = 1,
        expiresInHours = DEFAULT_PILL_EXPIRY_HOURS,
        groupId: explicitGroupId = null,
        replaceExistingType = true,
    } = pillContext;

    const resolvedGroupId = String(
        explicitGroupId
        || data.groupId
        || data.conversationId
        || data.postId
        || data.clanTag
        || `${type}:${targetId || "default"}`
    );

    const generatedLink = appendNavigationParams(
        explicitLink || data.screen || null,
        data
    );

    const pillPromise =
        targetAudience === "global"
            || targetId
            ? createMessagePill({
                text: truncatePillText(body),
                type,
                link: generatedLink,
                groupId: resolvedGroupId,
                targetAudience,
                targetId,
                priority,
                expiresInHours,
                replaceExistingType,
            })
            : Promise.resolve(null);

    const pushPromise =
        uniqueTokens.length > 0
            ? import("@/app/lib/pushNotifications")
                .then(({
                    sendPushNotification,
                    sendMultiplePushNotifications,
                }) => (
                    uniqueTokens.length === 1
                        ? sendPushNotification(
                            uniqueTokens[0],
                            title,
                            body,
                            {
                                ...data,
                                groupId: resolvedGroupId,
                            },
                            resolvedGroupId
                        )
                        : sendMultiplePushNotifications(
                            uniqueTokens,
                            title,
                            body,
                            {
                                ...data,
                                groupId: resolvedGroupId,
                            },
                            resolvedGroupId
                        )
                ))
            : Promise.resolve([]);

    const [
        pillResult,
        pushResult,
    ] = await Promise.allSettled([
        pillPromise,
        pushPromise,
    ]);

    if (pillResult.status === "rejected") {
        console.error(
            "Parallel MessagePill creation failed:",
            pillResult.reason
        );
    }

    if (pushResult.status === "rejected") {
        console.error(
            "Parallel push delivery failed:",
            pushResult.reason
        );
    }

    return {
        pill:
            pillResult.status === "fulfilled"
                ? pillResult.value
                : null,
        push:
            pushResult.status === "fulfilled"
                ? pushResult.value
                : null,
        pillError:
            pillResult.status === "rejected"
                ? pillResult.reason
                : null,
        pushError:
            pushResult.status === "rejected"
                ? pushResult.reason
                : null,
    };
}
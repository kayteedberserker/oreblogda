import MobileUser from "@/app/models/MobileUserModel";
import {
    cert,
    getApp,
    getApps,
    initializeApp,
} from "firebase-admin/app";
import {
    getMessaging,
} from "firebase-admin/messaging";
import {
    buildNotifyKitPayload,
} from "react-native-notify-kit/server";

const EXPO_PUSH_URL =
    "https://exp.host/--/api/v2/push/send";
const EXPO_CHUNK_SIZE = 100;
const FCM_BATCH_SIZE = 500;
const DEFAULT_ANDROID_CHANNEL = "default";
const MESSAGE_ANDROID_CHANNEL = "messages";
const GENERAL_NOTIFICATION_GROUP_ID =
    "oreblogda.general.notifications";
const DEFAULT_SMALL_ICON = "notification_icon";
const DEFAULT_NOTIFICATION_COLOR = "#10B981";
const MAX_MESSAGING_TEXT_LENGTH = 1200;

const MESSAGING_TYPES = new Set([
    "clan_message",
    "clan_chat",
    "clan_hall",
    "discussion_message",
    "discussion_reply",
    "comment_reply",
    "direct_message",
    "message",
]);

let firebaseAdminApp = null;

const parseServiceAccount = () => {
    let raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!raw) {
        throw new Error(
            "Missing FIREBASE_SERVICE_ACCOUNT_JSON."
        );
    }

    raw = raw.trim();

    if (
        (raw.startsWith("'") && raw.endsWith("'"))
        || (raw.startsWith('"') && raw.endsWith('"'))
    ) {
        raw = raw.slice(1, -1);
    }

    let parsed;

    try {
        parsed = JSON.parse(raw);
    } catch (error) {
        throw new Error(
            `Unable to parse FIREBASE_SERVICE_ACCOUNT_JSON: ${error.message}`
        );
    }

    if (
        !parsed?.project_id
        || !parsed?.client_email
        || !parsed?.private_key
    ) {
        throw new Error(
            "Firebase service account is missing project_id, client_email, or private_key."
        );
    }

    return {
        ...parsed,
        private_key: parsed.private_key.replace(
            /\\n/g,
            "\n"
        ),
    };
};

const getFirebaseAdminApp = () => {
    if (firebaseAdminApp) return firebaseAdminApp;

    if (getApps().length > 0) {
        firebaseAdminApp = getApp();
        return firebaseAdminApp;
    }

    const serviceAccount = parseServiceAccount();

    firebaseAdminApp = initializeApp({
        credential: cert(serviceAccount),
        projectId:
            process.env.FIREBASE_PROJECT_ID
            || serviceAccount.project_id,
    });

    return firebaseAdminApp;
};

const getFirebaseMessaging = () =>
    getMessaging(getFirebaseAdminApp());

const isExpoPushToken = token =>
    typeof token === "string"
    && (
        token.startsWith("ExponentPushToken")
        || token.startsWith("ExpoPushToken")
    );

const stringifyDataValue = value => {
    if (typeof value === "string") return value;

    if (
        typeof value === "number"
        || typeof value === "boolean"
        || typeof value === "bigint"
    ) {
        return String(value);
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const sanitizeNotificationData = (
    data = {},
    groupId = null
) => {
    const sanitized = {};

    for (const [key, value] of Object.entries(data || {})) {
        if (
            value === null
            || value === undefined
            || key === "notifee_options"
            || key === "notifee_data"
        ) {
            continue;
        }

        sanitized[key] = stringifyDataValue(value);
    }

    if (groupId) {
        sanitized.groupId = String(groupId);
    }

    return sanitized;
};

const optimizeNotificationImage = rawUrl => {
    if (!rawUrl) return null;

    let url = String(rawUrl);
    const isVideo =
        /\.(mp4|mov|webm)(\?.*)?$/i.test(url);
    const cloudName =
        process.env.CLOUDINARY_CLOUD_NAME
        || "donakg9he";

    if (
        url.includes("cloudinary.com")
        && url.includes("/upload/")
    ) {
        if (isVideo) {
            url = url.replace(
                /\.(mp4|mov|webm)(\?.*)?$/i,
                ".jpg"
            );
        }

        return url.replace(
            "/upload/",
            "/upload/w_600,q_auto,f_jpg/"
        );
    }

    if (url.includes("oreblogda.com")) {
        if (isVideo) {
            return `https://res.cloudinary.com/${cloudName}/video/fetch/f_jpg,q_auto,so_auto,c_pad,b_black,w_600/${encodeURIComponent(url)}`;
        }

        return `https://res.cloudinary.com/${cloudName}/image/fetch/w_600,q_auto,f_jpg/${encodeURIComponent(url)}`;
    }

    return url;
};

const getNotificationType = data =>
    String(
        data?.notificationType
        || data?.type
        || data?.presentation
        || ""
    ).toLowerCase();

const isMessagingNotification = data => {
    const presentation = String(
        data?.presentation
        || data?.notificationPresentation
        || ""
    ).toLowerCase();

    return (
        presentation === "messaging"
        || MESSAGING_TYPES.has(getNotificationType(data))
    );
};

const normalizeRecentMessages = (
    rawMessages,
    {
        message,
        senderName,
        senderId,
        senderAvatar,
        sentAt,
    }
) => {
    let parsedMessages = rawMessages;

    if (typeof rawMessages === "string") {
        try {
            parsedMessages = JSON.parse(rawMessages);
        } catch {
            parsedMessages = [];
        }
    }

    const messages = Array.isArray(parsedMessages)
        ? parsedMessages
        : [];

    const normalized = messages
        .slice(-5)
        .map(item => ({
            text: String(
                item?.text
                || item?.body
                || ""
            ).slice(0, 500),
            timestamp: Number(
                item?.timestamp
                || item?.sentAt
                || item?.date
                || Date.now()
            ),
            person: {
                name: String(
                    item?.person?.name
                    || item?.senderName
                    || senderName
                    || "Oreblogda User"
                ),
                id: String(
                    item?.person?.id
                    || item?.senderId
                    || senderId
                    || item?.person?.name
                    || senderName
                    || "remote"
                ),
                icon:
                    item?.person?.icon
                    || item?.senderAvatar
                    || senderAvatar
                    || undefined,
            },
        }))
        .filter(item => item.text);

    if (normalized.length === 0) {
        normalized.push({
            text: String(message || "").slice(0, 500),
            timestamp: Number(sentAt || Date.now()),
            person: {
                name: String(
                    senderName
                    || "Oreblogda User"
                ),
                id: String(
                    senderId
                    || senderName
                    || "remote"
                ),
                icon: senderAvatar || undefined,
            },
        });
    }

    return normalized;
};

const buildNativeNotification = ({
    token,
    title,
    message,
    data = {},
    groupId = null,
}) => {
    const messagingNotification =
        isMessagingNotification(data);

    /*
     * Generic notifications all belong to one Oreblogda group. Messaging
     * notifications use their conversation ID instead and are intentionally
     * excluded from the global application group.
     */
    const resolvedGenericGroupId =
        messagingNotification
            ? null
            : String(
                data?.groupId
                || groupId
                || GENERAL_NOTIFICATION_GROUP_ID
            );

    const sanitizedData =
        sanitizeNotificationData(
            data,
            resolvedGenericGroupId
        );

    const type =
        getNotificationType(data) || "general";

    const conversationId = String(
        data?.conversationId
        || data?.clanTag
        || data?.postId
        || groupId
        || "oreblogda"
    );

    const notificationId = String(
        data?.notificationId
        || (
            messagingNotification
                ? `message:${conversationId}`
                : `${type}:${data?.postId || data?.id || Date.now()}`
        )
    );

    const senderName = String(
        data?.senderName
        || data?.authorName
        || title
        || "Oreblogda"
    ).slice(0, 80);

    const senderId = String(
        data?.senderId
        || data?.authorId
        || senderName
    );

    const senderAvatar =
        data?.senderAvatar
        || data?.authorPfp
        || null;

    const messagingText = String(
        data?.messageText
        || data?.text
        || message
        || ""
    ).slice(0, MAX_MESSAGING_TEXT_LENGTH);

    const contentImage = optimizeNotificationImage(
        data?.mediaUrl
        || data?.imageUrl
    );

    const optimizedSenderAvatar =
        optimizeNotificationImage(senderAvatar);

    if (messagingNotification) {
        delete sanitizedData.notificationType;
        delete sanitizedData.authorPfp;
        delete sanitizedData.senderAvatar;
        delete sanitizedData.recentMessages;
        delete sanitizedData.currentPersonName;
        delete sanitizedData.currentPersonId;
        delete sanitizedData.currentPersonIcon;
        delete sanitizedData.groupId;
        delete sanitizedData.mediaUrl;
        delete sanitizedData.imageUrl;

        sanitizedData.presentation = "messaging";
        sanitizedData.notificationId =
            notificationId;
        sanitizedData.conversationId =
            conversationId;
        sanitizedData.conversationTitle = String(
            data?.conversationTitle
            || data?.clanName
            || data?.discussionTitle
            || title
            || senderName
        ).slice(0, 120);
        sanitizedData.senderName = senderName;
        sanitizedData.senderId = senderId;
        sanitizedData.messageText =
            messagingText;
        sanitizedData.sentAt = String(
            data?.sentAt || Date.now()
        );
        sanitizedData.isGroupConversation =
            String(
                data?.isGroupConversation
                ?? type.includes("clan")
            );
    }

    const android = {
        channelId: messagingNotification
            ? MESSAGE_ANDROID_CHANNEL
            : (
                data?.channelId
                || DEFAULT_ANDROID_CHANNEL
            ),
        smallIcon:
            data?.smallIcon
            || DEFAULT_SMALL_ICON,
        largeIcon:
            optimizedSenderAvatar
            || undefined,
        color:
            data?.color
            || DEFAULT_NOTIFICATION_COLOR,
        groupId:
            messagingNotification
                ? undefined
                : resolvedGenericGroupId,
        pressAction: {
            id: "default",
            launchActivity: "default",
        },
    };

    if (
        !messagingNotification
        && contentImage
    ) {
        android.style = {
            type: "BIG_PICTURE",
            picture: contentImage,
        };
    }

    const iosAttachments =
        contentImage
            && /^https:\/\//i.test(contentImage)
            ? [{ url: contentImage }]
            : undefined;

    const payload = buildNotifyKitPayload({
        token,
        notification: {
            id: notificationId,
            title: String(
                title || "Oreblogda"
            ).slice(0, 120),
            body: String(
                message || messagingText || ""
            ).slice(0, 500),
            data: sanitizedData,
            android,
            ios: {
                sound: "default",
                threadId:
                    messagingNotification
                        ? (
                            groupId
                            || conversationId
                            || "oreblogda.messages"
                        )
                        : resolvedGenericGroupId,
                attachments:
                    iosAttachments,
            },
        },
        options: {
            androidPriority: "high",
            ttl: messagingNotification
                ? 86400
                : 3600,
            collapseKey:
                !messagingNotification
                    && data?.collapseKey
                    ? String(
                        data.collapseKey
                    )
                    : undefined,
        },
    });

    if (messagingNotification) {
        if (payload?.android) {
            delete payload.android.collapseKey;
            delete payload.android.collapse_key;
        }

        if (payload?.apns?.headers) {
            delete payload.apns.headers[
                "apns-collapse-id"
            ];
        }
    }

    return payload;
};

const isDeadFcmTokenError = error => {
    const code = String(error?.code || "");

    return (
        code === "messaging/registration-token-not-registered"
        || code === "messaging/invalid-registration-token"
        || (
            code === "messaging/invalid-argument"
            && /token|registration/i.test(
                String(error?.message || "")
            )
        )
    );
};

const removeDeadTokens = async tokens => {
    const uniqueTokens = [
        ...new Set(tokens.filter(Boolean)),
    ];

    if (uniqueTokens.length === 0) return;

    try {
        await MobileUser.updateMany(
            {
                pushToken: {
                    $in: uniqueTokens,
                },
            },
            {
                $set: {
                    pushToken: null,
                },
            }
        );
    } catch (error) {
        console.error(
            "Failed to remove dead push tokens:",
            error
        );
    }
};

const sendNativeNotification = async (
    token,
    title,
    message,
    data,
    groupId
) => {
    try {
        const payload = buildNativeNotification({
            token,
            title,
            message,
            data,
            groupId,
        });

        return await getFirebaseMessaging().send(
            payload
        );
    } catch (error) {
        if (isDeadFcmTokenError(error)) {
            await removeDeadTokens([token]);
        } else {
            console.error(
                "Native Firebase notification failed:",
                error
            );
        }

        return null;
    }
};

const sendExpoNotification = async (
    token,
    title,
    message,
    data,
    groupId
) => {
    const resolvedGroupId =
        groupId
        || data?.groupId
        || GENERAL_NOTIFICATION_GROUP_ID;

    const payload = {
        to: token,
        sound: "default",
        title,
        body: message,
        data: {
            ...(data || {}),
            groupId: resolvedGroupId,
        },
        threadIdentifier:
            resolvedGroupId,
        mutableContent: true,
    };

    try {
        const response = await fetch(
            EXPO_PUSH_URL,
            {
                method: "POST",
                headers: {
                    Accept: "application/json",
                    "Accept-Encoding":
                        "gzip, deflate",
                    "Content-Type":
                        "application/json",
                },
                body: JSON.stringify(payload),
            }
        );

        const result = await response.json();
        const ticket = result?.data;

        if (
            ticket?.status === "error"
            && ticket?.details?.error
            === "DeviceNotRegistered"
        ) {
            await removeDeadTokens([token]);
        }

        return result;
    } catch (error) {
        console.error(
            "Single Expo push failed:",
            error
        );
        return null;
    }
};

/**
 * Sends one push notification.
 *
 * Native Firebase tokens use NotifyKit FCM Mode.
 * Existing Expo tokens remain supported for older app versions.
 */
export async function sendPushNotification(
    token,
    title,
    message,
    data = {},
    groupId = null
) {
    if (!token) return null;

    if (isExpoPushToken(token)) {
        return sendExpoNotification(
            token,
            title,
            message,
            data,
            groupId
        );
    }

    return sendNativeNotification(
        token,
        title,
        message,
        data,
        groupId
    );
}

const chunkArray = (items, chunkSize) => {
    const chunks = [];

    for (
        let index = 0;
        index < items.length;
        index += chunkSize
    ) {
        chunks.push(
            items.slice(index, index + chunkSize)
        );
    }

    return chunks;
};

const sendNativeBatch = async (
    tokens,
    title,
    message,
    data,
    groupId
) => {
    const chunks = chunkArray(
        tokens,
        FCM_BATCH_SIZE
    );

    const results = [];

    for (const chunk of chunks) {
        const payloads = chunk.map(token =>
            buildNativeNotification({
                token,
                title,
                message,
                data,
                groupId,
            })
        );

        try {
            const response =
                await getFirebaseMessaging().sendEach(
                    payloads
                );

            const deadTokens = [];

            response.responses.forEach(
                (item, index) => {
                    if (
                        !item.success
                        && isDeadFcmTokenError(item.error)
                    ) {
                        deadTokens.push(chunk[index]);
                    }
                }
            );

            await removeDeadTokens(deadTokens);
            results.push(response);
        } catch (error) {
            console.error(
                "Firebase batch push failed:",
                error
            );
            results.push(null);
        }
    }

    return results;
};

const sendExpoBatch = async (
    tokens,
    title,
    message,
    data,
    groupId
) => {
    const chunks = chunkArray(
        tokens,
        EXPO_CHUNK_SIZE
    );

    const results = [];

    const resolvedGroupId =
        groupId
        || data?.groupId
        || GENERAL_NOTIFICATION_GROUP_ID;

    for (const chunk of chunks) {
        const messages = chunk.map(token => ({
            to: token,
            sound: "default",
            title,
            body: message,
            data: {
                ...(data || {}),
                groupId: resolvedGroupId,
            },
            threadIdentifier:
                resolvedGroupId,
            mutableContent: true,
        }));

        try {
            const response = await fetch(
                EXPO_PUSH_URL,
                {
                    method: "POST",
                    headers: {
                        Accept: "application/json",
                        "Accept-Encoding":
                            "gzip, deflate",
                        "Content-Type":
                            "application/json",
                    },
                    body: JSON.stringify(messages),
                }
            );

            const result = await response.json();
            const tickets = Array.isArray(result?.data)
                ? result.data
                : [];

            const deadTokens = tickets
                .map((ticket, index) =>
                    ticket?.status === "error"
                        && ticket?.details?.error
                        === "DeviceNotRegistered"
                        ? chunk[index]
                        : null
                )
                .filter(Boolean);

            await removeDeadTokens(deadTokens);
            results.push(result);
        } catch (error) {
            console.error(
                "Expo batch push failed:",
                error
            );
            results.push(null);
        }
    }

    return results;
};

/**
 * Sends notifications through Firebase for current app versions and through
 * Expo Push only for users whose stored token is still an Expo token.
 */
export async function sendMultiplePushNotifications(
    tokens,
    title,
    message,
    data = {},
    groupId = null
) {
    const uniqueTokens = [
        ...new Set(
            (tokens || []).filter(Boolean)
        ),
    ];

    if (uniqueTokens.length === 0) {
        return [];
    }

    const expoTokens = [];
    const firebaseTokens = [];

    uniqueTokens.forEach(token => {
        if (isExpoPushToken(token)) {
            expoTokens.push(token);
        } else {
            firebaseTokens.push(token);
        }
    });

    const [
        firebaseResults,
        expoResults,
    ] = await Promise.all([
        firebaseTokens.length > 0
            ? sendNativeBatch(
                firebaseTokens,
                title,
                message,
                data,
                groupId
            )
            : Promise.resolve([]),
        expoTokens.length > 0
            ? sendExpoBatch(
                expoTokens,
                title,
                message,
                data,
                groupId
            )
            : Promise.resolve([]),
    ]);

    return [
        ...firebaseResults,
        ...expoResults,
    ];
}
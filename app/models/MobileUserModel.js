import { google } from 'googleapis'; // Used to dynamically sign your FCM HTTP v1 requests safely
// Alternatively, if you use the Firebase Admin SDK directly:
// import admin from 'firebase-admin';

// 🌟 NEW IMPORT: Import your user model to handle database cleanups
import MobileUser from "@/app/models/MobileUserModel"; // Adjust this path to match your project structure

/**
 * Helper to acquire the OAuth2 access token dynamically from your server environment credentials
 * Required for Firebase HTTP v1 API endpoints.
 */
async function getgetFcmAccessToken() {
    let envJsonString = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!envJsonString) {
        throw new Error("❌ Missing FIREBASE_SERVICE_ACCOUNT_JSON configuration on environment variables.");
    }

    // Clean the string: Remove leading/trailing single or double quotes if the environment parser left them.
    if ((envJsonString.startsWith("'") && envJsonString.endsWith("'")) ||
        (envJsonString.startsWith('"') && envJsonString.endsWith('"'))) {
        envJsonString = envJsonString.slice(1, -1);
    }

    let key;
    try {
        key = JSON.parse(envJsonString);
    } catch (parseError) {
        throw new Error(`❌ JSON Parse Error: ${parseError.message} \n ⚠️ Check your .env formatting. String received: ${envJsonString.substring(0, 50)}...`);
    }

    // CRITICAL GUARD: Ensure the keys actually exist in the parsed object
    if (!key || !key.private_key || !key.client_email) {
        throw new Error(`❌ Extracted JSON is missing required fields. Found keys: ${Object.keys(key || {}).join(', ')}`);
    }

    // Force exact newline formatting for the certificate
    let privateKey = key.private_key;
    if (privateKey.includes('\\n')) {
        privateKey = privateKey.replace(/\\n/g, '\n');
    }

    // 🌟 FIX: Use the Object Configuration pattern instead of positional arguments
    const jwtClient = new google.auth.JWT({
        email: key.client_email,
        key: privateKey,
        scopes: ['https://www.googleapis.com/auth/cloud-platform']
    });

    try {
        const tokens = await jwtClient.authorize();
        return tokens.access_token;
    } catch (authError) {
        console.error("❌ Google JWT Authorization Failed:", authError.message);
        throw authError;
    }
}

/**
 * Sends a raw direct payload to Google's FCM v1 endpoint
 */
async function sendDirectToFcmV1(token, title, message, data, groupId) {
    try {
        const accessToken = await getgetFcmAccessToken();
        const projectId = process.env.FIREBASE_PROJECT_ID || "oreblogda-production"; // Update with your actual Firebase project ID

        // 🌟 SANITIZER FIX: FCM strictly requires every value in the data object to be a string. 
        const sanitizedData = {};
        if (groupId) sanitizedData.groupId = String(groupId);

        if (data) {
            for (const [key, value] of Object.entries(data)) {
                // Ignore nulls and undefineds to prevent crash, force everything else to string
                if (value !== null && value !== undefined) {
                    sanitizedData[key] = String(value);
                }
            }
        }

        // 🌟 NATIVE FALLBACK & OPTIMIZER (UPDATED FOR CLOUDFLARE R2)
        // The OS can only show ONE image in the background. We prioritize mediaUrl, fallback to authorPfp.
        let nativeExpandableImage = data.mediaUrl || data.authorPfp;

        if (nativeExpandableImage) {
            const isVideo = /\.(mp4|mov|webm)(\?.*)?$/i.test(nativeExpandableImage);
            const cloudName = process.env.CLOUDINARY_CLOUD_NAME || "donakg9he";

            // 1. Handle Legacy Direct Cloudinary URLs
            if (nativeExpandableImage.includes('cloudinary.com') && nativeExpandableImage.includes('/upload/')) {
                if (isVideo) {
                    nativeExpandableImage = nativeExpandableImage.replace(/\.(mp4|mov|webm)(\?.*)?$/i, '.jpg');
                }
                nativeExpandableImage = nativeExpandableImage.replace('/upload/', '/upload/w_600,q_auto,f_jpg/');
            }
            // 2. Handle New Cloudflare R2 URLs (The Fetch Trick)
            else if (nativeExpandableImage.includes('oreblogda.com')) {
                if (isVideo) {
                    // Tell Cloudinary to fetch the R2 video, extract a frame, shrink it to 600px, and serve it as a fast JPG
                    nativeExpandableImage = `https://res.cloudinary.com/${cloudName}/video/fetch/f_jpg,q_auto,so_auto,c_pad,b_black,w_600/${encodeURIComponent(nativeExpandableImage)}`;
                } else {
                    // Tell Cloudinary to fetch the R2 image, shrink it to 600px, and compress it so the Android OS downloads it instantly
                    nativeExpandableImage = `https://res.cloudinary.com/${cloudName}/image/fetch/w_600,q_auto,f_jpg/${encodeURIComponent(nativeExpandableImage)}`;
                }
            }
        }

        const payload = {
            message: {
                token: token,
                notification: {
                    title: title,
                    body: message
                },
                android: {
                    priority: "high",
                    notification: {
                        // Natively binds the compressed image or author PFP so it expands instantly
                        image: nativeExpandableImage || undefined,
                        sound: "default"
                    }
                },
                data: sanitizedData // 🌟 Hand over the clean, string-only object to Notifee
            }
        };

        const response = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok) {
            console.error("FCM Error:", JSON.stringify(result, null, 2));

            // 🌟 AUTO-CLEANUP: Check if the token is unregistered
            const isUnregistered = result.error?.status === "NOT_FOUND" ||
                (result.error?.details && result.error.details.some(d => d.errorCode === "UNREGISTERED"));

            if (isUnregistered) {
                console.log(`[FCM Cleanup] Removing unregistered token from database: ${token}`);
                try {
                    await MobileUser.updateMany(
                        { pushToken: token },
                        { $set: { pushToken: null } }
                    );
                } catch (dbError) {
                    console.error("❌ Failed to remove dead token from DB:", dbError);
                }
            }

            return null;
        }
        return result;
    } catch (error) {
        console.error("❌ Direct FCM Custom Router Fatal Error:", error);
        return null;
    }
}

/**
 * Sends a single push notification with Dual Token Routing, Grouping & Rich Media support
 * @param {string} token - The original token passed in (ignored due to hardcoded test)
 * @param {string} title - The notification title
 * @param {string} message - The notification body
 * @param {object} data - Extra data (screen, postId, 🌟 mediaUrl, authorPfp)
 * @param {string} groupId - (Optional) Use a unique ID to group notifications together
 */
export async function sendPushNotification(token, title, message, data = {}, groupId = null) {
    const pushToken = token;
    if (!pushToken) {
        return null;
    }
    // ⚡️ ARCHITECTURAL ROUTER: Handle Native FCM tokens directly
    if (!pushToken.startsWith('ExponentPushToken')) {
        return await sendDirectToFcmV1(pushToken, title, message, data, groupId);
    }
    const payload = {
        to: pushToken,
        sound: 'default',
        title: title,
        body: message,
        data: {
            ...data,
            groupId: groupId,
        },
        threadIdentifier: groupId || 'default_group',
        mutableContent: true,
    };

    try {
        const response = await fetch('https://exp.host/--/api/v2/push/send', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Accept-encoding': 'gzip, deflate',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        // 🌟 EXPO AUTO-CLEANUP: Handle unregistered Expo tokens
        if (result.data && result.data.status === 'error' && result.data.details?.error === 'DeviceNotRegistered') {
            console.log(`[Expo Cleanup] Removing unregistered token from database: ${pushToken}`);
            try {
                await MobileUser.updateMany(
                    { pushToken: pushToken },
                    { $set: { pushToken: null } }
                );
            } catch (dbError) {
                console.error("❌ Failed to remove dead Expo token from DB:", dbError);
            }
        }

        return result;
    } catch (error) {
        console.error("❌ Single Expo Push Error:", error);
    }
}

/**
 * Sends notifications to multiple tokens with dynamic path grouping
 */
export async function sendMultiplePushNotifications(tokens, title, message, data = {}, groupId = null) {
    if (!tokens || tokens.length === 0) return [];

    // Sort tokens out into different priority arrays to process concurrently
    const expoTokens = [];
    const fcmTokens = [];

    tokens.forEach(token => {
        if (token && token.startsWith('ExponentPushToken')) {
            expoTokens.push(token);
        } else if (token) {
            fcmTokens.push(token);
        }
    });

    const broadcastPromises = [];

    // 1. Process Native FCM batch chunks concurrently
    if (fcmTokens.length > 0) {
        fcmTokens.forEach(fcmToken => {
            broadcastPromises.push(sendDirectToFcmV1(fcmToken, title, message, data, groupId));
        });
    }

    // 2. Process Expo standard batch arrays
    if (expoTokens.length > 0) {
        const CHUNK_SIZE = 100;
        const chunks = [];

        for (let i = 0; i < expoTokens.length; i += CHUNK_SIZE) {
            chunks.push(expoTokens.slice(i, i + CHUNK_SIZE));
        }

        const expoPromises = chunks.map(async (chunk, index) => {
            const messages = chunk.map(token => ({
                to: token,
                sound: "default",
                title: title,
                body: message,
                data: {
                    ...data,
                    groupId: groupId,
                },
                threadId: groupId || 'broadcast_group',
                mutableContent: true,
            }));

            try {
                const response = await fetch('https://exp.host/--/api/v2/push/send', {
                    method: 'POST',
                    headers: {
                        'Accept': 'application/json',
                        'Accept-encoding': 'gzip, deflate',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(messages),
                });
                const result = await response.json();

                // 🌟 EXPO BATCH AUTO-CLEANUP: Find all failed tokens in the chunk response
                if (result.data && Array.isArray(result.data)) {
                    const deadTokens = [];
                    result.data.forEach((ticket, idx) => {
                        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
                            deadTokens.push(messages[idx].to);
                        }
                    });

                    if (deadTokens.length > 0) {
                        console.log(`[Expo Batch Cleanup] Removing ${deadTokens.length} unregistered tokens from database.`);
                        try {
                            await MobileUser.updateMany(
                                { pushToken: { $in: deadTokens } },
                                { $set: { pushToken: null } }
                            );
                        } catch (dbError) {
                            console.error("❌ Failed to batch remove dead Expo tokens from DB:", dbError);
                        }
                    }
                }

                return result;
            } catch (error) {
                console.error(`❌ Expo Chunk ${index + 1} Push Error:`, error);
                return null;
            }
        });

        broadcastPromises.push(...expoPromises);
    }

    const outputSummaryResults = await Promise.all(broadcastPromises);
    return outputSummaryResults;
}
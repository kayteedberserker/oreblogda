import connectDB from "@/app/lib/mongodb";
import MessagePillModel from "../models/MessagePillModel";

export async function createMessagePill({
    text,
    type = 'system',
    link = null,
    targetAudience = 'global',
    targetId = null,
    groupId = null,
    priority = 0,
    expiresInHours = null,
    replaceExistingType = false
}) {
    // console.log("the link inside cmpill is: ", link);

    try {
        await connectDB();

        let expiresAt = null;
        if (expiresInHours) {
            expiresAt = new Date(Date.now() + (expiresInHours * 60 * 60 * 1000));
        }

        let finalText = text;

        // ⚡️ PER-POST/GROUP ANTI-STACKING: composite key type_targetId_groupId
        if (replaceExistingType && targetId) {
            const uniqueKey = `${type}_${targetAudience}_${targetId}_${groupId || 'default'}`;

            // Accumulators still work as before
            if (type === 'aura_gain' || type === 'clan_points') {
                const existingPill = await MessagePillModel.findOne({
                    targetAudience, targetId, type
                });
                if (existingPill) {
                    const oldMatch = existingPill.text.match(/\d+/);
                    const newMatch = text.match(/\d+/);
                    if (oldMatch && newMatch) {
                        const oldAmount = parseInt(oldMatch[0], 10);
                        // Change 'const newMatch' to 'const newAmount'
                        const newAmount = parseInt(newMatch[0], 10);

                        // Now this calculation works perfectly
                        const totalAmount = oldAmount + newAmount;

                        finalText = type === 'aura_gain'
                            ? `+${totalAmount} Aura Gained.`
                            : `+${totalAmount} Clan Points Gained!`;
                    }
                    await MessagePillModel.deleteOne({ _id: existingPill._id });
                }
            } else {
                // Replace same post/group only
                await MessagePillModel.deleteMany({
                    targetAudience,
                    targetId,
                    type,
                    groupId
                });
            }
        }

        const newPill = await MessagePillModel.create({
            text: finalText,
            type,
            link,
            targetAudience,
            targetId: targetAudience !== 'global' ? targetId : null,
            groupId,
            priority,
            isActive: true,
            expiresAt
        });

        return newPill;
    } catch (err) {
        console.error("MessagePill Creation Service Error:", err);
        return null;
    }
}

/**
 * Sends push + parallel MessagePill for user/clan sync
 * @param {string[]} tokens - Expo tokens (determines audience)
 * @param {string} title - Push title  
 * @param {string} body - Pill text base
 * @param {object} data - Push data (screen, postId, 🌟 mediaUrl)
 * @param {object} pillContext - {type, targetId, link, singleUser?}
 */
export async function sendPillParallel(tokens, title, body, data = {}, pillContext = {}) {
    if (!tokens || tokens.length === 0) return;

    // ⚡️ FIX 1: Construct a URL string that actually includes the query parameters
    let generatedLink = data.screen ? data.screen : pillContext.link;

    // Append the relevant IDs to the URL so the Marquee can use useLocalSearchParams
    if (generatedLink) {
        if (data.commentId) generatedLink += `?commentId=${data.commentId}`;
        else if (data.discussion) generatedLink += `?discussion=${data.discussion}`;
        else if (data.comment) generatedLink += `?comment=${data.comment}`;
    }

    const {
        type = 'system',
        targetId,
        link = generatedLink, // <-- Use the newly constructed link
        targetAudience = 'user',
        singleUser = false,
        priority = 1,
        expiresInHours = 6
    } = pillContext;

    // Determine audience from tokens/targetId
    const audience = targetAudience;
    const pillTarget = singleUser ? targetId : (tokens.length === 1 ? tokens[0].split('[')[1]?.split(']')[0] : targetId); // Crude token parse fallback

    const pillText = body.length > 100 ? `${body.substring(0, 97)}...` : body;

    // 🌟 Push Execution (If data contains { mediaUrl: "..." }, it's securely handed off here)
    const pushPromise = import('@/app/lib/pushNotifications').then(({ sendPushNotification, sendMultiplePushNotifications }) => {
        return tokens.length === 1
            ? sendPushNotification(tokens[0], title, body, data, data.postId || data.clanTag) // Injected groupId logic
            : sendMultiplePushNotifications(tokens, title, body, data, data.postId || data.clanTag);
    });

    // Parallel pill
    await createMessagePill({
        text: pillText,
        type,
        link: generatedLink,
        groupId: data.postId || data.clanTag || 'default',
        targetAudience: audience,
        targetId: pillTarget,
        priority,
        expiresInHours,
        replaceExistingType: true
    });

    // Await push for logging
    await pushPromise;
}

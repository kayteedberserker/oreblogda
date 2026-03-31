import { calculateAuraRank } from "@/app/lib/auraRankEngine";
import { createMessagePill } from "@/app/lib/messagePillService";
import { sendPushNotification } from "@/app/lib/pushNotifications";
import MobileUser from "@/app/models/MobileUserModel";
import Notification from "@/app/models/NotificationModel";

/**
 * Centralized engine to award Aura, check for Rank Ups, and trigger the correct UI/Push feedback.
 */
export async function awardAura(userId, amount) {
    try {
        const user = await MobileUser.findById(userId);
        if (!user) return null;

        // 1. Calculate what their rank IS currently
        const oldRank = calculateAuraRank(user.aura);

        // 2. Add the new Aura
        user.aura += amount;
        user.weeklyAura += amount;

        // 3. Calculate what their rank is NOW
        const newRank = calculateAuraRank(user.aura);
        let didRankUp = false;

        // 4. Check if they leveled up
        if (newRank.level > oldRank.level) {
            didRankUp = true;
            user.currentRankLevel = newRank.level; // Save to schema
        }

        await user.save();

        // 5. ⚡️ THE FEEDBACK ENGINE ⚡️
        if (didRankUp) {
            // A. Send High-Priority Achievement Pill
            // ⚡️ UPDATED: Hype Anime Theming
            await createMessagePill({
                text: `LIMIT BREAK! YOU HAVE AWAKENED AS A ${newRank.title} ${newRank.icon}`,
                type: 'achievement',
                targetAudience: 'user',
                link: "/profile",
                targetId: user._id.toString(),
                priority: 10,
                expiresInHours: 24,
                replaceExistingType: false
            });

            // B. Send Push Notification for Retention
            if (user.pushToken && typeof sendPushNotification === 'function') {
                await sendPushNotification(
                    user.pushToken,
                    "Rank Ascended 👑",
                    `Limit Break! You have awakened as a ${newRank.title}. The system acknowledges your power.`,
                    { type: 'rank_up' }
                );
            }

            // C. Create In-App Notification Record
            await Notification.create({
                recipientId: user.deviceId,
                senderName: "THE SYSTEM",
                type: "system",
                message: `You ascended to ${newRank.title}.`
            });

        } else {
            // If they DID NOT rank up, calculate how much they need for the NEXT rank
            const auraNeeded = newRank.nextReq - user.aura;
            let flavorText = "";

            // ⚡️ Add different flavor text depending on how close they are
            if (auraNeeded <= 50) {
                flavorText = `SO CLOSE! ONLY ${auraNeeded} AURA UNTIL YOUR NEXT AWAKENING.`;
            } else if (auraNeeded <= 200) {
                flavorText = `${auraNeeded} AURA REMAINING TO REACH THE NEXT TIER.`;
            } else {
                flavorText = `FARM ${auraNeeded} MORE AURA TO RANK UP.`;
            }

            // ⚡️ Send the accumulating pill with the dynamic flavor text
            await createMessagePill({
                text: `+${amount} Aura Gained. ${flavorText}`,
                type: 'aura_gain',
                targetAudience: 'user',
                targetId: user._id.toString(),
                link: "/profile",
                priority: 2,
                expiresInHours: 24,
                replaceExistingType: true
            });
        }

        return { user, didRankUp, newRank };

    } catch (err) {
        console.error("Aura Manager Error:", err);
        return null;
    }
}
import MobileUser from "../models/MobileUser";
import UserStreak from "../models/UserStreak";

/**
 * Updates a user's daily posting streak using the separate UserStreak document.
 * @param {string} deviceId - The user's device ID
 * @returns {Promise<{streak: number, lastPostDate: string}>}
 */
export async function updateUserStreak(deviceId) {
  if (!deviceId) throw new Error("Device ID is required");

  // 1️⃣ Find the user
  const user = await MobileUser.findOne({ deviceId });
  if (!user) throw new Error("User not found");

  // 2️⃣ Find or create the user's streak document
  let streakDoc = await UserStreak.findOne({ userId: user._id });
  const now = new Date();

  if (!streakDoc) {
    // No streak exists yet → create one
    streakDoc = await UserStreak.create({
      userId: user._id,
      streak: 1,
      lastPostDate: now,
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000), // 24h later
    });
    return { streak: streakDoc.streak, lastPostDate: streakDoc.lastPostDate.toISOString().split("T")[0] };
  }

  // 3️⃣ Check if already posted today
  const lastPostDateStr = streakDoc.lastPostDate.toISOString().split("T")[0];
  const todayStr = now.toISOString().split("T")[0];
  if (lastPostDateStr === todayStr) {
    // Already posted today → no change
    return { streak: streakDoc.streak, lastPostDate: lastPostDateStr };
  }

  // 4️⃣ Check if yesterday → continue streak
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  let newStreak = 1;
  if (lastPostDateStr === yesterdayStr) {
    newStreak = streakDoc.streak + 1;
  }

  // 5️⃣ Update streak and lastPostDate
  streakDoc.streak = newStreak;
  streakDoc.lastPostDate = now;
  streakDoc.expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // reset TTL
  await streakDoc.save();

  return { streak: streakDoc.streak, lastPostDate: streakDoc.lastPostDate.toISOString().split("T")[0] };
}

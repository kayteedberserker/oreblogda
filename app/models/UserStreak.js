import mongoose from "mongoose";

const userStreakSchema = new mongoose.Schema(
    {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "MobileUser", required: true, unique: true },
        streak: { type: Number, default: 0 },
        lastPostDate: { type: Date, default: Date.now },
        // ⚡️ NEW: Tracks active protection windows (Clan or Consumable Shop Items)
        frozenUntil: { type: Date, default: null },
        expiresAt: { type: Date, default: null }, // TTL field
    },
    { timestamps: true }
);

// TTL index: document will auto-delete when expiresAt is reached
userStreakSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const UserStreak = mongoose.models.UserStreak || mongoose.model("UserStreak", userStreakSchema);

export default UserStreak;
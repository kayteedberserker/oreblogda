import mongoose from 'mongoose';

const MonthlyHypeStatSchema = new mongoose.Schema({
    month: { type: String, required: true, index: true }, // "2026-05"
    entityType: {
        type: String,
        required: true,
        enum: ['USER_GIVEN', 'USER_RECEIVED', 'CLAN_RECEIVED'],
        index: true
    },
    entityId: { type: String, required: true }, // Will store user._id (as string) or clanTag

    // 📊 Display Data cached for ultra-fast leaderboard fetching (No heavy $lookup joins)
    name: { type: String, required: true }, // username or clanName
    avatar: { type: String }, // user profile image or clan logo
    secondaryContext: { type: String }, // e.g., If entityType is USER_RECEIVED, store their Clan Tag here

    // 🔥 The Core Score Metric
    score: { type: Number, default: 0, index: true },
    count: { type: Number, default: 0 } // Total number of actions dropped/received
}, { timestamps: true });

// Strict compound index so a single user/clan only has ONE document per category per month
MonthlyHypeStatSchema.index({ month: 1, entityType: 1, entityId: 1 }, { unique: true });

export default mongoose.models.MonthlyHypeStat || mongoose.model('MonthlyHypeStat', MonthlyHypeStatSchema);
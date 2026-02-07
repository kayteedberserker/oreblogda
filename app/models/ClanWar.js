import mongoose from "mongoose";

const ClanWarSchema = new mongoose.Schema({
    // Unique identifier: e.g., "AKATVESPADA" 
    // Usually sorted alphabetically (A-Z) to prevent "AVB" and "BVA" existing at once.
    warId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },

    // Personalization & Filtering
    country: {
        type: String,
        default: "Global",
        index: true
    },

    // Participants
    challengerTag: { type: String, required: true },
    defenderTag: { type: String, required: true },

    // State Management
    status: {
        type: String,
        enum: ["PENDING", "NEGOTIATING", "ACTIVE", "COMPLETED", "REJECTED"],
        default: "PENDING",
        index: true
    },
    // 🔥 NEW FIELD: Tracks who made the last move (initial challenge or counter)
    lastUpdatedByCustomTag: { type: String, default: null },
    // War Configuration
    warType: {
        type: String,
        enum: ["POINTS", "LIKES", "COMMENTS", "ALL"],
        default: "POINTS"
    },
    isBountyWar: {
        type: Boolean,
        default: false
    },
    prizePool: {
        type: Number,
        required: true
    },
    winCondition: {
        type: String,
        enum: ["FULL", "PERCENTAGE"],
        default: "FULL"
    },

    // Timeline
    durationDays: {
        type: Number,
        enum: [3, 5, 7],
        default: 3
    },
    startTime: { type: Date },
    endTime: { type: Date },

    // Snapshot of stats at the exact moment the war starts
    // This allows us to calculate "Score = Current - Initial"
    initialStats: {
        challenger: {
            points: { type: Number, default: 0 },
            likes: { type: Number, default: 0 },
            comments: { type: Number, default: 0 }
        },
        defender: {
            points: { type: Number, default: 0 },
            likes: { type: Number, default: 0 },
            comments: { type: Number, default: 0 }
        }
    },

    // Cached scores for fast UI rendering
    currentProgress: {
        challengerScore: { type: Number, default: 0 },
        defenderScore: { type: Number, default: 0 }
    },

    // Result tracking
    winner: {
        type: String,
        default: null // Will store the winning Clan Tag
    },
    // Inside ClanWar schema definition
    expiresAt: {
        type: Date,
        index: { expires: 0 } // This tells MongoDB to delete the doc when this time is reached
    },
    finalSnapshot: { type: Object } // Optional: Store final scores for history
}, { timestamps: true });

// Composite index for fetching active wars in a specific country
ClanWarSchema.index({ status: 1, country: 1 });

export default mongoose.models.ClanWar || mongoose.model("ClanWar", ClanWarSchema);
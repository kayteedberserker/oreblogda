import mongoose from "mongoose";

const mobileUserSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true },
    username: { type: String, default: "Guest Author" },
    pushToken: { type: String, default: null },
    role: { type: String, default: "Author" },
    description: { type: String, default: "" },
    profilePic: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    totalRejectedPost: { type: Number, default: 0 },
    consecutiveStreak: { type: Number, default: 0 },
    country: { type: String, default: 'Unknown' },
    lastActive: { type: Date, default: Date.now },
    appOpens: { type: Number, default: 0 },
    activityLog: [{ type: Date, default: Date.now }],
    lastStreak: { type: Number, default: 0 },

    // --- NEW COIN SYSTEM FIELDS ---
    coins: {
      type: Number,
      default: 0
    },
    lastClaimedDate: {
      type: Date,
      default: null
    },
    coinTransactionHistory: {
      type: [{
        action: String,
        type: String,
        amount: Number,
        date: { type: Date, default: Date.now }
      }],
      default: []
    },

    // --- NEW AURA SYSTEM FIELDS ---
    weeklyAura: {
      type: Number,
      default: 0
    },

    previousRank: {
      type: Number,
      default: null
    },

    referralCode: { type: String, unique: true, sparse: true },

    doubleStreakUntil: {
      type: Date,
      default: null
    },

    invitedUsers: [{
      username: String,
      date: { type: Date, default: Date.now }
    }],

    referredBy: { type: String, default: null },

    referralCount: { type: Number, default: 0 },

    auraHistory: [
      {
        weekNumber: Number,
        year: Number,
        points: Number,
        rank: Number,
      }
    ],
  },
  { timestamps: true }
);

// Correctly handle model re-compilation in Next.js
const MobileUser = mongoose.models.MobileUsers || mongoose.model("MobileUsers", mobileUserSchema);

export default MobileUser;
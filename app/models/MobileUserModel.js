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

    // --- NEW AURA SYSTEM FIELDS ---
    weeklyAura: {
      type: Number,
      default: 0
    }, // Current week's points (Resets weekly)

    previousRank: {
      type: Number,
      default: null
    }, // Stores 1, 2, or 3 from the last Cron reset
    // 🆔 This is their OWN special ID (e.g., ORE-X9Y2)
    referralCode: { type: String, unique: true, sparse: true },
    // Add this to your mobileUserSchema in MobileUserModel.js
    doubleStreakUntil: {
      type: Date,
      default: null
    },
    // Add this to your mobileUserSchema
    invitedUsers: [{
      username: String,
      date: { type: Date, default: Date.now }
    }],
    // 🔗 This tracks WHO invited them
    referredBy: { type: String, default: null },

    // 📈 Track their success
    referralCount: { type: Number, default: 0 },

    auraHistory: [
      {
        weekNumber: Number,
        year: Number,
        points: Number,
        rank: Number, // Where they finished that week
      }
    ], // Log of past performance
  },
  { timestamps: true }
);

// Correctly handle model re-compilation in Next.js
const MobileUser = mongoose.models.MobileUsers || mongoose.model("MobileUsers", mobileUserSchema);

export default MobileUser;



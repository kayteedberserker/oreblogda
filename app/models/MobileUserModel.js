import mongoose from "mongoose";

// 🎒 Inventory Item Schema (Shared logic with Clans)
const InventoryItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  name: { type: String, required: true },
  category: {
    type: String,
    required: true
  },
  // 🎨 Add this to store the SVG string and colors dynamically
  visualConfig: {
    svgCode: { type: String }, // The raw <svg>...</svg> string
    primaryColor: { type: String },
    secondaryColor: { type: String, default: null }, // For dual-color animations like 'triple'
    animationType: {
      type: String,
      default: "singleSnake"
    },
    duration: { type: Number, default: 3000 }, // Animation speed in ms
    snakeLength: { type: Number, default: 120 }, // length of the dash
    isAnimated: { type: Boolean, default: false }
  },
  isEquipped: { type: Boolean, default: false },
  acquiredAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
});

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

    // --- 🎭 NEURAL LINK PREFERENCES ---
    preferences: {
      favAnimes: { type: [String], default: [] },
      favGenres: { type: [String], default: [] },
      favCharacter: { type: String, default: "" },
    },

    // --- 🎒 USER INVENTORY & CUSTOMIZATION ---
    inventory: [InventoryItemSchema],
    activeCustomizations: {
      frame: { type: String, default: null },
      theme: { type: String, default: null },
      badge: { type: String, default: null },
      effect: { type: String, default: null }
    },

    // --- 💰 COIN SYSTEM ---
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

    // --- ✨ AURA SYSTEM ---
    weeklyAura: {
      type: Number,
      default: 0
    },
    previousRank: {
      type: Number,
      default: null
    },
    auraHistory: [
      {
        weekNumber: Number,
        year: Number,
        points: Number,
        rank: Number,
      }
    ],

    // --- 🔗 REFERRAL SYSTEM ---
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
  },
  { timestamps: true }
);

// Correctly handle model re-compilation in Next.js
const MobileUser = mongoose.models.MobileUsers || mongoose.model("MobileUsers", mobileUserSchema);

export default MobileUser;
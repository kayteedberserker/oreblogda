import mongoose from "mongoose";

// 🎒 Inventory Item Schema (Frames, Badges, etc.)
const InventoryItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  visualConfig: {
    svgCode: { type: String },
    primaryColor: { type: String },
    secondaryColor: { type: String, default: null },
    animationType: { type: String, default: "singleSnake" },
    duration: { type: Number, default: 3000 },
    snakeLength: { type: Number, default: 120 },
    isAnimated: { type: Boolean, default: false }
  },
  isEquipped: { type: Boolean, default: false },
  acquiredAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
});

// 👗 NEW: Wardrobe Schema for Character Clothing
const WardrobeItemSchema = new mongoose.Schema({
  clothingId: { type: String, required: true }, // e.g., 'cyber_jacket_01'
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['hair', 'top', 'pant', 'shoe', 'accessory'], 
    required: true 
  },
  isDefault: { type: Boolean, default: false }, // For those initial default clothes
  acquiredAt: { type: Date, default: Date.now }
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
    totalPurchasedCoins: { type: Number, default: 0 },
    peakLevel: { type: Number, default: 0 },
    totalRejectedPost: { type: Number, default: 0 },
    consecutiveStreak: { type: Number, default: 0 },
    country: { type: String, default: 'Unknown' },
    lastActive: { type: Date, default: Date.now },
    appOpens: { type: Number, default: 0 },
    activityLog: [{ type: Date, default: Date.now }],
    lastStreak: { type: Number, default: 0 },

    // --- 🎭 CHARACTER DESIGN ---
    character: {
      base: {
        gender: { type: String, enum: ['male', 'female'], default: 'male' },
        skinTone: { type: String, enum: ['light', 'medium', 'dark'], default: 'medium' },
        name: { type: String, default: 'Avatar' }
      },
      equipped: {
        hair: { type: String, default: 'default_hair' },
        top: { type: String, default: 'default_top' },
        pant: { type: String, default: 'default_pant' },
        shoe: { type: String, default: 'default_shoe' },
        action: { type: String, default: 'idle' } // wave, shy, jump
      }
    },

    // --- 👗 DEDICATED WARDROBE ---
    wardrobe: [WardrobeItemSchema],

    // --- 🎭 NEURAL LINK PREFERENCES ---
    preferences: {
      favAnimes: { type: [String], default: [] },
      favGenres: { type: [String], default: [] },
      favCharacter: { type: String, default: "" },
    },

    // --- 🎒 USER INVENTORY (Frames/Badges Only) ---
    inventory: [InventoryItemSchema],
    activeCustomizations: {
      frame: { type: String, default: null },
      theme: { type: String, default: null },
      badge: { type: String, default: null },
      effect: { type: String, default: null }
    },

    // --- 💰 COIN SYSTEM ---
    coins: { type: Number, default: 0 },
    lastClaimedDate: { type: Date, default: null },
    // ⚡️ NEW: Track one-time event claims to prevent double-dipping
    claimedEvents: [{
        eventId: { type: String, required: true },
        claimedAt: { type: Date, default: Date.now }
    }],
    // ⚡️ NEW: GACHA PITY SYSTEM
    gachaPityCounter: { type: Number, default: 0 },
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
    weeklyAura: { type: Number, default: 0 },
    previousRank: { type: Number, default: null },
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
    doubleStreakUntil: { type: Date, default: null },
    invitedUsers: [{
      username: String,
      date: { type: Date, default: Date.now }
    }],
    referredBy: { type: String, default: null },
    referralCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const MobileUser = mongoose.models.MobileUsers || mongoose.model("MobileUsers", mobileUserSchema);

export default MobileUser;
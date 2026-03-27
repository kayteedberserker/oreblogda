import mongoose from "mongoose";

// 🎒 Inventory Item Schema (Frames, Badges, etc.)
const InventoryItemSchema = new mongoose.Schema({
  itemId: { type: String, required: true },
  name: { type: String, required: true },
  category: { type: String, required: true },
  rarity: { 
    type: String, 
    default: 'Common' 
  },
  visualConfig: {
    svgCode: { type: String },
    lottieUrl: { type: String },
    primaryColor: { type: String },
    secondaryColor: { type: String, default: null },
    animationType: { type: String },
    opacity:{ type: Number },
    zoom: { type: Number },
		offsetY: { type: Number },
    duration: { type: Number},
    snakeLength: { type: Number},
    isAnimated: { type: Boolean, default: false }
  },
  isEquipped: { type: Boolean, default: false },
  acquiredAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
});

// 👗 Wardrobe Schema for Character Clothing
const WardrobeItemSchema = new mongoose.Schema({
  clothingId: { type: String, required: true }, 
  name: { type: String, required: true },
  type: { 
    type: String, 
    enum: ['hair', 'top', 'pant', 'shoe', 'accessory'], 
    required: true 
  },
  isDefault: { type: Boolean, default: false }, 
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
        action: { type: String, default: 'idle' } 
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
    claimedEvents: [{
        eventId: { type: String, required: true },
        claimedAt: { type: Date, default: Date.now }
    }],
    
    // ⚡️ DYNAMIC EVENT TRACKERS (Mapped by eventId)
    gachaPityCounters: { type: Map, of: Number, default: {} },
    eventPoints: { type: Map, of: Number, default: {} },
    
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
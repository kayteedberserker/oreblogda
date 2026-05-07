import bcrypt from "bcryptjs"; // NEW: For hashing the PIN
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
    opacity: { type: Number },
    zoom: { type: Number },
    offsetY: { type: Number },
    duration: { type: Number },
    snakeLength: { type: Number },
    isAnimated: { type: Boolean, default: false }
  },
  isEquipped: { type: Boolean, default: false },
  acquiredAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, default: null },
});

const StickerSchema = new mongoose.Schema({
  stickerId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  rarity: {
    type: String,
    enum: ['Common', 'Rare', 'Epic', 'Legendary'],
    default: 'Common'
  },
  visualType: {
    type: String,
    enum: ['svg', 'lottie', 'image'],
    required: true
  },
  visualData: {
    svgCode: { type: String },
    lottieUrl: { type: String },
    imageUrl: { type: String },
    color: { type: String }
  },
  isRentable: { type: Boolean, default: true },
  isActive: { type: Boolean, default: true }
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
    // --- 🔑 IDENTITY & SECURITY SYSTEM ---
    uid: { type: String, unique: true, sparse: true },
    deviceId: { type: String, required: true, unique: true },
    hardwareId: { type: String, index: true },

    // 🛡️ TRUSTED DEVICES SYSTEM (Multi-device login)
    trustedDevices: [{
      hardwareId: { type: String, required: true },
      deviceId: { type: String, required: true },
      addedAt: { type: Date, default: Date.now },
      lastActive: { type: Date, default: Date.now }
    }],
    activeSessionDeviceId: { type: String, default: null }, // Currently active device - clearing this logs out other devices

    // NEW: Security Fields
    pin: {
      type: String,
      required: false, // Optional initially for Level 1 guests
      select: false    // CRITICAL: Won't show up in normal queries (API won't leak it)
    },
    email: {
      type: String,
      unique: true,
      sparse: true, // Allows nulls while keeping unique constraint for those who provide it
      lowercase: true
    },
    securityLevel: { type: Number, default: 1 }, // LVL 1: Device, LVL 2: PIN, LVL 3: Email

    // 🛡️ BRUTE-FORCE PROTECTION FIELDS
    loginAttempts: { type: Number, default: 0, select: false },
    lockUntil: { type: Date, default: null, select: false },
    username: { type: String, default: "Guest Author" },
    pushToken: { type: String, default: null },
    role: { type: String, default: "Author" },
    description: { type: String, default: "" },
    profilePic: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    totalPurchasedCoins: { type: Number, default: 0 },
    lifetimeCoinsSpent: { type: Number, default: 0 },
    totalLikes: { type: Number, default: 0 },
    totalPosts: { type: Number, default: 0 },
    receivedCommentsCount: { type: Number, default: 0 },
    lifetimeCommentsCount: { type: Number, default: 0 },
    totalShares: { type: Number, default: 0 },
    totalViews: { type: Number, default: 0 },
    peakLevel: { type: Number, default: 0 },
    totalRejectedPost: { type: Number, default: 0 },
    consecutiveStreak: { type: Number, default: 0 },
    refreshToken: { type: String },
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
    stickers: {
      owned: [{ type: String }],
    },
    activeCustomizations: {
      frame: { type: String, default: null },
      theme: { type: String, default: null },
      badge: { type: String, default: null },
      effect: { type: String, default: null }
    },
    unlockedTitles: [{ name: String, tier: String }],
    equippedTitle: { name: String, tier: String },

    // --- 💰 COIN SYSTEM ---
    coins: { type: Number, default: 0 },
    lastClaimedDate: { type: Date, default: null },
    claimedEvents: [{
      eventId: { type: String, required: true },
      claimedAt: { type: Date, default: Date.now }
    }],

    // ⚡️ DYNAMIC EVENT TRACKERS
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
    currentRankLevel: { type: Number, default: 1 },
    hasLoggedOut: { type: Boolean, default: false },
    // --- ✨ AURA SYSTEM ---
    weeklyAura: { type: Number, default: 0 },
    aura: { type: Number, default: 0 },
    previousRank: { type: Number, default: null },
    auraHistory: [
      {
        weekNumber: Number,
        year: Number,
        points: Number,
        rank: Number,
      }
    ],
    coffeeCount: { type: Number, default: 0 },

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

// --- 🛡️ SECURITY MIDDLEWARE ---

// Automatically hash the PIN before saving to the database
mobileUserSchema.pre("save", async function (next) {
  // Only hash the pin if it has been modified (or is new)
  if (!this.isModified("pin") || !this.pin) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.pin = await bcrypt.hash(this.pin, salt);
    next();
  } catch (err) {
    next(err);
  }
});

// Helper method to compare PINs (used during login)
mobileUserSchema.methods.comparePin = async function (enteredPin) {
  return await bcrypt.compare(enteredPin, this.pin);
};

const MobileUser = mongoose.models.MobileUsers || mongoose.model("MobileUsers", mobileUserSchema);

export default MobileUser;
import bcrypt from "bcryptjs";
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
    descriptiom: { type: String, default: null },
    hypeType: { type: String, default: null },
    url: { type: String, default: null },
    visualConfig: {
        svgCode: { type: String },
        lottieUrl: { type: String },
        primaryColor: { type: String },
        secondaryColor: { type: String, default: null },
        animationType: { type: String },
        opacity: { type: Number },
        zoom: { type: Number },
        scale: { type: Number },
        rotation: { type: String },
        offsetY: { type: Number },
        duration: { type: Number },
        snakeLength: { type: Number },
        isAnimated: { type: Boolean, default: false }
    },
    itemCount: { type: Number, default: 1 },
    isConsumable: { type: Boolean, default: false },
    canonicalUsername: {
        type: String,
        index: true
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

// ⚡️ NEW: Feed Source Stats Sub-Schema for Telemetry
const sourceStatSchema = new mongoose.Schema({
    impressions: { type: Number, default: 0 },
    likes: { type: Number, default: 0 },
    comments: { type: Number, default: 0 },
    shares: { type: Number, default: 0 },
    votes: { type: Number, default: 0 },
    watch_complete: { type: Number, default: 0 },
    skips: { type: Number, default: 0 }
}, { _id: false });

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
        activeSessionDeviceId: { type: String, default: null },

        // NEW: Security Fields
        pin: {
            type: String,
            required: false,
            select: false
        },
        email: {
            type: String,
            unique: true,
            sparse: true,
            lowercase: true
        },
        securityLevel: { type: Number, default: 1 },

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
        tokens: { type: Number, default: 0 },
        receivedCommentsCount: { type: Number, default: 0 },
        lifetimeCommentsCount: { type: Number, default: 0 },
        totalShares: { type: Number, default: 0 },
        totalViews: { type: Number, default: 0 },
        peakLevel: { type: Number, default: 0 },
        totalRejectedPost: { type: Number, default: 0 },
        consecutiveStreak: { type: Number, default: 1 },
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

        // --- 🎭 NEURAL LINK PREFERENCES ---
        preferences: {
            favAnimes: { type: [String], default: [] },
            favGenres: { type: [String], default: [] },
            favCharacter: { type: String, default: "" },
        },

        // --- 🧠 DYNAMIC ALGORITHM (AFFINITY SYSTEM) ---
        affinityScores: { type: Map, of: Number, default: {} },
        authorAffinity: { type: Map, of: Number, default: {} },
        countryAffinity: { type: Map, of: Number, default: {} },

        // ⚡️ NEW: MACHINE LEARNING FEED TELEMETRY (Added 'Explore')
        feedLearning: {
            sourceStats: {
                fresh: { type: sourceStatSchema, default: () => ({}) },
                interest: { type: sourceStatSchema, default: () => ({}) },
                clan: { type: sourceStatSchema, default: () => ({}) },
                author: { type: sourceStatSchema, default: () => ({}) },
                trending: { type: sourceStatSchema, default: () => ({}) },
                explore: { type: sourceStatSchema, default: () => ({}) }
            },
            poolWeights: {
                fresh: { type: Number, default: 0.20 },
                author: { type: Number, default: 0.20 },
                clan: { type: Number, default: 0.15 },
                interest: { type: Number, default: 0.20 },
                trending: { type: Number, default: 0.15 },
                explore: { type: Number, default: 0.10 }
            },
            lastOptimizedAt: { type: Date, default: Date.now }
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
        totalHypePointsGiven: { type: Number, default: 0 },
        totalHypePointsReceived: { type: Number, default: 0 },

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
        nameLockedUntil: { type: Date, default: null },
        coinTransactionHistory: {
            type: [{
                action: String,
                type: { type: String },
                amount: Number,
                date: { type: Date, default: Date.now }
            }],
            default: []
        },
        auraMultiplierUntil: { type: Date, default: null },
        currentRankLevel: { type: Number, default: 1 },
        hasLoggedOut: { type: Boolean, default: false },

        // --- ✨ AURA SYSTEM ---
        weeklyAura: { type: Number, default: 0 },
        aura: { type: Number, default: 0 },
        previousRank: { type: Number, default: null },
        platform: { type: String, default: null },
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
        canonicalUsername: {
            type: String,
            index: true
        },
        referredBy: { type: String, default: null },
        referralCount: { type: Number, default: 0 },
    },
    { timestamps: true }
);

// --- 🛡️ SECURITY MIDDLEWARE ---
mobileUserSchema.pre("save", async function (next) {
    if (!this.isModified("pin") || !this.pin) return next();

    try {
        const salt = await bcrypt.genSalt(10);
        this.pin = await bcrypt.hash(this.pin, salt);
        next();
    } catch (err) {
        next(err);
    }
});

mobileUserSchema.methods.comparePin = async function (enteredPin) {
    return await bcrypt.compare(enteredPin, this.pin);
};

const MobileUser = mongoose.models.MobileUsers || mongoose.model("MobileUsers", mobileUserSchema);

export default MobileUser;
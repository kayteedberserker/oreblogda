import mongoose from 'mongoose';
import MobileUser from './MobileUserModel';

// --- 💬 NEW: CLAN MESSAGE SCHEMA ---
const ClanMessageSchema = new mongoose.Schema({
    _id: {
        type: mongoose.Schema.Types.ObjectId,
        default: () => new mongoose.Types.ObjectId()
    },
    authorId: { type: String }, // Device ID / Fingerprint
    authorUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MobileUser",
        required: true
    },
    authorName: { type: String, required: true },
    text: { type: String, required: true },
    date: { type: Date, default: Date.now }
});

const InventoryItemSchema = new mongoose.Schema({
    itemId: { type: String, required: true },
    name: { type: String, required: true },
    category: {
        type: String,
        required: true
    },
    visualConfig: {
        svgCode: { type: String }, 
        primaryColor: { type: String },
        secondaryColor: { type: String, default: null }, 
        animationType: {
            type: String,
            default: "singleSnake"
        },
        duration: { type: Number, default: 3000 }, 
        snakeLength: { type: Number, default: 120 }, 
        isAnimated: { type: Boolean, default: false }
    },
    isEquipped: { type: Boolean, default: false },
    acquiredAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null },
});

const ClanSchema = new mongoose.Schema({
    name: { type: String, required: true },
    tag: { type: String, required: true, unique: true, uppercase: true },
    description: { type: String, default: "" },

    // Roles
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'MobileUser' },
    viceLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'MobileUser' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MobileUser' }],

    // --- 💬 NEW: THE CHAT ROOM ---
    messages: [ClanMessageSchema],

    // Public Stats
    followerCount: { type: Number, default: 0 },

    // Stats for Point Generation & Badges
    stats: {
        views: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        shares: { type: Number, default: 0 },
        comments: { type: Number, default: 0 },
        totalPosts: { type: Number, default: 0 }, 
        warLikes: { type: Number, default: 0 },
        warComments: { type: Number, default: 0 },
    },

    totalPoints: { type: Number, default: 0 },
    totalPurchasedCoins: { type: Number, default: 0 },
    spendablePoints: { type: Number, default: 0 },

    lockedPoints: { type: Number, default: 0 },
    activeMultiplier: { type: Number, default: 0 }, 
    multiplierExpiresAt: { type: Date, default: null },
    rank: { type: Number, default: 1 }, 

    isRecruiting: { type: Boolean, default: true },
    maxSlots: { type: Number, default: 5 }, 
    joinRequests: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'MobileUser' },
        username: String,
        appliedAt: { type: Date, default: Date.now }
    }],

    // Weekly Tracking
    currentWeeklyPoints: { type: Number, default: 0 },
    weeklyPointHistory: [{
        weekEnding: Date,
        points: Number,
        rankAtTime: Number
    }],

    country: {
        type: String,
        default: "Global",
        index: true
    },

    isInWar: { type: Boolean, default: false },
    activeWarId: {
        type: String,
        default: null, 
        index: true
    },

    hasBounty: { type: Boolean, default: false },
    bountyAmount: { type: Number, default: 0 },
    bountyType: {
        type: String,
        enum: ["SYSTEM", "PLAYER_PLACED", null],
        default: null
    },
    bountyExpiry: { type: Date },

    // Inventory & Customization
    specialInventory: [InventoryItemSchema], 

    activeCustomizations: {
        frame: { type: String, default: null },
        theme: { type: String, default: null },
        effect: { type: String, default: null },
        verifiedBadgeXml: { type: String, default: null }, 
        verifiedTier: { type: String, default: 'none' }   
    },
    verifiedUntil: { type: Date, default: null }, 
    purchasedPacks: [{ type: String }], 

    consecutiveWeeksNoDerank: { type: Number, default: 0 }, 
    lastActive: { type: Date, default: Date.now },
    badges: [String],

}, { timestamps: true });

// Index for the War/Bounty system
ClanSchema.index({ isInWar: 1, hasBounty: 1, rank: 1 });

// --- 🛡️ MIDDLEWARE: Enforce 250 Message Limit ---
ClanSchema.pre('save', function (next) {
    // If the messages array exists and has more than 250 items, 
    // slice it to keep only the 250 MOST RECENT messages (the end of the array)
    if (this.messages && this.messages.length > 250) {
        this.messages = this.messages.slice(-250);
    }
    next();
});

// Hot reload safe export
if (process.env.NODE_ENV === "development") {
    delete mongoose.models.Clan;
}

export default mongoose.models.Clan || mongoose.model('Clan', ClanSchema);
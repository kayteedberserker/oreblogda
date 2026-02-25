import mongoose from 'mongoose';

const InventoryItemSchema = new mongoose.Schema({
    itemId: { type: String, required: true },
    name: { type: String, required: true },
    category: { type: String, enum: ['FRAME', 'THEME', 'BADGE', 'EFFECT', 'FUNCTIONAL'], required: true },
    isEquipped: { type: Boolean, default: false },
    acquiredAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: null }, // null = permanent
});

const ClanSchema = new mongoose.Schema({
    name: { type: String, required: true },
    tag: { type: String, required: true, unique: true, uppercase: true },
    description: { type: String, default: "" },

    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'MobileUser' },
    viceLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'MobileUser' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MobileUser' }],

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
    spendablePoints: { type: Number, default: 0 },
    lockedPoints: { type: Number, default: 0 },
    rank: { type: Number, default: 1 },

    isRecruiting: { type: Boolean, default: true },
    maxSlots: { type: Number, default: 6 },
    joinRequests: [{
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'MobileUser' },
        appliedAt: { type: Date, default: Date.now }
    }],

    // --- 📦 ROBUST INVENTORY SYSTEM ---
    specialInventory: [InventoryItemSchema], 
    
    // Quick-access for UI rendering (what is currently active)
    activeCustomizations: {
        frame: { type: String, default: null },
        theme: { type: String, default: null },
        effect: { type: String, default: null }
    },

    verifiedUntil: { type: Date, default: null },
    purchasedPacks: [{ type: String }],
    badges: [String],
    
    isInWar: { type: Boolean, default: false },
    activeWarId: { type: String, default: null },
}, { timestamps: true });

// Check if model exists before defining to prevent Next.js hot-reload errors
export default mongoose.models.Clan || mongoose.model('Clan', ClanSchema);
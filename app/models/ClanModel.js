import mongoose from 'mongoose';

const ClanSchema = new mongoose.Schema({
    name: { type: String, required: true },
    tag: { type: String, required: true, unique: true, uppercase: true },
    description: { type: String, default: "" },

    // Roles
    leader: { type: mongoose.Schema.Types.ObjectId, ref: 'MobileUser' },
    viceLeader: { type: mongoose.Schema.Types.ObjectId, ref: 'MobileUser' },
    members: [{ type: mongoose.Schema.Types.ObjectId, ref: 'MobileUser' }],

    // Public Stats
    followerCount: { type: Number, default: 0 },

    // Stats for Point Generation & Badges
    stats: {
        views: { type: Number, default: 0 },
        likes: { type: Number, default: 0 },
        shares: { type: Number, default: 0 },
        comments: { type: Number, default: 0 },
        totalPosts: { type: Number, default: 0 }, // For Library of Ohara (1K posts)
        
        // --- ⚔️ NEW: War Progress Tracking ---
        // These track the cumulative counts specifically for engagement-based wars
        warLikes: { type: Number, default: 0 },
        warComments: { type: Number, default: 0 },
    },

    totalPoints: { type: Number, default: 0 },
    spendablePoints: { type: Number, default: 0 },
    
    // --- ⚔️ NEW: Escrow/Locked Points ---
    // Points staked in an active war are moved here until the war ends
    lockedPoints: { type: Number, default: 0 },

    rank: { type: Number, default: 1 }, // This represents the Clan Level (1-6)
    
    // Add these fields to your existing ClanSchema in ClanModel.js
    isRecruiting: { type: Boolean, default: true },
    maxSlots: { type: Number, default: 5 }, // Starts at 5, upgradeable to 13
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

    // --- ⚔️ NEW: War & Bounty State ---
    isInWar: { type: Boolean, default: false },
    activeWarId: { 
        type: String, 
        default: null, // Stores "TAG1VTAG2"
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

    // Badge Logic Helpers
    consecutiveWeeksNoDerank: { type: Number, default: 0 }, // For Unlimited Chakra (4 weeks)
    lastActive: { type: Date, default: Date.now },
    badges: [String],

}, { timestamps: true });

// Index for the War/Bounty system to find targetable clans quickly
ClanSchema.index({ isInWar: 1, hasBounty: 1, rank: 1 });

export default mongoose.models.Clan || mongoose.model('Clan', ClanSchema);
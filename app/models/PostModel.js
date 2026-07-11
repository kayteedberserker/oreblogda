import mongoose from "mongoose";

/* =====================================================
1. COMMENT SCHEMA (Infinite nesting, web + mobile)
===================================================== */

const commentSchema = new mongoose.Schema({
    _id: {
        type: mongoose.Schema.Types.ObjectId,
        default: () => new mongoose.Types.ObjectId()
    },
    authorFingerprint: { type: String },
    authorId: { type: String },
    authorUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MobileUser",
        default: null
    },
    reportCount: { type: Number, default: 0 }, // 🌟 NEW: Tracks total reports
    reportedBy: [{ type: String }], // 🌟 NEW: Tracks fingerprints of reporters
    name: { type: String, required: true },
    text: { type: String, default: "" },
    stickerId: { type: String, default: null },
    imageUrl: { type: String, default: null }, // 🌟 NEW: Added to support image comment uploads
    replyToCommentId: { type: String, default: null }, // 🌟 NEW: Direct target reply ID tracking
    replyToName: { type: String, default: null }, // 🌟 NEW: Target reply user display name
    replyToText: { type: String, default: null }, // 🌟 NEW: Context preview snippet of what's replied to
    date: { type: Date, default: Date.now },
    isEdited: { type: Boolean, default: false },
    isHidden: { type: Boolean, default: false },
    replies: { type: Array, default: [] },
    type: { type: String, enum: ["text", "sticker", "image"], default: "text" } // 🌟 UPDATED: Added "image" enum
});

commentSchema.add({
    replies: [commentSchema]
});

/* =====================================================
2. LIKE SCHEMA (Supports old + new formats)
===================================================== */

const likeSchema = new mongoose.Schema(
    {
        deviceId: { type: String },
        fingerprint: { type: String },
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MobileUser",
            default: null
        },
        date: { type: Date, default: Date.now }
    },
    { _id: false }
);

/* =====================================================
3. POLL SCHEMAS
===================================================== */

const pollOptionSchema = new mongoose.Schema({
    text: { type: String, required: true },
    votes: { type: Number, default: 0 }
});

const pollSchema = new mongoose.Schema({
    pollMultiple: { type: Boolean, default: false },
    options: [pollOptionSchema]
});

/* =====================================================
4. VIEW ANALYTICS SCHEMA
===================================================== */

const viewDataSchema = new mongoose.Schema({
    visitorFingerprint: { type: String },
    visitorId: { type: String },
    ip: String,
    country: String,
    city: String,
    timezone: String,
    timestamp: { type: Date, default: Date.now }
});

/* =====================================================
5. NEW: MEDIA ITEM SCHEMA
===================================================== */

const mediaItemSchema = new mongoose.Schema({
    url: { type: String, required: true },
    type: { type: String, default: "image" },
    public_id: { type: String, default: null }, // 🌟 Added to track Cloudinary assets safely
    order: { type: Number, default: 0 } // 🌟 Added to preserve upload order
}, { _id: false });

/* =====================================================
6. MAIN POST SCHEMA
===================================================== */

const postSchema = new mongoose.Schema(
    {
        /* ---------- AUTHOR ---------- */
        authorFingerprint: { type: String },
        authorId: { type: String },
        authorUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MobileUser",
            default: null
        },
        authorName: { type: String, default: "Anonymous" },

        /* ---------- CONTENT ---------- */
        title: { type: String, required: true },
        message: { type: String, required: true },
        mediaUrl: { type: String },
        mediaType: { type: String },
        media: {
            type: [mediaItemSchema],
            default: []
        },

        /* ---------- INTERACTIONS ---------- */
        likes: [likeSchema],
        likeCount: { type: Number, default: 0 },
        // ⚡️ HYPE SYSTEM FIELDS
        hypePoints: {
            type: Number,
            default: 0,
            index: true // Useful if you want to sort posts by "Most Hyped"
        },
        hypeCount: {
            type: Number,
            default: 0,
        },
        comments: [commentSchema],
        shares: { type: Number, default: 0 },
        reportCount: { type: Number, default: 0 }, // 🌟 NEW: Tracks total reports
        reportedBy: [{ type: String }], // 🌟 NEW: Tracks fingerprints of reporters

        /* ---------- VIEWS ---------- */
        views: { type: Number, default: 0 },
        viewsFingerprints: [{ type: String }],
        viewsIPs: [{ type: String }],
        viewsData: [viewDataSchema],

        /* ---------- POLLS ---------- */
        poll: pollSchema,
        voters: {
            type: [mongoose.Schema.Types.Mixed], // Allows both "fingerprint-string" and { fingerprint, selectedOptions }
            default: []
        },

        /* ---------- META ---------- */
        slug: { type: String, unique: true, trim: true },

        interests: {
            type: [String],
            default: [],
            index: true
        },

        // 🌟 ADD THIS FIELD TO YOUR META BLOCK
        totalFilesExpected: {
            type: Number,
            default: 0
        },

        category: {
            type: String,
            default: "News"
        },

        clanId: {
            type: String,
            default: null,
            index: true
        },
        country: {
            type: String,
            default: "Global",
            index: true
        },

        status: {
            type: String,
            // 🌟 Added "pending_media" to the allowed options list
            enum: ["pending", "approved", "rejected", "pending_media"],
            default: "approved"
        },

        statusChangedAt: {
            type: Date,
            default: Date.now
        },
        rejectionReason: { type: String, default: "" },
        isAdminPost: { type: Boolean, default: false },

        // ⚡️ NEW: Post Boost Economy Field
        boostedUntil: { type: Date, default: null, index: true },
        // Add this around the same place as your boostedUntil field
        resurrectedAt: {
            type: Date,
            default: null,
            index: true
        },

        expiresAt: {
            type: Date,
            index: { expires: 0 }
        }
    },
    { timestamps: true }
);

/* =====================================================
7. MIDDLEWARE: Sync status and multi-media compatibility
===================================================== */

postSchema.pre('save', function (next) {
    if (this.isModified('status')) {
        this.statusChangedAt = new Date();
    }

    // Only auto-map indices if media items actually exist or status isn't awaiting files
    if (this.media && this.media.length > 0) {
        this.mediaUrl = this.media[0].url;
        this.mediaType = this.media[0].type;
    }
    else if (this.mediaUrl && (!this.media || this.media.length === 0)) {
        this.media = [{ url: this.mediaUrl, type: this.mediaType || "image", public_id: null, order: 0 }];
    }

    next();
});

/* =====================================================
8. HOT RELOAD SAFE EXPORT
===================================================== */

const Post = mongoose.models.Post || mongoose.model("Post", postSchema);
export default Post;
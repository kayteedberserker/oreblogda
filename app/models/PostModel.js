import mongoose from "mongoose";

/* =====================================================
1. COMMENT SCHEMAS (One root level + flat replies)
===================================================== */

const sharedCommentFields = {
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
    reportCount: {
        type: Number,
        default: 0,
        min: 0
    },
    reportedBy: {
        type: [String],
        default: []
    },
    name: {
        type: String,
        required: true
    },
    text: {
        type: String,
        default: ""
    },
    stickerId: {
        type: String,
        default: null
    },
    imageUrl: {
        type: String,
        default: null
    },
    date: {
        type: Date,
        default: Date.now
    },
    isEdited: {
        type: Boolean,
        default: false
    },
    isHidden: {
        type: Boolean,
        default: false
    },
    type: {
        type: String,
        enum: ["text", "sticker", "image"],
        default: "text"
    }
};

const replySchema = new mongoose.Schema(
    {
        ...sharedCommentFields,
        replyToCommentId: {
            type: String,
            default: null
        },
        replyToName: {
            type: String,
            default: null
        },
        replyToText: {
            type: String,
            default: null
        }
    },
    {
        _id: false
    }
);

const commentSchema = new mongoose.Schema(
    {
        ...sharedCommentFields,
        replies: {
            type: [replySchema],
            default: []
        }
    },
    {
        _id: false
    }
);

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
5. MEDIA ITEM SCHEMA
===================================================== */

const mediaItemSchema = new mongoose.Schema(
    {
        url: { type: String, required: true },
        type: { type: String, default: "image" },
        public_id: { type: String, default: null },
        order: { type: Number, default: 0 },
        r2Key: { type: String, default: null },
        mimeType: { type: String, default: null },
        extension: { type: String, default: null },
        expectedSize: { type: Number, default: 0, min: 0 }
    },
    { _id: false }
);

/* =====================================================
6. COUNTER HELPERS
===================================================== */

const DISCUSSION_MIN_REPLIES = 5;
const DISCUSSION_MIN_PARTICIPANTS = 2;

function getCommentParticipantKey(comment) {
    if (!comment) {
        return null;
    }

    if (comment.authorFingerprint) {
        return `device:${comment.authorFingerprint}`;
    }

    const userId =
        comment.authorUserId?._id
        || comment.authorUserId;

    if (userId) {
        return `user:${userId.toString()}`;
    }

    if (comment.authorId) {
        return `legacy:${comment.authorId.toString()}`;
    }

    const normalizedName =
        typeof comment.name === "string"
            ? comment.name.trim().toLowerCase()
            : "";

    return normalizedName
        ? `name:${normalizedName}`
        : null;
}

function countAllComments(comments) {
    if (!Array.isArray(comments)) {
        return 0;
    }

    return comments.reduce(
        (total, rootComment) => (
            total
            + 1
            + (
                Array.isArray(rootComment?.replies)
                    ? rootComment.replies.length
                    : 0
            )
        ),
        0
    );
}

function countQualifiedDiscussions(topLevelComments) {
    if (!Array.isArray(topLevelComments)) {
        return 0;
    }

    return topLevelComments.reduce(
        (total, rootComment) => {
            const replies =
                Array.isArray(rootComment?.replies)
                    ? rootComment.replies
                    : [];

            const participants = new Set();
            const rootParticipantKey =
                getCommentParticipantKey(rootComment);

            if (rootParticipantKey) {
                participants.add(rootParticipantKey);
            }

            replies.forEach(reply => {
                const participantKey =
                    getCommentParticipantKey(reply);

                if (participantKey) {
                    participants.add(participantKey);
                }
            });

            const qualifies =
                replies.length >= DISCUSSION_MIN_REPLIES
                && participants.size
                >= DISCUSSION_MIN_PARTICIPANTS;

            return total + (qualifies ? 1 : 0);
        },
        0
    );
}

/* =====================================================
7. MAIN POST SCHEMA
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
        likes: {
            type: [likeSchema],
            default: []
        },

        // Canonical feed/ranking counter.
        likesCount: {
            type: Number,
            default: 0,
            min: 0
        },

        // Legacy compatibility. Keep synchronized while older routes still read it.
        likeCount: {
            type: Number,
            default: 0,
            min: 0
        },

        hypePoints: {
            type: Number,
            default: 0,
            index: true
        },

        // Number of hype actions. This is not the same as hypePoints.
        hypeCount: {
            type: Number,
            default: 0,
            min: 0
        },

        comments: {
            type: [commentSchema],
            default: []
        },

        // Total visible comment messages: top-level comments plus every reply.
        commentsCount: {
            type: Number,
            default: 0,
            min: 0
        },

        // Number of qualifying top-level discussion threads.
        // A thread qualifies after at least 5 nested replies from at least
        // 2 distinct participants, including the root commenter.
        discussionCount: {
            type: Number,
            default: 0,
            min: 0
        },

        shares: { type: Number, default: 0, min: 0 },
        reportCount: { type: Number, default: 0 },
        reportedBy: [{ type: String }],

        /* ---------- VIEWS ---------- */
        views: { type: Number, default: 0, min: 0 },
        viewsFingerprints: [{ type: String }],
        viewsIPs: [{ type: String }],
        viewsData: [viewDataSchema],

        /* ---------- POLLS ---------- */
        poll: pollSchema,
        voters: {
            type: [mongoose.Schema.Types.Mixed],
            default: []
        },

        /* ---------- META ---------- */
        slug: {
            type: String,
            unique: true,
            trim: true
        },

        interests: {
            type: [String],
            default: [],
            index: true
        },

        totalFilesExpected: {
            type: Number,
            default: 0,
            min: 0,
            max: 15
        },

        requestId: {
            type: String,
            trim: true,
            default: null
        },

        rewardsGrantedAt: {
            type: Date,
            default: null
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
            enum: ["pending", "approved", "rejected", "pending_media"],
            default: "approved"
        },

        uploadStatus: {
            type: String,
            enum: ["pending", "uploading", "finalizing", "uploaded", "failed"],
            default: "uploaded",
            index: true
        },

        moderationStatus: {
            type: String,
            enum: ["pending", "processing", "approved", "rejected", "failed"],
            default: "pending",
            index: true
        },

        uploadStatusChangedAt: {
            type: Date,
            default: Date.now
        },

        moderationStatusChangedAt: {
            type: Date,
            default: Date.now
        },

        statusChangedAt: {
            type: Date,
            default: Date.now
        },

        rejectionReason: {
            type: String,
            default: ""
        },

        isAdminPost: {
            type: Boolean,
            default: false
        },

        boostedUntil: {
            type: Date,
            default: null,
            index: true
        },

        resurrectedAt: {
            type: Date,
            default: null,
            index: true
        },

        willBeDeleted: {
            type: Boolean,
            default: false
        },

        deleteAt: {
            type: Date,
            default: null,
            index: { expires: 0 }
        },

        expiresAt: {
            type: Date,
            index: { expires: 0 }
        }
    },
    { timestamps: true }
);

/* =====================================================
8. FEED QUERY INDEXES

Inspect existing indexes with Post.collection.indexes() before deploying.
These compound indexes match the actual candidate-pool query shapes.
===================================================== */

postSchema.index({ status: 1, createdAt: -1 });
postSchema.index({ status: 1, category: 1, createdAt: -1 });
postSchema.index({ status: 1, clanId: 1, createdAt: -1 });
postSchema.index({ status: 1, authorUserId: 1, createdAt: -1 });
postSchema.index({ status: 1, authorId: 1, createdAt: -1 });
postSchema.index({ status: 1, interests: 1, createdAt: -1 });
postSchema.index({ status: 1, boostedUntil: 1 });
postSchema.index({ status: 1, resurrectedAt: -1 });

// Only posts with a real string requestId participate in this unique index.
// This prevents old posts with requestId: null from colliding.
postSchema.index(
    { authorUserId: 1, requestId: 1 },
    {
        unique: true,
        partialFilterExpression: {
            requestId: { $type: "string" }
        },
        name: "unique_author_request_id"
    }
);

/* =====================================================
9. MIDDLEWARE: Status, media compatibility and counters
===================================================== */

postSchema.pre("save", function syncPostState(next) {
    if (this.isModified("status")) {
        this.statusChangedAt = new Date();
    }

    if (this.isModified("uploadStatus")) {
        this.uploadStatusChangedAt = new Date();
    }

    if (this.isModified("moderationStatus")) {
        this.moderationStatusChangedAt = new Date();
    }

    if (this.media && this.media.length > 0) {
        this.mediaUrl = this.media[0].url;
        this.mediaType = this.media[0].type;
    } else if (
        this.mediaUrl
        && (!this.media || this.media.length === 0)
    ) {
        this.media = [
            {
                url: this.mediaUrl,
                type: this.mediaType || "image",
                public_id: null,
                order: 0,
                r2Key: null,
                mimeType: null,
                extension: null,
                expectedSize: 0
            }
        ];
    }

    if (this.isModified("likes")) {
        const nextLikesCount = Array.isArray(this.likes)
            ? this.likes.length
            : 0;

        this.likesCount = nextLikesCount;
        this.likeCount = nextLikesCount;
    }

    if (this.isModified("comments")) {
        const topLevelComments = Array.isArray(this.comments)
            ? this.comments
            : [];

        this.commentsCount = countAllComments(topLevelComments);
        this.discussionCount = countQualifiedDiscussions(
            topLevelComments
        );
    }

    this.likesCount = Math.max(0, this.likesCount || 0);
    this.likeCount = Math.max(0, this.likeCount || 0);
    this.commentsCount = Math.max(0, this.commentsCount || 0);
    this.discussionCount = Math.max(0, this.discussionCount || 0);

    next();
});

/* =====================================================
10. HOT RELOAD SAFE EXPORT
===================================================== */

const Post = mongoose.models.Post
    || mongoose.model("Post", postSchema);

export default Post;
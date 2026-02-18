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
  name: { type: String, required: true },
  text: { type: String, required: true },
  date: { type: Date, default: Date.now },
  replies: { type: Array, default: [] }
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
  type: { type: String, default: "image" }
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
    comments: [commentSchema],
    shares: { type: Number, default: 0 },

    /* ---------- VIEWS ---------- */
    views: { type: Number, default: 0 },
    viewsFingerprints: [{ type: String }],
    viewsIPs: [{ type: String }],
    viewsData: [viewDataSchema],

    /* ---------- POLLS ---------- */
    poll: pollSchema,
    voters: [{ type: String }],
    votersOld: [{ type: String }],

    /* ---------- META ---------- */
    slug: { type: String, unique: true, trim: true },

    interests: { 
      type: [String], 
      default: [], 
      index: true 
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
      enum: ["pending", "approved", "rejected"],
      default: "approved"
    },

    statusChangedAt: {
      type: Date,
      default: Date.now
    },
    rejectionReason: { type: String, default: "" },

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

  if (this.media && this.media.length > 0) {
    this.mediaUrl = this.media[0].url;
    this.mediaType = this.media[0].type;
  } 
  else if (this.mediaUrl && (!this.media || this.media.length === 0)) {
    this.media = [{ url: this.mediaUrl, type: this.mediaType || "image" }];
  }

  next();
});

/* =====================================================
   8. HOT RELOAD SAFE EXPORT
===================================================== */

if (process.env.NODE_ENV === "development") {
  delete mongoose.models.Post;
}

export default mongoose.models.Post || mongoose.model("Post", postSchema);
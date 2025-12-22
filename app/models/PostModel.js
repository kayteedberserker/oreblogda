import mongoose from "mongoose";

/* =====================================================
   1. COMMENT SCHEMA (Infinite nesting, web + mobile)
===================================================== */

const commentSchema = new mongoose.Schema({
  _id: {
    type: mongoose.Schema.Types.ObjectId,
    default: () => new mongoose.Types.ObjectId()
  },
  // NEW (preferred)
  authorFingerprint: { type: String },
  // OLD (backward compatibility)
  authorId: { type: String },
  // Mobile-only (for notifications)
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

// Enable recursive replies
commentSchema.add({
  replies: [commentSchema]
});

/* =====================================================
   2. LIKE SCHEMA (Supports old + new formats)
===================================================== */

const likeSchema = new mongoose.Schema(
  {
    // NEW
    deviceId: { type: String },

    // OLD (some posts used "fingerprint")
    fingerprint: { type: String },

    // Mobile-only
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

  // OLD naming support
  visitorId: { type: String },

  ip: String,
  country: String,
  city: String,
  timezone: String,
  timestamp: { type: Date, default: Date.now }
});

/* =====================================================
   5. MAIN POST SCHEMA
===================================================== */

const postSchema = new mongoose.Schema(
  {
    /* ---------- AUTHOR ---------- */

    // NEW
    authorFingerprint: { type: String },

    // OLD
    authorId: { type: String },

    // Mobile-only
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

    /* ---------- INTERACTIONS ---------- */

    likes: [likeSchema],

    comments: [commentSchema],

    shares: { type: Number, default: 0 },

    /* ---------- VIEWS ---------- */

    views: { type: Number, default: 0 },

    // NEW
    viewsFingerprints: [{ type: String }],

    // OLD
    viewsIPs: [{ type: String }],

    viewsData: [viewDataSchema],

    /* ---------- POLLS ---------- */

    poll: pollSchema,

    // NEW
    voters: [{ type: String }],

    // OLD
    votersOld: [{ type: String }],

    /* ---------- META ---------- */

    slug: { type: String, unique: true, trim: true },

    category: {
      type: String,
      enum: ["News", "Memes", "Videos/Edits", "Polls", "Review", "Gaming"],
      default: "News"
    },

    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved"
    },

    expiresAt: { 
    type: Date, 
    index: { expires: 0 } 
  }
  },
  { timestamps: true }
);

/* =====================================================
   6. HOT RELOAD SAFE EXPORT
===================================================== */

if (process.env.NODE_ENV === "development") {
  delete mongoose.models.Post;
}

export default mongoose.models.Post || mongoose.model("Post", postSchema);

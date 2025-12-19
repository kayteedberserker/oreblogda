import mongoose from "mongoose";

// --- 1. Comment Schema (Supports Infinite Nesting & Notifications) ---
const commentSchema = new mongoose.Schema({
  _id: { type: mongoose.Schema.Types.ObjectId, default: () => new mongoose.Types.ObjectId() },
  authorId: { type: String, required: false }, // The fingerprint for notification targeting
  name: { type: String, required: true },
  text: { type: String, required: true },
  date: { type: Date, default: Date.now },
  replies: { type: Array, default: [] } 
});

// Enable Recursive Replies
commentSchema.add({
  replies: [commentSchema]
});

const likeSchema = new mongoose.Schema({
  fingerprint: String,
  date: { type: Date, default: Date.now }
}, { _id: false });

// --- 2. Poll & Analytics Sub-Schemas ---
const pollOptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votes: { type: Number, default: 0 },
});

const pollSchema = new mongoose.Schema({
  pollMultiple: { type: Boolean, default: false },
  options: [pollOptionSchema],
});

// For the Geo-Analytics logic in your PATCH request
const viewDataSchema = new mongoose.Schema({
  visitorId: String,
  ip: String,
  country: String,
  city: String,
  timezone: String,
  timestamp: { type: Date, default: Date.now }
});

// --- 3. Main Post Schema ---
const postSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true }, // The fingerprint of the post creator
    authorName: { type: String, default: "Anonymous" },
    title: { type: String, required: true },
    message: { type: String, required: true },
    mediaUrl: { type: String },
    mediaType: { type: String },
    
    // Updated Likes: Array of objects to support your "Recent Liker" algorithm
    likes: [likeSchema],
    
    comments: [commentSchema],
    
    shares: { type: Number, default: 0 },
    
    // Views Tracking
    views: { type: Number, default: 0 },
    viewsIPs: [{ type: String }], // Array of fingerprints for unique view logic
    viewsData: [viewDataSchema],   // Detailed analytics (Country, City, etc.)

    slug: { type: String, unique: true, trim: true },
    
    poll: pollSchema,
    voters: [String], // Array of fingerprints who voted
    
    category: {
      type: String,
      enum: ["News", "Memes", "Videos/Edits", "Polls", "Review", "Gaming"],
      default: "News",
    },
    status: { 
        type: String, 
        enum: ["pending", "approved", "rejected"], 
        default: "approved" 
    },
  },
  { timestamps: true }
);
if (process.env.NODE_ENV === "development") {
  delete mongoose.models.Post;
}
export default mongoose.models.Post || mongoose.model("Post", postSchema);
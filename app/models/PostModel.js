import mongoose from "mongoose";

const commentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  text: { type: String, required: true },
  date: { type: Date, default: Date.now },
});

const pollOptionSchema = new mongoose.Schema({
  text: { type: String, required: true },
  votes: { type: Number, default: 0 },
});

const pollSchema = new mongoose.Schema({
  pollMultiple: { type: Boolean, default: false },
  options: [pollOptionSchema],
});

const postSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true },
    authorName: { type: String, default: "Anonymous" },
    title: { type: String, required: true },
    message: { type: String, required: true },  // main + inline sections
    mediaUrl: { type: String },
    mediaType: { type: String },
    likes: [{ type: String }],
    likesIPs: [{ type: String }],
    comments: [commentSchema],
    shares: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    viewsIPs: [{ type: String }],
    poll: pollSchema,
    voters: [String],
    category: {
      type: String,
      enum: ["News", "Memes", "Videos/Edits", "Polls"],
      default: "News",
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.Post || mongoose.model("Post", postSchema);

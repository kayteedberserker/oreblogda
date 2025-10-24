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
  pollMultiple: { type: Boolean, default: false }, // allow multiple selections
  options: [pollOptionSchema],
});

const postSchema = new mongoose.Schema(
  {
    authorId: { type: String, required: true },
    authorName: { type: String, default: "Anonymous" },

    message: { type: String, required: true },
    mediaUrl: { type: String },
    mediaType: { type: String },

    likes: [{ type: String }], // store user ids or "anon" placeholder
    comments: [commentSchema],
    shares: { type: Number, default: 0 },
    views: { type: Number, default: 0 },

    poll: pollSchema, // optional poll
    voters: [String], // store visitorIds here to prevent duplicate voting

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export default mongoose.models.Post || mongoose.model("Post", postSchema);

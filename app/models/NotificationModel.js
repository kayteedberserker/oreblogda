import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema({
  recipientId: { type: String, required: true }, // The person getting the alert
  senderName: { type: String, required: true }, 
  type: { type: String, enum: ["like", "comment", "vote", "reply", "trending"] },
  priority: { type: String, enum: ["low", "medium", "high"], default: "high" },
  postId: { type: mongoose.Schema.Types.ObjectId, ref: "Post" },
  message: { type: String },
  read: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});
export default mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
// backend: /models/MobileUserModel.js
import mongoose from "mongoose";

const MobileUserSchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  username: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.MobileUser || mongoose.model("MobileUser", MobileUserSchema);

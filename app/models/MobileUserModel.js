import mongoose from "mongoose";

const mobileUserSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true }, // The fingerprint
    username: { type: String, default: "Guest Author" },
    pushToken: { type: String, default: null }, // 👈 Added: Stores the Expo Push Token
    role: { type: String, default: "Author" }, 
    description: { type: String, default: "" },
    profilePic: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
    country: { type: String, default: 'Unknown' },
    lastActive: { type: Date, default: Date.now }, // 👈 Added: Good for engagement timing
  },
  { timestamps: true }
);

// Correctly handle model re-compilation in Next.js
const MobileUser = mongoose.models.MobileUsers || mongoose.model("MobileUsers", mobileUserSchema);

export default MobileUser;
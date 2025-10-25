import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    username: { type: String, default: "User", required: true, trim: true },
    email: { type: String, unique: true, required: true, trim: true },
    password: { type: String, required: true, trim: true },
    role: { type: String, default: "User" },
    description: { type: String, default: "" },
    profilePic: {
      url: { type: String, default: "" },
      public_id: { type: String, default: "" },
    },
  },
  { timestamps: true }
);

// ✅ Fix OverwriteModelError
const userModel = mongoose.models.admins || mongoose.model("admins", userSchema);

export default userModel;

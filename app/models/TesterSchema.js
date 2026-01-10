// models/Tester.js
import { number } from "framer-motion";
import mongoose from "mongoose";

const TesterSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  number: { type: String, required: false, default: "" },
  deviceId: { type: String }, // Optional: helps you track them later
  status: { type: String, default: "pending" }, // pending, added, invited
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Tester || mongoose.model("Tester", TesterSchema);
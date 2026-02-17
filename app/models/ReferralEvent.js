import mongoose from "mongoose";
import MobileUser from "app/models/MobileUserModel";

const referralEventSchema = new mongoose.Schema({
    referrerId: { type: mongoose.Schema.Types.ObjectId, ref: "MobileUser", index: true },
    referredId: { type: mongoose.Schema.Types.ObjectId, ref: "MobileUser", unique: true },
    deviceId: { type: String, required: true },
    // 🔄 THE FIX: Track which giveaway round this referral belongs to
    round: { type: Number, default: 1, index: true }, 
    status: { type: String, default: 'verified' }
}, { timestamps: true });

const ReferralEvent = mongoose.models.ReferralEvent || mongoose.model("ReferralEvent", referralEventSchema);
export default ReferralEvent;
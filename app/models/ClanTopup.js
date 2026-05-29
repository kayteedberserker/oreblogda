import mongoose from "mongoose";

const ClanTopupSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MobileUser",
        required: true
    },
    clanTag: {
        type: String,
        required: true,
        index: true
    },
    amount: {
        type: Number,
        required: true
    },
    purchasedAt: {
        type: Date,
        default: Date.now
    }
});

export default mongoose.models.ClanTopup || mongoose.model("ClanTopup", ClanTopupSchema);
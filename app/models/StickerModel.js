import mongoose from "mongoose";

const StickerSchema = new mongoose.Schema({
    stickerId: { type: String, required: true, unique: true },
    url: { type: String, required: true }, // Cloudinary URL
    type: {
        type: String,
        enum: ["free", "event", "rent", "clan"], // ⚡️ Added "clan" type
        default: "free"
    },
    tier: {
        type: String,
        enum: ["COMMON", "RARE", "EPIC", "LEGENDARY", "MYTHIC"],
        default: "COMMON"
    },
    price: { type: Number, default: 0 }, // Cost in Coins for rent/buy
    isAnimated: { type: Boolean, default: false },
    tags: [String],
    author: [String],
    packId: [String],
    clanId: { type: String, default: null }, // ⚡️ Added clanId reference
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.Sticker || mongoose.model("Sticker", StickerSchema);
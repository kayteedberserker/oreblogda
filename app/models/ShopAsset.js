import mongoose from "mongoose";

const ShopAssetSchema = new mongoose.Schema({
    assetId: { type: String, required: true, unique: true }, // e.g., "bg_cyberpunk_01"
    name: { type: String, required: true }, // e.g., "Cyberpunk Night"
    category: {
        type: String,
        required: true,
        enum: ['sticker', 'background', 'watermark', 'frame']
    },
    rarity: { type: String, default: 'COMMON' },
    url: { type: String, required: true }, // Cloudinary WebP URL

    // Market Data
    type: { type: String, enum: ['free', 'event', 'rent'], default: 'free' },
    price: { type: Number, default: 0 },
    author: { type: String },
    packId: { type: String },
    tags: [{ type: String }],

    // The "How it looks" config
    visualConfig: {
        opacity: { type: Number, default: 1 },
        scale: { type: Number, default: 1 },
        rotation: { type: String, default: "0deg" },
        offsetY: { type: Number, default: 0 },
        isAnimated: { type: Boolean, default: false }
    },
    createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.ShopAsset || mongoose.model("ShopAsset", ShopAssetSchema);
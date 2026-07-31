import mongoose from "mongoose";

const ShopAssetSchema = new mongoose.Schema(
    {
        assetId: {
            type: String,
            required: true,
            unique: true,
            trim: true,
            index: true,
        },

        name: {
            type: String,
            required: true,
            trim: true,
        },

        category: {
            type: String,
            required: true,
            enum: [
                "background",
                "watermark",
                "frame",
                "avatar_vfx",
            ],
            index: true,
        },

        rarity: {
            type: String,
            enum: [
                "COMMON",
                "RARE",
                "EPIC",
                "LEGENDARY",
                "MYTHIC",
            ],
            default: "COMMON",
            index: true,
        },

        url: {
            type: String,
            required: true,
            trim: true,
        },

        // Whether the uploaded file itself is animated.
        isAnimated: {
            type: Boolean,
            default: false,
        },

        // Market data
        type: {
            type: String,
            enum: [
                "free",
                "event",
                "rent",
                "player",
                "clan",
            ],
            default: "free",
            index: true,
        },

        price: {
            type: Number,
            default: 0,
            min: 0,
        },

        author: {
            type: String,
            trim: true,
            default: "",
        },

        packId: {
            type: String,
            trim: true,
            default: "",
            index: true,
        },

        tags: {
            type: [String],
            default: [],
        },

        // Used when type === "clan"
        clanId: {
            type: String,
            trim: true,
            default: null,
            index: true,
        },

        // Background and watermark display configuration
        visualConfig: {
            opacity: {
                type: Number,
                default: 1,
                min: 0,
                max: 1,
            },

            scale: {
                type: Number,
                default: 1,
                min: 0,
            },

            rotation: {
                type: String,
                default: "0deg",
            },

            offsetY: {
                type: Number,
                default: 0,
            },
        },

        // Source sprite-sheet and generated animation information
        vfxConfig: {
            columns: {
                type: Number,
                min: 1,
            },

            rows: {
                type: Number,
                min: 1,
            },

            fps: {
                type: Number,
                min: 1,
                max: 30,
            },

            frameCount: {
                type: Number,
                min: 2,
            },

            // Milliseconds shown per animation frame.
            delay: {
                type: Number,
                min: 20,
            },
        },
    },
    {
        timestamps: true,
    }
);

export default mongoose.models.ShopAsset ||
    mongoose.model("ShopAsset", ShopAssetSchema);
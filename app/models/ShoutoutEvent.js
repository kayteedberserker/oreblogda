import mongoose from "mongoose";

const ShoutoutEventSchema = new mongoose.Schema({
    // 🏛️ Faction ownership
    clanId: { type: String, required: true, index: true },
    clanName: { type: String, required: true },
    leaderDeviceId: { type: String, required: true },

    // 🛡️ Staff Permissions Layer
    moderatedBy: [{ type: String }],

    // 📝 Primary Metadata
    title: { type: String, required: true }, // e.g., "GOING LIVE ON TIKTOK IN 10 MINS"
    description: { type: String, required: true }, // Details regarding the event / check-in
    externalLink: { type: String, default: null }, // Redirect straight to TikTok, Twitch, etc.

    // 🖼️ Media Element Matrix (Holds an image or promo trailer clip)
    media: {
        url: { type: String, default: null },
        type: { type: String, enum: ["image", "video", null], default: null }
    },
    visibility: { type: String, enum: ["PUBLIC", "PRIVATE"], default: "PUBLIC", index: true },
    // ⏱️ Auto-Decay Matrix
    expiresAt: {
        type: Date,
        required: true,
        index: { expires: 0 }
    },

    // 🛰️ Network Check-In / Acknowledge Engine
    acknowledgeCount: { type: Number, default: 0 },
    acknowledgedBy: [{ type: String }] // Array of user deviceIds to prevent spam check-ins
}, { timestamps: true });

export default mongoose.models.ShoutoutEvent || mongoose.model("ShoutoutEvent", ShoutoutEventSchema);
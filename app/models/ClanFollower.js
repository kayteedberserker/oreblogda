// app/models/ClanFollower.js
import mongoose from 'mongoose';

const clanFollowerSchema = new mongoose.Schema({
    clanTag: { type: String, required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'MobileUser', required: true },
    followedAt: { type: Date, default: Date.now }
}, { timestamps: true });

// Ensure a user can't follow the same clan twice
clanFollowerSchema.index({ clanTag: 1, userId: 1 }, { unique: true });

export default mongoose.models.ClanFollower || mongoose.model('ClanFollower', clanFollowerSchema);
import mongoose from 'mongoose';


const HypeLogSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'MobileUser', required: true },
    postId: { type: mongoose.Schema.Types.ObjectId, ref: 'Post', required: true },
    hypeType: { type: String, required: true }, // 'FREE', 'STANDARD', 'SUPER', 'MEGA'
    points: { type: Number, required: true },
    source: { type: String, enum: ['PURCHASE', 'INVENTORY'], required: true }, // Track where it came from
    createdAt: { type: Date, default: Date.now }
});

export default mongoose.models.HypeLog || mongoose.model('HypeLog', HypeLogSchema);
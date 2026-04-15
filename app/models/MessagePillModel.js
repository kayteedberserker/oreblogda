import mongoose from 'mongoose';

const MessagePillSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        maxlength: 150
    },
    type: {
        type: String,
        enum: ['system', 'event', 'achievement', 'drop', 'warning', 'aura_gain', 'clan_points', 'post_like', 'post_comment', 'post_reply', 'clan_post', 'clan_message'],
        default: 'system'
    },
    link: {
        type: String,
        default: null
    },
    targetAudience: {
        type: String,
        enum: ['global', 'clan', 'user'],
        default: 'global'
    },
    targetId: {
        type: String,
        default: null
    },
    groupId: {
        type: String,
        default: null
    },
    priority: {
        type: Number,
        default: 0
    },
    isActive: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        default: null
    },

}, { timestamps: true });

export default mongoose.models.MessagePill || mongoose.model('MessagePill', MessagePillSchema);
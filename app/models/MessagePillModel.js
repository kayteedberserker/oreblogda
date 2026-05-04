import mongoose from 'mongoose';

const MessagePillSchema = new mongoose.Schema({
    text: {
        type: String,
        required: true,
        maxlength: 150
    },
    type: {
        type: String,
        enum: ['system', 'event', 'achievement', 'post_vote', 'drop', 'warning', 'post_rejection', 'aura_gain', 'clan_points', 'post_like', 'post_comment', 'post_discussion', 'post_reply', 'clan_post', 'clan_message', 'clan_alert', 'clan_request'],
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
        default: null,
        index: { expires: 0 }
    },

}, { timestamps: true });

export default mongoose.models.MessagePill || mongoose.model('MessagePill', MessagePillSchema);
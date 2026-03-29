import mongoose from 'mongoose';

const MessagePillSchema = new mongoose.Schema({
    text: { 
        type: String, 
        required: true, 
        maxlength: 150 
    },
    type: { 
        type: String, 
        // ⚡️ ADDED: 'aura_gain' and 'clan_points'
        enum: ['system', 'event', 'achievement', 'drop', 'warning', 'aura_gain', 'clan_points'], 
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
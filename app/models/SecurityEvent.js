import mongoose from 'mongoose';

const securityEventSchema = new mongoose.Schema({
    eventType: {
        type: String,
        required: true,
        // You can add more event types here as your security system grows
        enum: [
            'HARDWARE_LIMIT_WARNING',
            'FAILED_PIN_ATTEMPT',
            'SUSPICIOUS_IP',
            'ACCOUNT_LOCKOUT'
        ]
    },
    severity: {
        type: String,
        enum: ['low', 'moderate', 'high', 'critical'],
        default: 'moderate'
    },
    hardwareId: {
        type: String,
        index: true // Indexed for faster queries when building your admin dashboard
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'MobileUser',
        index: true
    },
    username: {
        type: String
    },
    ipAddress: {
        type: String
    },
    message: {
        type: String,
        required: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed // Allows you to store flexible JSON data (e.g., associatedAccountsCount)
    },
    createdAt: {
        type: Date,
        default: Date.now,
        expires: '90d' // TTL Index: MongoDB will automatically delete these logs after 90 days to prevent database bloat
    }
});

// Ensure the model isn't compiled multiple times in serverless environments (like Next.js)
const SecurityEvent = mongoose.models.SecurityEvent || mongoose.model('SecurityEvent', securityEventSchema);

export default SecurityEvent;
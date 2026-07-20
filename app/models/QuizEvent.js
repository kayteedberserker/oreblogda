import mongoose from "mongoose";

const QuizEventSchema = new mongoose.Schema({
    clanId: { type: String, required: true, index: true },
    clanName: { type: String, required: true },
    leaderDeviceId: { type: String, required: true },
    moderatedBy: [{ type: String }],

    title: { type: String, required: true },
    description: { type: String, required: true },
    visibility: { type: String, enum: ["PUBLIC", "PRIVATE"], default: "PUBLIC" },

    status: { type: String, enum: ["COMING_SOON", "LIVE", "COMPLETED", "CANCELLED"], default: "COMING_SOON" },
    scheduledStartTime: { type: Date, required: true },
    startedAt: { type: Date, default: null },
    endsAt: { type: Date, default: null },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },

    acknowledgeCount: { type: Number, default: 0 },
    acknowledgedBy: [{ type: String }],

    deliveryMode: { type: String, enum: ["BATCH", "STREAMED"], default: "BATCH" },
    streamGapMinutes: { type: Number, default: null },
    currentStreamIndex: { type: Number, default: 0 },
    maxQuestions: { type: Number, default: 30, max: 30 },

    // ⚡️ UPDATED: Added imageUrl field to question configuration
    quizQuestions: [{
        questionText: String,
        imageUrl: { type: String, default: null },
        options: [String],
        correctOptionIndex: Number,
        releasedAt: { type: Date, default: null }
    }],

    leaderboard: [{
        deviceId: String,
        username: String,
        score: { type: Number, default: 0 },
        answeredQuestionIndexes: [{ type: Number }],
        // ⚡️ NEW: Tracks exactly what they answered
        responses: [{
            questionIndex: Number,
            selectedOptionIndex: Number,
            isCorrect: Boolean
        }]
    }],

    participants: [{
        deviceId: { type: String, required: true },
        username: { type: String, required: true },
        registeredAt: { type: Date, default: Date.now }
    }],
    blacklistedDeviceIds: [{ type: String }]
}, { timestamps: true });

export default mongoose.models.QuizEvent || mongoose.model("QuizEvent", QuizEventSchema);
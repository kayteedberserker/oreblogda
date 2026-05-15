import mongoose from "mongoose";

const quizProgressSchema = new mongoose.Schema(
    {
        uid: { type: String, required: true, index: true },
        eventId: { type: String, required: true, index: true },
        date: { type: String, required: true, index: true },
        hintsUsed: { type: Number, default: 0 },
        attemptsLeft: { type: Number, default: 3 },
        completed: { type: Boolean, default: false },
        isCorrect: { type: Boolean, default: false },
        finalReward: { type: Number, default: 0 },
        lastHintAt: { type: Date },
        lastAnswerAt: { type: Date },
        createdAt: { type: Date, default: Date.now },
        updatedAt: { type: Date, default: Date.now }
    },
    { timestamps: true }
);

const QuizProgress = mongoose.models.QuizProgress || mongoose.model("QuizProgress", quizProgressSchema);

export default QuizProgress;

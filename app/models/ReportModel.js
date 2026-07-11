import mongoose from "mongoose";

const reportSchema = new mongoose.Schema(
    {
        targetId: {
            type: mongoose.Schema.Types.ObjectId,
            required: true,
            index: true
        },
        targetPostId: {
            type: mongoose.Schema.Types.ObjectId,
            index: true
        },
        targetType: {
            type: String,
            enum: ["post", "comment", "user", "clan"],
            required: true
        },
        reporterFingerprint: {
            type: String,
            required: true
        },
        reporterUserId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MobileUser",
            default: null
        },
        reason: {
            type: String,
            required: true
        },
        status: {
            type: String,
            enum: ["pending", "reviewed", "resolved"],
            default: "pending"
        },
        adminNotes: {
            type: String,
            default: ""
        }
    },
    { timestamps: true }
);

// Prevent duplicate reports from the same device for the exact same target
reportSchema.index({ targetId: 1, reporterFingerprint: 1 }, { unique: true });

const Report = mongoose.models.Report || mongoose.model("Report", reportSchema);
export default Report;
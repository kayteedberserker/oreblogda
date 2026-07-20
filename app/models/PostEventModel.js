import mongoose from "mongoose";

const postEventSchema = new mongoose.Schema({
    postId: {
        type: String,
        required: true,
        index: true
    },
    type: {
        type: String,
        required: true,
        enum: [
            "POST_REQUEST_RECEIVED",
            "POST_CREATED",
            "PRESIGNED_URL_GENERATED",
            "UPLOAD_STARTED",
            "UPLOAD_COMPLETED",
            "UPLOAD_FAILED",
            "FINALIZE_CALLED",
            "FINALIZE_SUCCESS",
            "FINALIZE_FAILED",
            "QUEUE_ADDED",
            "QUEUE_RETRY",
            "DUPLICATE_POST_DETECTED",
            "MEDIA_404",
            "POST_PUBLISHED",
            "AI_STARTED",
            "AI_COMPLETED"
        ]
    },
    message: String,
    metadata: mongoose.Schema.Types.Mixed,
    createdAt: {
        type: Date,
        default: Date.now,
        expires: "30d" // Auto-delete logs after 30 days to save database space
    }
});

const PostEvent = mongoose.models.PostEvent || mongoose.model("PostEvent", postEventSchema);
export default PostEvent;
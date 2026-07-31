import mongoose from "mongoose";

const FeedSessionSourceSchema =
    new mongoose.Schema(
        {
            type: {
                type: String,
                required: true,
            },
            reason: {
                type: String,
                default: null,
            },
            weight: {
                type: Number,
                default: 1,
            },
        },
        {
            _id: false,
        }
    );

const FeedSessionEntrySchema =
    new mongoose.Schema(
        {
            postId: {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Post",
                required: true,
            },
            sources: {
                type: [FeedSessionSourceSchema],
                default: [],
            },
        },
        {
            _id: false,
        }
    );

const FeedSessionSchema =
    new mongoose.Schema(
        {
            sessionId: {
                type: String,
                required: true,
                unique: true,
                index: true,
            },

            viewerKey: {
                type: String,
                required: true,
                index: true,
            },

            scopeKey: {
                type: String,
                required: true,
                default: "global",
                index: true,
            },

            deviceId: {
                type: String,
                default: null,
                index: true,
            },

            viewerId: {
                type: String,
                default: null,
                index: true,
            },

            algorithmVersion: {
                type: String,
                required: true,
                index: true,
            },

            entries: {
                type: [FeedSessionEntrySchema],
                default: [],
            },

            highestServedOffset: {
                type: Number,
                default: 0,
                min: 0,
            },

            createdAt: {
                type: Date,
                default: Date.now,
            },

            lastAccessedAt: {
                type: Date,
                default: Date.now,
            },

            expiresAt: {
                type: Date,
                required: true,
            },

            maxExpiresAt: {
                type: Date,
                required: true,
            },
        },
        {
            versionKey: false,
        }
    );

FeedSessionSchema.index(
    {
        expiresAt: 1,
    },
    {
        expireAfterSeconds: 0,
    }
);

FeedSessionSchema.index({
    viewerKey: 1,
    scopeKey: 1,
    algorithmVersion: 1,
    expiresAt: 1,
});

FeedSessionSchema.index({
    lastAccessedAt: 1,
});

export default (
    mongoose.models.FeedSession ||
    mongoose.model(
        "FeedSession",
        FeedSessionSchema
    )
);
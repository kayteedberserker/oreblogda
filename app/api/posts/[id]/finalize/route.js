import { finalizeAndPublishPost } from "@/app/api/posts/route";
import connectDB from "@/app/lib/mongodb";
import {
    assertFinalMediaMatchesPostPlan,
    verifyR2MediaObjects
} from "@/app/lib/r2UploadPipeline.server";
import MobileUser from "@/app/models/MobileUserModel";
import PostEvent from "@/app/models/PostEventModel";
import Post from "@/app/models/PostModel";
import { NextResponse } from "next/server";

async function logEvent(
    postId,
    type,
    message,
    metadata = {}
) {
    try {
        await PostEvent.create({
            postId: postId
                ? postId.toString()
                : "SYSTEM",
            type,
            message,
            metadata: {
                ...metadata,
                timestamp: new Date()
            }
        });
    } catch (_) { }
}

const normalizeFinalMedia = (media) => {
    if (!Array.isArray(media)) {
        return [];
    }

    return media
        .map((item, index) => ({
            url:
                typeof item?.url === "string"
                    ? item.url
                    : null,
            type:
                item?.type === "video"
                    ? "video"
                    : "image",
            order:
                Number.isFinite(
                    Number(item?.order)
                )
                    ? Number(item.order)
                    : index,
            r2Key:
                typeof item?.r2Key ===
                    "string"
                    ? item.r2Key
                    : null,
            mimeType:
                typeof item?.mimeType ===
                    "string"
                    ? item.mimeType
                    : null,
            extension:
                typeof item?.extension ===
                    "string"
                    ? item.extension
                    : null,
            expectedSize:
                Number.isFinite(
                    Number(
                        item?.expectedSize
                    )
                ) &&
                    Number(
                        item.expectedSize
                    ) > 0
                    ? Number(
                        item.expectedSize
                    )
                    : 0
        }))
        .filter((item) => item.url)
        .sort(
            (a, b) =>
                a.order - b.order
        );
};

export async function POST(
    req,
    { params }
) {
    await connectDB();

    const resolvedParams =
        await params;
    const postId =
        resolvedParams?.id;

    let lockAcquired = false;
    let mediaVerified = false;

    try {
        if (!postId) {
            return NextResponse.json(
                {
                    message:
                        "Post ID is required."
                },
                { status: 400 }
            );
        }

        const body =
            await req.json();

        const isEdit =
            Boolean(body?.isEdit);

        const media =
            normalizeFinalMedia(
                body?.media
            );

        if (
            !Array.isArray(
                body?.media
            ) ||
            media.length !==
            body.media.length
        ) {
            return NextResponse.json(
                {
                    message:
                        "Invalid media payload."
                },
                { status: 400 }
            );
        }

        const fingerprint =
            req.headers.get(
                "x-user-deviceId"
            ) ||
            req.headers.get(
                "x-device-id"
            );

        if (!fingerprint) {
            return NextResponse.json(
                {
                    message:
                        "Unauthorized."
                },
                { status: 401 }
            );
        }

        const [post, user] =
            await Promise.all([
                Post.findById(
                    postId
                ),
                MobileUser.findOne({
                    deviceId:
                        fingerprint
                }).select(
                    "_id deviceId"
                )
            ]);

        if (!post) {
            return NextResponse.json(
                {
                    message:
                        "Post not found."
                },
                { status: 404 }
            );
        }

        if (
            !user ||
            String(
                post.authorUserId
            ) !== String(user._id)
        ) {
            return NextResponse.json(
                {
                    message:
                        "Forbidden."
                },
                { status: 403 }
            );
        }

        if (
            !isEdit &&
            ["approved", "rejected"].includes(
                post.status
            )
        ) {
            return NextResponse.json(
                {
                    success: true,
                    alreadyFinalized:
                        true,
                    post
                },
                { status: 200 }
            );
        }

        try {
            assertFinalMediaMatchesPostPlan(
                post,
                media
            );
        } catch (error) {
            await logEvent(
                postId,
                "FINALIZE_REJECTED",
                "Client media did not match the saved upload plan.",
                {
                    error:
                        error?.message
                }
            );

            return NextResponse.json(
                {
                    code:
                        "MEDIA_PLAN_MISMATCH",
                    message:
                        error?.message ||
                        "Media does not match the saved upload plan."
                },
                { status: 400 }
            );
        }

        const verification =
            await verifyR2MediaObjects(
                postId,
                media
            );

        if (!verification.ok) {
            await logEvent(
                postId,
                "FINALIZE_DEFERRED",
                "R2 media verification failed.",
                {
                    failed:
                        verification.failed
                }
            );

            post.uploadStatus =
                "failed";
            post.moderationStatus =
                "pending";
            post.status = isEdit
                ? "pending_media"
                : "pending";
            await post.save();

            return NextResponse.json(
                {
                    code:
                        "MEDIA_NOT_READY",
                    message:
                        "One or more media files are missing, incomplete, or have the wrong content type.",
                    failed:
                        verification.failed,
                    retryable: true
                },
                { status: 409 }
            );
        }

        mediaVerified = true;

        // Atomic moderation/finalization lock.
        const lockedPost =
            await Post.findOneAndUpdate(
                {
                    _id: postId,
                    moderationStatus: {
                        $ne: "processing"
                    }
                },
                {
                    $set: {
                        moderationStatus:
                            "processing",
                        moderationStatusChangedAt:
                            new Date(),
                        uploadStatus:
                            "finalizing",
                        uploadStatusChangedAt:
                            new Date()
                    }
                },
                { new: true }
            );

        if (!lockedPost) {
            const currentPost =
                await Post.findById(
                    postId
                );

            if (
                currentPost &&
                ["approved", "rejected"].includes(
                    currentPost.status
                )
            ) {
                return NextResponse.json(
                    {
                        success: true,
                        alreadyFinalized:
                            true,
                        post:
                            currentPost
                    },
                    { status: 200 }
                );
            }

            return NextResponse.json(
                {
                    success: true,
                    processing: true,
                    message:
                        "This post is already being finalized."
                },
                { status: 202 }
            );
        }

        lockAcquired = true;

        lockedPost.media = media;
        lockedPost.mediaUrl =
            media[0]?.url ?? null;
        lockedPost.mediaType =
            media[0]?.type ?? null;
        lockedPost.totalFilesExpected =
            media.length;
        await lockedPost.save();

        await logEvent(
            postId,
            "UPLOAD_COMPLETED",
            "All R2 objects verified; finalize execution requested.",
            {
                isEdit,
                mediaCount:
                    media.length,
                verification:
                    verification.results
            }
        );

        const evaluation =
            await finalizeAndPublishPost(
                lockedPost._id,
                true,
                lockedPost.country ||
                "Global",
                lockedPost.authorId ||
                fingerprint,
                isEdit,
                {
                    lockAlreadyAcquired:
                        true
                }
            );

        return NextResponse.json(
            {
                success: true,
                message:
                    evaluation?.message ||
                    "Post finalized.",
                post:
                    evaluation?.post ||
                    lockedPost,
                isFirstPost:
                    evaluation?.isFirstPost ||
                    false,
                auraStats:
                    evaluation?.auraStats ||
                    null,
                alreadyFinalized:
                    Boolean(
                        evaluation
                            ?.alreadyFinalized
                    )
            },
            { status: 200 }
        );
    } catch (error) {
        console.error(
            "R2 Finalize Processing Failure:",
            error
        );

        if (
            lockAcquired &&
            postId
        ) {
            await Post.findByIdAndUpdate(
                postId,
                {
                    $set: {
                        moderationStatus:
                            "pending",
                        uploadStatus:
                            mediaVerified
                                ? "uploaded"
                                : "failed"
                    }
                }
            ).catch(
                () => undefined
            );
        }

        await logEvent(
            postId,
            "FINALIZE_FAILED",
            "Finalize route crashed.",
            {
                error:
                    error?.message
            }
        );

        return NextResponse.json(
            {
                message:
                    "Internal Error Finalizing Post",
                retryable: true
            },
            { status: 500 }
        );
    }
}
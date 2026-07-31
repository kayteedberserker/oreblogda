import connectDB from "@/app/lib/mongodb";
import {
    buildR2UploadPlan,
    normalizeMediaDescriptors
} from "@/app/lib/r2UploadPipeline.server";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel";
import { NextResponse } from "next/server";
import { finalizeAndPublishPost } from "../../route";

const normalizeExistingMedia = (media) => {
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
                typeof item?.r2Key === "string"
                    ? item.r2Key
                    : null,
            mimeType:
                typeof item?.mimeType === "string"
                    ? item.mimeType
                    : null,
            extension:
                typeof item?.extension === "string"
                    ? item.extension
                    : null,
            expectedSize:
                Number.isFinite(
                    Number(item?.expectedSize)
                ) &&
                    Number(item.expectedSize) > 0
                    ? Number(item.expectedSize)
                    : 0
        }))
        .filter((item) => item.url)
        .sort((a, b) => a.order - b.order);
};

const normalizePollOptions = (pollOptions) =>
    Array.isArray(pollOptions)
        ? pollOptions
            .map((option) =>
                typeof option === "string"
                    ? option.trim()
                    : String(
                        option?.text || ""
                    ).trim()
            )
            .filter(Boolean)
        : [];

export async function PATCH(
    req,
    { params }
) {
    await connectDB();

    try {
        const resolvedParams =
            await params;
        const postId =
            resolvedParams?.id;
        const body =
            await req.json();

        const {
            title,
            message,
            hasPoll,
            pollMultiple,
            pollOptions,
            category,
            clanId,
            existingMedia,
            newMedia,
            newMediaCount,
            useR2,
            requestId
        } = body;

        if (!postId) {
            return NextResponse.json(
                {
                    message:
                        "Post ID is required."
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

        const userDoc =
            fingerprint
                ? await MobileUser.findOne({
                    deviceId:
                        fingerprint
                })
                : null;

        if (!userDoc) {
            return NextResponse.json(
                {
                    message:
                        "Unauthorized"
                },
                { status: 401 }
            );
        }

        const post =
            await Post.findById(postId);

        if (!post) {
            return NextResponse.json(
                {
                    message:
                        "Post not found"
                },
                { status: 404 }
            );
        }

        if (
            String(post.authorUserId) !==
            String(userDoc._id)
        ) {
            return NextResponse.json(
                {
                    message:
                        "Forbidden: You do not own this post."
                },
                { status: 403 }
            );
        }

        if (
            typeof title !== "string" ||
            !title.trim() ||
            typeof message !== "string" ||
            !message.trim()
        ) {
            return NextResponse.json(
                {
                    message:
                        "Title and message are required."
                },
                { status: 400 }
            );
        }

        post.title = title.trim();
        post.message = message.trim();

        if (
            typeof category === "string" &&
            category.trim()
        ) {
            post.category =
                category.trim();
        }

        if (clanId !== undefined) {
            post.clanId =
                clanId || null;
        }

        if (hasPoll !== undefined) {
            const normalizedOptions =
                normalizePollOptions(
                    pollOptions
                );

            if (
                hasPoll &&
                normalizedOptions.length < 2
            ) {
                return NextResponse.json(
                    {
                        message:
                            "Polls require at least two completed options."
                    },
                    { status: 400 }
                );
            }

            post.poll = hasPoll
                ? {
                    pollMultiple:
                        Boolean(
                            pollMultiple
                        ),
                    options:
                        normalizedOptions.map(
                            (text) => ({
                                text,
                                votes: 0
                            })
                        )
                }
                : null;
        }

        const keptMedia =
            normalizeExistingMedia(
                existingMedia
            );

        const requestedNewCount =
            Math.max(
                0,
                Number(newMediaCount) ||
                0
            );

        let newDescriptors;

        try {
            newDescriptors =
                normalizeMediaDescriptors(
                    newMedia || []
                );
        } catch (error) {
            return NextResponse.json(
                {
                    message:
                        error?.message ||
                        "Invalid new media descriptors."
                },
                { status: 400 }
            );
        }

        if (
            requestedNewCount !==
            newDescriptors.length
        ) {
            return NextResponse.json(
                {
                    message:
                        "New media count does not match its descriptors."
                },
                { status: 400 }
            );
        }

        if (
            keptMedia.length +
            requestedNewCount >
            15
        ) {
            return NextResponse.json(
                {
                    message:
                        "A post can contain at most 15 media files."
                },
                { status: 400 }
            );
        }

        // ------------------------------------------------------------
        // Edit with new local files
        // ------------------------------------------------------------
        if (requestedNewCount > 0) {
            if (!useR2) {
                return NextResponse.json(
                    {
                        message:
                            "This client must use the R2 upload pipeline."
                    },
                    { status: 400 }
                );
            }

            const safeRequestId =
                String(
                    requestId ||
                    Date.now()
                )
                    .replace(
                        /[^a-zA-Z0-9_-]/g,
                        "_"
                    )
                    .slice(0, 100);

            const plan =
                await buildR2UploadPlan({
                    postId:
                        post._id,
                    descriptors:
                        newDescriptors,
                    keyPrefix:
                        `edit_${safeRequestId}`
                });

            post.status =
                "pending_media";
            post.uploadStatus =
                "pending";
            post.moderationStatus =
                "pending";

            post.media = [
                ...keptMedia,
                ...plan.media
            ].sort(
                (a, b) =>
                    (a.order || 0) -
                    (b.order || 0)
            );

            post.mediaUrl =
                post.media[0]?.url ??
                null;
            post.mediaType =
                post.media[0]?.type ??
                null;
            post.totalFilesExpected =
                post.media.length;

            await post.save();

            return NextResponse.json(
                {
                    message:
                        "Post updated. Awaiting new media assets.",
                    post,
                    signData:
                        plan.signData
                },
                { status: 200 }
            );
        }

        // ------------------------------------------------------------
        // Text-only edit, reordering, or deleting existing media
        // ------------------------------------------------------------
        post.media = keptMedia;
        post.mediaUrl =
            keptMedia[0]?.url ??
            null;
        post.mediaType =
            keptMedia[0]?.type ??
            null;
        post.totalFilesExpected =
            keptMedia.length;
        post.status = "pending";
        post.uploadStatus =
            "uploaded";
        post.moderationStatus =
            "pending";

        await post.save();

        const country =
            req.headers.get(
                "x-user-country"
            ) ||
            post.country ||
            "Global";

        const evaluation =
            await finalizeAndPublishPost(
                post._id,
                true,
                country,
                post.authorId ||
                fingerprint,
                true
            );

        return NextResponse.json(
            {
                message:
                    evaluation?.message ||
                    "Post updated and re-evaluated.",
                post:
                    evaluation?.post ||
                    post
            },
            { status: 200 }
        );
    } catch (error) {
        console.error(
            "PATCH error:",
            error
        );

        return NextResponse.json(
            {
                message:
                    error?.message ||
                    "Server error",
                retryable: true
            },
            { status: 500 }
        );
    }
}
import {
    HeadObjectCommand,
    PutObjectCommand,
    S3Client
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY
    }
});

const MAX_MEDIA_FILES = 15;

const MIME_TO_EXTENSION = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "video/mp4": "mp4",
    "video/quicktime": "mov",
    "video/webm": "webm",
    "video/x-matroska": "mkv"
};

const EXTENSION_TO_MIME = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    gif: "image/gif",
    heic: "image/heic",
    heif: "image/heif",
    mp4: "video/mp4",
    mov: "video/quicktime",
    webm: "video/webm",
    mkv: "video/x-matroska"
};

const ALLOWED_EXTENSIONS = new Set(Object.keys(EXTENSION_TO_MIME));

const cleanMimeType = (value) =>
    String(value || "")
        .toLowerCase()
        .split(";")[0]
        .trim();

const cleanExtension = (value) =>
    String(value || "")
        .toLowerCase()
        .split("?")[0]
        .replace(/^\./, "")
        .replace(/[^a-z0-9]/g, "");

const normalizeDescriptor = (item, index) => {
    const suppliedMimeType = cleanMimeType(item?.mimeType);
    const extensionFromMime = MIME_TO_EXTENSION[suppliedMimeType];

    let type =
        suppliedMimeType.startsWith("video/")
            ? "video"
            : suppliedMimeType.startsWith("image/")
                ? "image"
                : item?.type === "video"
                    ? "video"
                    : "image";

    let extension = cleanExtension(
        extensionFromMime || item?.extension
    );

    if (!ALLOWED_EXTENSIONS.has(extension)) {
        extension = type === "video" ? "mp4" : "jpg";
    }

    if (extension === "jpeg") {
        extension = "jpg";
    }

    const mimeType =
        EXTENSION_TO_MIME[extension] ||
        (type === "video" ? "video/mp4" : "image/jpeg");

    type = mimeType.startsWith("video/") ? "video" : "image";

    const expectedSize = Number(
        item?.size ?? item?.expectedSize ?? 0
    );

    return {
        type,
        order: Number.isFinite(Number(item?.order))
            ? Number(item.order)
            : index,
        mimeType,
        extension,
        expectedSize:
            Number.isFinite(expectedSize) && expectedSize > 0
                ? expectedSize
                : 0,
        fileName:
            typeof item?.fileName === "string"
                ? item.fileName.slice(0, 180)
                : null
    };
};

export const normalizeMediaDescriptors = (input) => {
    if (!Array.isArray(input)) {
        return [];
    }

    if (input.length > MAX_MEDIA_FILES) {
        throw new Error(
            `A maximum of ${MAX_MEDIA_FILES} media files is allowed.`
        );
    }

    return input.map(normalizeDescriptor);
};

export async function buildR2UploadPlan({
    postId,
    descriptors,
    keyPrefix = "file"
}) {
    const normalized = normalizeMediaDescriptors(descriptors);
    const safePrefix = String(keyPrefix || "file")
        .replace(/[^a-zA-Z0-9_-]/g, "_")
        .slice(0, 120);

    const signData = [];
    const media = [];

    for (let index = 0; index < normalized.length; index += 1) {
        const descriptor = normalized[index];
        const objectKey =
            `posts/${String(postId)}/${safePrefix}_${index}.${descriptor.extension}`;

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: objectKey,
            ContentType: descriptor.mimeType
        });

        const uploadUrl = await getSignedUrl(
            r2Client,
            command,
            { expiresIn: 6 * 60 * 60 }
        );

        const publicUrl =
            `https://media.oreblogda.com/${objectKey}`;

        signData.push({
            engine: "r2",
            uploadUrl,
            objectKey,
            publicUrl,
            contentType: descriptor.mimeType,
            type: descriptor.type,
            extension: descriptor.extension,
            order: descriptor.order,
            expectedSize: descriptor.expectedSize
        });

        media.push({
            url: publicUrl,
            type: descriptor.type,
            order: descriptor.order,
            r2Key: objectKey,
            mimeType: descriptor.mimeType,
            extension: descriptor.extension,
            expectedSize: descriptor.expectedSize
        });
    }

    return { signData, media };
}

export async function rebuildR2UploadPlanForPost(
    post,
    fallbackDescriptors = []
) {
    const existingDescriptors = Array.isArray(post?.media)
        ? post.media.map((item, index) => ({
            type: item?.type,
            order: item?.order ?? index,
            mimeType: item?.mimeType,
            extension:
                item?.extension ||
                String(item?.r2Key || "").split(".").pop(),
            expectedSize: item?.expectedSize
        }))
        : [];

    const descriptors =
        existingDescriptors.length > 0
            ? existingDescriptors
            : fallbackDescriptors;

    if (
        Number(post?.totalFilesExpected || 0) > 0 &&
        descriptors.length !== Number(post.totalFilesExpected)
    ) {
        throw new Error(
            "The saved upload plan is incomplete. Retry with the original draft."
        );
    }

    return buildR2UploadPlan({
        postId: post._id,
        descriptors,
        keyPrefix: "file"
    });
}

export function assertMediaBelongsToPost(postId, media) {
    const prefix = `posts/${String(postId)}/`;

    for (const item of media || []) {
        if (!item?.r2Key) {
            continue;
        }

        if (!String(item.r2Key).startsWith(prefix)) {
            throw new Error(
                "Media payload contains an invalid storage key."
            );
        }
    }
}

const getMediaIdentity = (item) =>
    item?.r2Key
        ? `r2:${String(item.r2Key)}`
        : item?.url
            ? `url:${String(item.url)}`
            : null;

export function assertFinalMediaMatchesPostPlan(post, submittedMedia) {
    if (!Array.isArray(submittedMedia)) {
        throw new Error("Invalid final media payload.");
    }

    const plannedMedia = Array.isArray(post?.media)
        ? post.media
        : [];

    const expectedCount = Number(post?.totalFilesExpected || 0);

    if (
        expectedCount > 0 &&
        submittedMedia.length !== expectedCount
    ) {
        throw new Error(
            "The final media count does not match the saved upload plan."
        );
    }

    const plannedIdentities = new Set(
        plannedMedia.map(getMediaIdentity).filter(Boolean)
    );

    const submittedIdentities = submittedMedia
        .map(getMediaIdentity)
        .filter(Boolean);

    if (
        submittedIdentities.length !== submittedMedia.length ||
        new Set(submittedIdentities).size !== submittedIdentities.length
    ) {
        throw new Error(
            "The final media payload contains missing or duplicate items."
        );
    }

    for (const identity of submittedIdentities) {
        if (!plannedIdentities.has(identity)) {
            throw new Error(
                "The final media payload does not match the server upload plan."
            );
        }
    }

    if (
        plannedIdentities.size > 0 &&
        submittedIdentities.length !== plannedIdentities.size
    ) {
        throw new Error(
            "One or more planned media items are missing."
        );
    }

    assertMediaBelongsToPost(post?._id, submittedMedia);
}

export async function verifyR2MediaObjects(postId, media) {
    assertMediaBelongsToPost(postId, media);

    const results = await Promise.all(
        (media || []).map(async (item, index) => {
            if (!item?.r2Key) {
                // Existing Cloudinary/legacy assets do not need R2 verification.
                return {
                    index,
                    verified: true,
                    skipped: true
                };
            }

            try {
                const head = await r2Client.send(
                    new HeadObjectCommand({
                        Bucket: process.env.R2_BUCKET_NAME,
                        Key: item.r2Key
                    })
                );

                const contentLength = Number(
                    head.ContentLength || 0
                );

                if (
                    !Number.isFinite(contentLength) ||
                    contentLength <= 0
                ) {
                    return {
                        index,
                        verified: false,
                        reason: "empty_object"
                    };
                }

                const expectedSize = Number(
                    item.expectedSize || 0
                );

                if (
                    expectedSize > 0 &&
                    contentLength !== expectedSize
                ) {
                    return {
                        index,
                        verified: false,
                        reason: "size_mismatch",
                        expectedSize,
                        contentLength
                    };
                }

                const expectedMimeType = cleanMimeType(
                    item.mimeType
                );
                const actualMimeType = cleanMimeType(
                    head.ContentType
                );

                if (
                    expectedMimeType &&
                    actualMimeType &&
                    expectedMimeType !== actualMimeType
                ) {
                    return {
                        index,
                        verified: false,
                        reason: "content_type_mismatch",
                        expectedMimeType,
                        actualMimeType
                    };
                }

                return {
                    index,
                    verified: true,
                    contentLength,
                    contentType: head.ContentType || null,
                    etag: head.ETag || null
                };
            } catch (error) {
                return {
                    index,
                    verified: false,
                    reason:
                        error?.name ||
                        error?.Code ||
                        "head_failed"
                };
            }
        })
    );

    const failed = results.filter(
        (result) => !result.verified
    );

    return {
        ok: failed.length === 0,
        results,
        failed
    };
}
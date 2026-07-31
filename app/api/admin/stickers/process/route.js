import connectDB from "@/app/lib/mongodb";
import ShopAsset from "@/app/models/ShopAsset";
import Sticker from "@/app/models/StickerModel";
import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

export const runtime = "nodejs";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const PYTHON_CMD = process.platform === "win32" ? "python" : "python3";

const MAX_FILES_PER_REQUEST = 20;
const MAX_FILE_SIZE = 20 * 1024 * 1024;
const MAX_VFX_FRAMES = 60;

const TRANSPARENT_BACKGROUND = {
    r: 0,
    g: 0,
    b: 0,
    alpha: 0,
};

/**
 * Creates a predictable public ID from the asset metadata.
 */
const generateId = (category, packId, author, fileName) => {
    const safePack = (packId || "pack").replace(/[^a-zA-Z0-9]/g, "");
    const safeAuthor = (author || "anon").replace(/[^a-zA-Z0-9]/g, "");
    const safeFile = path
        .parse(fileName || "asset")
        .name
        .replace(/[^a-zA-Z0-9]/g, "");

    const prefix =
        category === "sticker"
            ? ""
            : category === "background"
                ? "bg_"
                : category === "watermark"
                    ? "wm_"
                    : category === "avatar_vfx"
                        ? "vfx_"
                        : "asset_";

    return `${prefix}${safePack}_${safeAuthor}_${safeFile}`.toLowerCase();
};

/**
* Ensures the custom public ID is unique in MongoDB.
*/
const ensureUniqueId = async (baseId, TargetModel, idField) => {
    let currentId = baseId;

    while (await TargetModel.exists({ [idField]: currentId })) {
        const randomSuffix = crypto.randomBytes(3).toString("hex");
        currentId = `${baseId}_${randomSuffix}`;
    }

    return currentId;
};

/**
* Convert unknown values from FormData JSON into strict booleans.
*/
const toBoolean = (value) => {
    return value === true || value === "true";
};

/**
* Strict numeric parser with bounds.
*/
const parseBoundedInteger = (
    value,
    {
        name,
        min,
        max,
        fallback,
    }
) => {
    const parsed =
        value === undefined || value === null || value === ""
            ? fallback
            : Number(value);

    if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
        throw new Error(
            `${name} must be an integer between ${min} and ${max}.`
        );
    }

    return parsed;
};

/**
* Run the Python rembg script.
*
* Input and output are file paths. The Python script should always output
* a transparent PNG, even when the original file is JPEG or WebP.
*/
function removeBackground(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        let stderr = "";
        let settled = false;

        const child = spawn(
            PYTHON_CMD,
            ["scripts/remove_bg.py", inputPath, outputPath],
            {
                cwd: process.cwd(),
                stdio: ["ignore", "ignore", "pipe"],
            }
        );

        const finish = (callback) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeoutId);
            callback();
        };

        const timeoutId = setTimeout(() => {
            child.kill("SIGKILL");

            finish(() => {
                reject(
                    new Error(
                        "Background removal timed out after 60 seconds."
                    )
                );
            });
        }, 60_000);

        child.stderr.on("data", (chunk) => {
            stderr += chunk.toString();

            // Avoid retaining unlimited process output in memory.
            if (stderr.length > 10_000) {
                stderr = stderr.slice(-10_000);
            }
        });

        child.on("error", (error) => {
            finish(() => {
                reject(
                    new Error(
                        `Could not start background-removal process: ${error.message}`
                    )
                );
            });
        });

        child.on("close", (code, signal) => {
            finish(() => {
                if (code === 0) {
                    resolve();
                    return;
                }

                reject(
                    new Error(
                        `Background removal failed ` +
                        `(code: ${code ?? "unknown"}, ` +
                        `signal: ${signal ?? "none"}): ` +
                        `${stderr || "No Python error output."}`
                    )
                );
            });
        });
    });
}

/**
* Remove an image background through the existing Python script.
*
* The output path deliberately ends in .png because the result needs alpha.
*/
async function removeBackgroundFromBuffer(buffer, originalName = "asset.png") {
    const jobId = crypto.randomUUID();
    const extension = path.extname(originalName) || ".png";
    const tempDirectory = os.tmpdir();

    const inputPath = path.join(
        tempDirectory,
        `oreblogda-bg-input-${jobId}${extension}`
    );

    const outputPath = path.join(
        tempDirectory,
        `oreblogda-bg-output-${jobId}.png`
    );

    try {
        await fs.writeFile(inputPath, buffer);
        await removeBackground(inputPath, outputPath);

        const transparentBuffer = await fs.readFile(outputPath);
        const transparency = await inspectTransparency(transparentBuffer);

        if (!transparency.hasRealTransparency) {
            throw new Error(
                "Background removal completed, but the output still has no transparent pixels."
            );
        }

        return transparentBuffer;
    } finally {
        await Promise.allSettled([
            fs.unlink(inputPath),
            fs.unlink(outputPath),
        ]);
    }
}

/**
* Inspect whether an image contains actual transparent pixels.
*
* An alpha channel by itself is not enough because an image can contain an
* entirely opaque alpha channel. Avatar VFX sheets need real transparency.
*/
async function inspectTransparency(buffer) {
    const image = sharp(buffer, { animated: false });
    const metadata = await image.metadata();

    if (!metadata.hasAlpha) {
        return {
            hasAlpha: false,
            hasRealTransparency: false,
            alphaMin: 255,
        };
    }

    const stats = await image.ensureAlpha().stats();
    const alphaChannel = stats.channels[3];
    const alphaMin = alphaChannel?.min ?? 255;

    return {
        hasAlpha: true,
        hasRealTransparency: alphaMin < 255,
        alphaMin,
    };
}

/**
* Apply rembg only when the frontend explicitly requests it and the source is
* not already transparent. This avoids wasting RAM on transparent PNG files.
*/
async function prepareTransparency({
    buffer,
    fileName,
    shouldRemoveBackground,
    isAnimatedSource,
    isAvatarVfxSpriteSheet,
    isBackground,
}) {
    const originalTransparency = await inspectTransparency(buffer);

    if (!shouldRemoveBackground) {
        return {
            buffer,
            backgroundRemoved: false,
            transparency: originalTransparency,
        };
    }

    if (originalTransparency.hasRealTransparency) {
        return {
            buffer,
            backgroundRemoved: false,
            transparency: originalTransparency,
        };
    }

    if (isBackground) {
        throw new Error(
            "Background removal is not supported for background assets."
        );
    }

    if (isAnimatedSource && !isAvatarVfxSpriteSheet) {
        throw new Error(
            "Background removal is not supported for an already-animated GIF or WebP. Upload a transparent animation instead."
        );
    }

    const transparentBuffer = await removeBackgroundFromBuffer(
        buffer,
        fileName
    );

    return {
        buffer: transparentBuffer,
        backgroundRemoved: true,
        transparency: await inspectTransparency(transparentBuffer),
    };
}

/**
* Validate a browser-uploaded File.
*/
function validateUploadedFile(file) {
    if (!file || typeof file === "string") {
        throw new Error("Invalid uploaded file.");
    }

    if (
        typeof file.type === "string" &&
        file.type &&
        !file.type.startsWith("image/")
    ) {
        throw new Error(`${file.name || "File"} is not an image.`);
    }

    if (typeof file.size === "number" && file.size > MAX_FILE_SIZE) {
        throw new Error(
            `${file.name || "Image"} exceeds the ${Math.round(
                MAX_FILE_SIZE / 1024 / 1024
            )} MB limit.`
        );
    }
}

/**
* Parse and validate animated Avatar VFX settings sent by the frontend.
*
* Frontend structure:
* metadata.vfxConfig = { columns, rows, fps }
*/
function getVfxConfiguration(metadata) {
    const columns = parseBoundedInteger(metadata?.vfxConfig?.columns, {
        name: "VFX columns",
        min: 1,
        max: 20,
        fallback: 4,
    });

    const rows = parseBoundedInteger(metadata?.vfxConfig?.rows, {
        name: "VFX rows",
        min: 1,
        max: 20,
        fallback: 3,
    });

    const fps = parseBoundedInteger(metadata?.vfxConfig?.fps, {
        name: "VFX FPS",
        min: 1,
        max: 30,
        fallback: 12,
    });

    const totalFrames = columns * rows;

    if (totalFrames < 2) {
        throw new Error(
            "Animated Avatar VFX requires at least two sprite cells."
        );
    }

    if (totalFrames > MAX_VFX_FRAMES) {
        throw new Error(
            `Avatar VFX may contain at most ${MAX_VFX_FRAMES} frames.`
        );
    }

    return {
        columns,
        rows,
        fps,
        frameCount: totalFrames,

        // WebP delay is milliseconds per frame.
        delay: Math.max(20, Math.round(1000 / fps)),
    };
}

/**
* Split a sprite sheet into equal cells and encode it as animated WebP.
*
* Frame order:
* left-to-right, then top-to-bottom.
*/
async function spriteSheetToAnimatedWebP(
    spriteSheetBuffer,
    {
        columns,
        rows,
        fps,
        frameCount,
        delay,
        outputWidth = 512,
        outputHeight = 512,
        quality = 85,
    }
) {
    const sheetMetadata = await sharp(spriteSheetBuffer).metadata();

    if (!sheetMetadata.width || !sheetMetadata.height) {
        throw new Error("Could not determine sprite-sheet dimensions.");
    }

    const transparency = await inspectTransparency(spriteSheetBuffer);

    if (!transparency.hasRealTransparency) {
        throw new Error(
            "Avatar VFX sprite sheet is not transparent. Enable AI background removal or upload a transparent PNG sheet."
        );
    }

    const frameBuffers = [];

    for (let index = 0; index < frameCount; index += 1) {
        const columnIndex = index % columns;
        const rowIndex = Math.floor(index / columns);

        /*
        * Proportional boundaries safely distribute any leftover pixels when the
        * image dimensions are not perfectly divisible by the grid dimensions.
        */
        const left = Math.round((columnIndex * sheetMetadata.width) / columns);
        const right = Math.round(((columnIndex + 1) * sheetMetadata.width) / columns);
        const top = Math.round((rowIndex * sheetMetadata.height) / rows);
        const bottom = Math.round(((rowIndex + 1) * sheetMetadata.height) / rows);

        const frameBuffer = await sharp(spriteSheetBuffer)
            .extract({
                left,
                top,
                width: right - left,
                height: bottom - top,
            })
            /*
            * Do not trim individual frames.
            *
            * A flame or droplet changes its occupied bounds each frame.
            * Trimming each frame separately would cause visible jumping.
            */
            .ensureAlpha()
            .resize(outputWidth, outputHeight, {
                fit: "contain",
                position: "centre",
                background: TRANSPARENT_BACKGROUND,
                withoutEnlargement: false,
            })
            .png({
                compressionLevel: 9,
            })
            .toBuffer();

        frameBuffers.push(frameBuffer);
    }

    /*
    * Sharp 0.34+ can join an array of image inputs as an animation.
    */
    return sharp(frameBuffers, {
        join: {
            animated: true,
        },
    })
        .webp({
            quality,
            alphaQuality: 100,
            effort: 5,
            loop: 0,
            delay: frameBuffers.map(() => delay),
            preset: "drawing",
            smartSubsample: true,

            // Preserve colours around alpha edges.
            exact: true,
        })
        .toBuffer();
}

/**
* Process an already-animated GIF or WebP.
*
* This branch is retained for animated stickers that are uploaded as an
* existing animation rather than as a sprite sheet.
*/
async function processExistingAnimation(
    buffer,
    {
        width,
        height,
        quality = 85,
    }
) {
    return sharp(buffer, {
        animated: true,
    })
        .ensureAlpha()
        .resize(width, height, {
            fit: "contain",
            position: "centre",
            background: TRANSPARENT_BACKGROUND,
        })
        .webp({
            quality,
            alphaQuality: 100,
            effort: 5,
            loop: 0,
            exact: true,
        })
        .toBuffer();
}

/**
* Process an ordinary static image.
*/
async function processStaticImage(
    buffer,
    {
        isSticker,
        isBackground,
        width,
        height,
    }
) {
    let pipeline = sharp(buffer).ensureAlpha();

    if (isSticker) {
        pipeline = pipeline.trim({
            background: TRANSPARENT_BACKGROUND,
        });
    }

    return pipeline
        .resize(width, height, {
            fit: isBackground ? "cover" : "contain",
            position: "centre",
            background: TRANSPARENT_BACKGROUND,
        })
        .webp({
            quality: 85,
            alphaQuality: 100,
            effort: 5,
            exact: true,
        })
        .toBuffer();
}

/**
* Complete image-processing dispatcher.
*/
async function processAssetBuffer({
    originalBuffer,
    fileName,
    metadata,
    category,
    width,
    height,
}) {
    const isSticker = category === "sticker";
    const isBackground = category === "background";
    const isAvatarVfx = category === "avatar_vfx";
    const isAnimated = toBoolean(metadata.isAnimated);
    const shouldRemoveBackground = toBoolean(metadata.removeBackground);
    const isAvatarVfxSpriteSheet = isAvatarVfx && isAnimated;

    const prepared = await prepareTransparency({
        buffer: originalBuffer,
        fileName,
        shouldRemoveBackground,
        isAnimatedSource: isAnimated,
        isAvatarVfxSpriteSheet,
        isBackground,
    });

    const workingBuffer = prepared.buffer;

    /*
    * Animated Avatar VFX uploads are static sprite sheets that Sharp splits and
    * joins into one animated WebP. rembg runs only when removeBackground is true.
    */
    if (isAvatarVfxSpriteSheet) {
        if (!prepared.transparency.hasRealTransparency) {
            throw new Error(
                "Avatar VFX sprite sheet needs transparency. Enable AI background removal or upload a transparent PNG sheet."
            );
        }

        const vfxConfig = getVfxConfiguration(metadata);

        const processedBuffer = await spriteSheetToAnimatedWebP(
            workingBuffer,
            {
                ...vfxConfig,
                outputWidth: width,
                outputHeight: height,
                quality: 85,
            }
        );

        return {
            processedBuffer,
            backgroundRemoved: prepared.backgroundRemoved,
            vfxConfig: {
                columns: vfxConfig.columns,
                rows: vfxConfig.rows,
                fps: vfxConfig.fps,
                frameCount: vfxConfig.frameCount,
                delay: vfxConfig.delay,
            },
        };
    }

    if (isAnimated) {
        const processedBuffer = await processExistingAnimation(
            workingBuffer,
            {
                width,
                height,
            }
        );

        return {
            processedBuffer,
            backgroundRemoved: prepared.backgroundRemoved,
            vfxConfig: undefined,
        };
    }

    const processedBuffer = await processStaticImage(workingBuffer, {
        isSticker,
        isBackground,
        width,
        height,
    });

    return {
        processedBuffer,
        backgroundRemoved: prepared.backgroundRemoved,
        vfxConfig: undefined,
    };
}

/**
* Upload a processed WebP buffer to Cloudinary.
*/
async function uploadWebPToCloudinary(
    buffer,
    {
        folder,
        publicId,
        overwrite = false,
    }
) {
    return new Promise((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                resource_type: "image",
                folder,
                public_id: publicId,
                format: "webp",
                overwrite,
                invalidate: overwrite,

                // We already encoded the final WebP with Sharp.
                transformation: undefined,
            },
            (error, result) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(result);
            }
        );

        uploadStream.on("error", reject);
        uploadStream.end(buffer);
    });
}

/**
* Build common MongoDB fields.
*/
function buildCommonDocumentData(metadata) {
    return {
        type: metadata.type,
        price: Number(metadata.price) || 0,
        tags: Array.isArray(metadata.tags) ? metadata.tags : [],
        author: metadata.author || "",
        packId: metadata.packId || "",
    };
}

export async function GET(req) {
    try {
        await connectDB();

        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");

        if (category === "sticker") {
            const stickers = await Sticker.find({})
                .sort({ packId: 1, createdAt: -1 })
                .lean();

            return NextResponse.json({
                success: true,
                stickers,
                assets: [],
                items: stickers,
            });
        }

        if (category) {
            const assets = await ShopAsset.find({ category })
                .sort({ packId: 1, createdAt: -1 })
                .lean();

            return NextResponse.json({
                success: true,
                stickers: [],
                assets,
                items: assets,
            });
        }

        const [stickers, assets] = await Promise.all([
            Sticker.find({})
                .sort({ packId: 1, createdAt: -1 })
                .lean(),

            ShopAsset.find({})
                .sort({ packId: 1, createdAt: -1 })
                .lean(),
        ]);

        /*
        * "items" gives the frontend one combined vault.
        * stickers/assets remain available for backward compatibility.
        */
        const items = [...stickers, ...assets].sort((a, b) => {
            const aTime = new Date(a.createdAt || 0).getTime();
            const bTime = new Date(b.createdAt || 0).getTime();
            return bTime - aTime;
        });

        return NextResponse.json({
            success: true,
            stickers,
            assets,
            items,
        });
    } catch (error) {
        console.error("Admin GET error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error.message,
            },
            {
                status: 500,
            }
        );
    }
}

export async function POST(req) {
    try {
        const formData = await req.formData();
        const rawMetadata = formData.get("metadata");

        if (typeof rawMetadata !== "string") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Asset metadata is required.",
                },
                {
                    status: 400,
                }
            );
        }

        let metadata;

        try {
            metadata = JSON.parse(rawMetadata);
        } catch {
            return NextResponse.json(
                {
                    success: false,
                    error: "Asset metadata is not valid JSON.",
                },
                {
                    status: 400,
                }
            );
        }

        const files = formData
            .getAll("files")
            .filter((file) => file && typeof file !== "string");

        if (files.length > MAX_FILES_PER_REQUEST) {
            return NextResponse.json(
                {
                    success: false,
                    error: `A maximum of ${MAX_FILES_PER_REQUEST} files may be uploaded at once.`,
                },
                {
                    status: 400,
                }
            );
        }

        for (const file of files) {
            validateUploadedFile(file);
        }

        const category = metadata.category || "sticker";
        const isSticker = category === "sticker";
        const isBackground = category === "background";
        const isAvatarVfx = category === "avatar_vfx";

        let width = 512;
        let height = 512;

        if (isBackground) {
            width = 744;
            height = 1300;
        }

        await connectDB();

        const TargetModel = isSticker ? Sticker : ShopAsset;
        const idField = isSticker ? "stickerId" : "assetId";

        const tierOrRarity =
            metadata.tier ||
            metadata.rarity ||
            "COMMON";

        const uploadFolder =
            `oreblogda/${category}s/` +
            tierOrRarity.toLowerCase();

        /*
        * UPDATE
        */
        if (metadata.action === "update") {
            if (!metadata.targetId) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Target ID is required for updates.",
                    },
                    {
                        status: 400,
                    }
                );
            }

            const existingItem = await TargetModel.findById(
                metadata.targetId
            );

            if (!existingItem) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Asset not found.",
                    },
                    {
                        status: 404,
                    }
                );
            }

            let secureUrl = null;
            let processedVfxConfig = undefined;
            let backgroundRemoved = false;

            if (files.length > 0) {
                if (files.length !== 1) {
                    throw new Error(
                        "Only one replacement file may be uploaded during an update."
                    );
                }

                const file = files[0];
                const originalBuffer = Buffer.from(
                    await file.arrayBuffer()
                );

                const {
                    processedBuffer,
                    vfxConfig,
                    backgroundRemoved: didRemoveBackground,
                } = await processAssetBuffer({
                    originalBuffer,
                    fileName: file.name,
                    metadata,
                    category,
                    width,
                    height,
                });

                processedVfxConfig = vfxConfig;
                backgroundRemoved = didRemoveBackground;

                /*
                * Keep the existing public ID during updates.
                */
                const currentPublicId =
                    existingItem[idField] ||
                    metadata.assetId ||
                    metadata.stickerId;

                if (!currentPublicId) {
                    throw new Error(
                        "Could not determine this asset's public ID."
                    );
                }

                const uploadResult =
                    await uploadWebPToCloudinary(processedBuffer, {
                        folder: uploadFolder,
                        publicId: currentPublicId,
                        overwrite: true,
                    });

                secureUrl = uploadResult.secure_url;
            }

            const updatePayload = {
                ...buildCommonDocumentData(metadata),
            };

            if (isSticker) {
                updatePayload.stickerId =
                    metadata.stickerId ||
                    existingItem.stickerId;

                updatePayload.tier = tierOrRarity;
                updatePayload.isAnimated =
                    toBoolean(metadata.isAnimated);

                updatePayload.clanId =
                    metadata.type === "clan"
                        ? metadata.clanId || null
                        : null;
            } else {
                updatePayload.assetId =
                    metadata.assetId ||
                    metadata.stickerId ||
                    existingItem.assetId;

                updatePayload.category = category;
                updatePayload.rarity = tierOrRarity;
                updatePayload.isAnimated =
                    toBoolean(metadata.isAnimated);

                updatePayload.visualConfig =
                    category === "watermark"
                        ? metadata.visualConfig
                        : undefined;

                updatePayload.vfxConfig = isAvatarVfx
                    ? processedVfxConfig ||
                    metadata.vfxConfig ||
                    existingItem.vfxConfig
                    : undefined;

                updatePayload.clanId =
                    metadata.type === "clan"
                        ? metadata.clanId || null
                        : null;
            }

            if (secureUrl) {
                updatePayload.url = secureUrl;
            }

            /*
            * Remove undefined values so they do not unintentionally overwrite
            * existing MongoDB properties.
            */
            Object.keys(updatePayload).forEach((key) => {
                if (updatePayload[key] === undefined) {
                    delete updatePayload[key];
                }
            });

            const updatedItem =
                await TargetModel.findByIdAndUpdate(
                    metadata.targetId,
                    {
                        $set: updatePayload,
                    },
                    {
                        new: true,
                        runValidators: true,
                    }
                );

            return NextResponse.json({
                success: true,
                data: updatedItem,
                backgroundRemoved,
            });
        }

        /*
        * CREATE
        */
        if (!files.length) {
            return NextResponse.json(
                {
                    success: false,
                    error: "No files were provided.",
                },
                {
                    status: 400,
                }
            );
        }

        const createdItems = [];
        const processingResults = [];

        /*
        * Sequential processing is intentional.
        *
        * rembg and animated Sharp processing can use considerable memory.
        * Running many sprite sheets concurrently could exhaust a serverless
        * function.
        */
        for (const file of files) {
            let generatedId = generateId(
                category,
                metadata.packId,
                metadata.author,
                file.name
            );

            generatedId = await ensureUniqueId(
                generatedId,
                TargetModel,
                idField
            );

            const originalBuffer = Buffer.from(
                await file.arrayBuffer()
            );

            const {
                processedBuffer,
                vfxConfig,
                backgroundRemoved,
            } = await processAssetBuffer({
                originalBuffer,
                fileName: file.name,
                metadata,
                category,
                width,
                height,
            });

            const uploadResult =
                await uploadWebPToCloudinary(processedBuffer, {
                    folder: uploadFolder,
                    publicId: generatedId,
                    overwrite: false,
                });

            const documentData = {
                ...buildCommonDocumentData(metadata),
                url: uploadResult.secure_url,
            };

            if (isSticker) {
                documentData.stickerId = generatedId;
                documentData.tier = tierOrRarity;
                documentData.isAnimated =
                    toBoolean(metadata.isAnimated);

                if (metadata.type === "clan") {
                    documentData.clanId = metadata.clanId;
                }
            } else {
                documentData.assetId = generatedId;
                documentData.name =
                    path.parse(file.name).name;
                documentData.category = category;
                documentData.rarity = tierOrRarity;
                documentData.isAnimated =
                    toBoolean(metadata.isAnimated);

                if (category === "watermark") {
                    documentData.visualConfig =
                        metadata.visualConfig;
                }

                if (isAvatarVfx) {
                    documentData.vfxConfig =
                        vfxConfig || metadata.vfxConfig;
                }

                if (metadata.type === "clan") {
                    documentData.clanId =
                        metadata.clanId;
                }
            }

            const newItem = await TargetModel.create(
                documentData
            );

            createdItems.push(newItem);
            processingResults.push({
                fileName: file.name,
                backgroundRemoved,
            });
        }

        return NextResponse.json({
            success: true,
            items: createdItems,
            processingResults,
        });
    } catch (error) {
        console.error("Admin process error:", error);

        return NextResponse.json(
            {
                success: false,
                error:
                    error.message ||
                    "Asset processing failed.",
            },
            {
                status: 500,
            }
        );
    }
}

export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        const category = searchParams.get("category");

        if (!id) {
            return NextResponse.json(
                {
                    success: false,
                    error: "ID required.",
                },
                {
                    status: 400,
                }
            );
        }

        await connectDB();

        const TargetModel =
            category === "sticker"
                ? Sticker
                : ShopAsset;

        const deletedItem =
            await TargetModel.findByIdAndDelete(id);

        if (!deletedItem) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Asset not found.",
                },
                {
                    status: 404,
                }
            );
        }

        return NextResponse.json({
            success: true,
            message: "Asset purged.",
        });
    } catch (error) {
        console.error("Admin DELETE error:", error);

        return NextResponse.json(
            {
                success: false,
                error: error.message,
            },
            {
                status: 500,
            }
        );
    }
}
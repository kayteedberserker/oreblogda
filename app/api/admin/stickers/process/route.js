import connectDB from "@/app/lib/mongodb";
import ShopAsset from "@/app/models/ShopAsset"; // ⚡️ New model for BGs/Watermarks
import Sticker from "@/app/models/StickerModel";
import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import sharp from "sharp";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper to generate IDs based on category
const generateId = (category, packId, author, fileName) => {
    const safePack = (packId || "pack").replace(/[^a-zA-Z0-9]/g, "");
    const safeAuthor = (author || "anon").replace(/[^a-zA-Z0-9]/g, "");
    const safeFile = fileName.split('.')[0].replace(/[^a-zA-Z0-9]/g, "");
    const prefix = category === "sticker" ? "" : category === "background" ? "bg_" : "wm_";
    return `${prefix}${safePack}_${safeAuthor}_${safeFile}`.toLowerCase();
};

export async function GET(req) {
    try {
        await connectDB();
        const { searchParams } = new URL(req.url);
        const category = searchParams.get("category");

        // If category is provided, fetch specific collection, otherwise fetch both
        if (category === "sticker") {
            const stickers = await Sticker.find({}).sort({ packId: 1, createdAt: -1 });
            return NextResponse.json({ success: true, stickers });
        } else if (category) {
            const assets = await ShopAsset.find({ category }).sort({ createdAt: -1 });
            return NextResponse.json({ success: true, assets });
        }

        const [stickers, assets] = await Promise.all([
            Sticker.find({}),
            ShopAsset.find({})
        ]);

        return NextResponse.json({ success: true, stickers, assets });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const formData = await req.formData();
        const files = formData.getAll("files");
        const metadata = JSON.parse(formData.get("metadata"));
        const category = metadata.category || "sticker";
        const isSticker = category === "sticker";
        const isBackground = category === "background"; // 🚀 Detect background category

        // 🛠️ Dynamic Dimension Logic
        let width = 512;
        let height = 512;

        if (isBackground) {
            width = 744;   // High Definition (2x) width
            height = 1300; // High Definition (2x) height
        }
        await connectDB();

        // 1. Define Model and Path
        const TargetModel = isSticker ? Sticker : ShopAsset;
        const uploadFolder = `oreblogda/${category}s/${metadata.tier?.toLowerCase() || 'common'}`;

        if (metadata.action === "update") {
            // --- UPDATE LOGIC ---
            let secureUrl = null;

            if (files.length > 0 && typeof files[0] !== "string") {
                const buffer = Buffer.from(await files[0].arrayBuffer());
                // Process with Sharp using dynamic dimensions
                const processedBuffer = await sharp(buffer, { animated: metadata.isAnimated || false })
                    .ensureAlpha()
                    .resize(width, height, {
                        fit: isBackground ? "cover" : "contain", // Backgrounds should fill the space
                        background: { r: 0, g: 0, b: 0, alpha: 0 }
                    })
                    .webp({ quality: 85 })
                    .toBuffer();

                const uploadRes = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream(
                        {
                            folder: uploadFolder,
                            public_id: isSticker ? metadata.stickerId : metadata.assetId,
                            format: "webp",
                            overwrite: true
                        },
                        (err, result) => (err ? reject(err) : resolve(result))
                    ).end(processedBuffer);
                });
                secureUrl = uploadRes.secure_url;
            }

            const updatePayload = {
                type: metadata.type,
                price: Number(metadata.price),
                tags: metadata.tags,
                author: metadata.author,
                packId: metadata.packId,
            };

            // Add fields specific to the models
            if (isSticker) {
                updatePayload.stickerId = metadata.stickerId;
                updatePayload.tier = metadata.tier;
                updatePayload.isAnimated = metadata.isAnimated;
            } else {
                updatePayload.assetId = metadata.assetId;
                updatePayload.rarity = metadata.rarity || metadata.tier;
                updatePayload.category = category;
                updatePayload.visualConfig = metadata.visualConfig;
            }

            if (secureUrl) updatePayload.url = secureUrl;

            const updated = await TargetModel.findByIdAndUpdate(metadata.targetId, { $set: updatePayload }, { new: true });
            return NextResponse.json({ success: true, data: updated });

        } else {
            // --- CREATE LOGIC (BATCH) ---
            if (!files.length) return NextResponse.json({ error: "No files" }, { status: 400 });

            const createdItems = [];

            for (const file of files) {
                if (typeof file === "string") continue;

                const generatedId = generateId(category, metadata.packId, metadata.author, file.name);
                const buffer = Buffer.from(await file.arrayBuffer());

                const processedBuffer = await sharp(buffer, { animated: metadata.isAnimated || false })
                    .ensureAlpha()
                    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .webp({ quality: 85 })
                    .toBuffer();

                const uploadRes = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream(
                        { folder: uploadFolder, public_id: generatedId, format: "webp" },
                        (err, result) => (err ? reject(err) : resolve(result))
                    ).end(processedBuffer);
                });

                const docData = {
                    url: uploadRes.secure_url,
                    type: metadata.type,
                    price: Number(metadata.price),
                    tags: metadata.tags,
                    author: metadata.author,
                    packId: metadata.packId,
                };

                if (isSticker) {
                    docData.stickerId = generatedId;
                    docData.tier = metadata.tier;
                    docData.isAnimated = metadata.isAnimated;
                } else {
                    docData.assetId = generatedId;
                    docData.name = file.name.split('.')[0];
                    docData.category = category;
                    docData.rarity = metadata.rarity || metadata.tier;
                    docData.visualConfig = metadata.visualConfig;
                }

                const newItem = await TargetModel.create(docData);
                createdItems.push(newItem);
            }

            return NextResponse.json({ success: true, items: createdItems });
        }
    } catch (err) {
        console.error("Admin Process Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");
        const category = searchParams.get("category");

        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        await connectDB();

        // Check correct model for deletion
        const TargetModel = category === "sticker" ? Sticker : ShopAsset;
        const deleted = await TargetModel.findByIdAndDelete(id);

        if (!deleted) return NextResponse.json({ error: "Asset not found" }, { status: 404 });

        return NextResponse.json({ success: true, message: "Asset purged" });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
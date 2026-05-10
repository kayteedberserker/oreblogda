import connectDB from "@/app/lib/mongodb";
import Sticker from "@/app/models/StickerModel";
import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";
import sharp from "sharp";

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Helper function to auto-generate standard IDs
const generateStickerId = (packId, author, fileName) => {
    const safePack = (packId || "pack").replace(/[^a-zA-Z0-9]/g, "");
    const safeAuthor = (author || "anon").replace(/[^a-zA-Z0-9]/g, "");
    const safeFile = fileName.split('.')[0].replace(/[^a-zA-Z0-9]/g, "");
    return `${safePack}_${safeAuthor}_${safeFile}`.toLowerCase();
};

export async function GET() {
    try {
        await connectDB();
        const stickers = await Sticker.find({}).sort({ packId: 1, createdAt: -1 });
        return NextResponse.json({ success: true, stickers });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

export async function POST(req) {
    try {
        const formData = await req.formData();
        const files = formData.getAll("files"); // Captures all files uploaded
        const metadata = JSON.parse(formData.get("metadata"));

        await connectDB();

        if (metadata.action === "update") {
            // --- UPDATE EXISTING STICKER (SINGLE) ---
            let secureUrl = null;

            if (files.length > 0 && typeof files[0] !== "string") {
                const buffer = Buffer.from(await files[0].arrayBuffer());
                const processedBuffer = await sharp(buffer, { animated: metadata.isAnimated || false })
                    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .webp({ quality: 85 })
                    .toBuffer();

                const uploadPath = `oleblogda/stickers/${metadata.tier.toLowerCase()}`;
                const uploadRes = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream(
                        { folder: uploadPath, public_id: metadata.stickerId, format: "webp", overwrite: true, resource_type: "image" },
                        (err, result) => (err ? reject(err) : resolve(result))
                    ).end(processedBuffer);
                });
                secureUrl = uploadRes.secure_url;
            }

            const updatePayload = {
                stickerId: metadata.stickerId,
                type: metadata.type,
                tier: metadata.tier,
                price: Number(metadata.price),
                isAnimated: metadata.isAnimated,
                tags: metadata.tags,
                author: metadata.author,
                packId: metadata.packId,
            };

            if (secureUrl) updatePayload.url = secureUrl;

            const updatedSticker = await Sticker.findByIdAndUpdate(metadata.targetId, { $set: updatePayload }, { new: true });
            return NextResponse.json({ success: true, sticker: updatedSticker });

        } else {
            // --- BATCH CREATE NEW STICKERS (SINGLE OR MULTIPLE) ---
            if (!files.length) return NextResponse.json({ error: "No files provided" }, { status: 400 });

            const createdStickers = [];

            // Process all files sequentially to avoid overloading the server memory
            for (const file of files) {
                if (typeof file === "string") continue;

                // 1. Generate unique stickerId
                const generatedId = generateStickerId(metadata.packId, metadata.author, file.name);

                // 2. Process Buffer
                const buffer = Buffer.from(await file.arrayBuffer());
                const processedBuffer = await sharp(buffer, { animated: metadata.isAnimated || false })
                    .resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
                    .webp({ quality: 85 })
                    .toBuffer();

                // 3. Upload to Cloudinary
                const uploadPath = `oleblogda/stickers/${metadata.tier.toLowerCase()}`;
                const uploadRes = await new Promise((resolve, reject) => {
                    cloudinary.uploader.upload_stream(
                        { folder: uploadPath, public_id: generatedId, format: "webp", overwrite: true, resource_type: "image" },
                        (err, result) => (err ? reject(err) : resolve(result))
                    ).end(processedBuffer);
                });

                // 4. Create in DB
                const newSticker = await Sticker.create({
                    stickerId: generatedId, // Injected auto-generated ID
                    url: uploadRes.secure_url,
                    type: metadata.type,
                    tier: metadata.tier,
                    price: Number(metadata.price),
                    isAnimated: metadata.isAnimated,
                    tags: metadata.tags,
                    author: metadata.author,
                    packId: metadata.packId,
                });

                createdStickers.push(newSticker);
            }

            return NextResponse.json({ success: true, stickers: createdStickers });
        }
    } catch (err) {
        console.error("Admin Process Error:", err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}

// --- DELETE: PURGE STICKER FROM SYSTEM ---
export async function DELETE(req) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

        await connectDB();

        // Note: In a production 'THE SYSTEM', you'd also call cloudinary.uploader.destroy()
        // but purging from DB is the critical first step.
        const deleted = await Sticker.findByIdAndDelete(id);

        if (!deleted) return NextResponse.json({ error: "Sticker not found" }, { status: 404 });

        return NextResponse.json({ success: true, message: "Asset purged" });
    } catch (err) {
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
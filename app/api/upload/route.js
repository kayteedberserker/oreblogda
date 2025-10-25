import { NextResponse } from "next/server";
import cloudinary from "@/app/lib/cloudinary";
import streamifier from "streamifier"; // ⬅️ need to install this

export const runtime = "nodejs"; // required for cloudinary uploads

export async function POST(req) {
  try {
    // Convert request body to buffer
    const data = await req.arrayBuffer();
    const buffer = Buffer.from(data);

    // ✅ Wrap Cloudinary’s upload_stream in a Promise
    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "posts" },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        // ✅ Send file buffer as a stream
        streamifier.createReadStream(buffer).pipe(stream);
      });
    };

    // Upload directly (no local write)
    const result = await uploadToCloudinary();

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { message: "Upload failed", error: err.message },
      { status: 500 }
    );
  }
}

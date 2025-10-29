import { NextResponse } from "next/server";
import cloudinary from "@/app/lib/cloudinary";
import streamifier from "streamifier";

export const runtime = "nodejs"; // required for cloudinary uploads

export async function POST(req) {
  try {
    // Convert request body to buffer
    const data = await req.arrayBuffer();
    const buffer = Buffer.from(data);

    // Wrap Cloudinary’s upload_stream in a Promise
    const uploadToCloudinary = () => {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "posts" }, // keep folder if you want
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );

        streamifier.createReadStream(buffer).pipe(stream);
      });
    };

    // Upload directly (no local write)
    const result = await uploadToCloudinary();

    // ✅ Add optimization parameters to URL
    // f_auto -> automatic format (WebP/AVIF if supported)
    // q_auto -> automatic quality
    const optimizedUrl = result.secure_url.replace(
      "/upload/",
      "/upload/f_auto,q_auto/"
    );

    return NextResponse.json({ url: optimizedUrl });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { message: "Upload failed", error: err.message },
      { status: 500 }
    );
  }
}

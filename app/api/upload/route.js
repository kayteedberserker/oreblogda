import { NextResponse } from "next/server";
import cloudinary from "@/app/lib/cloudinary";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 });
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Determine if it's a video or image
    const isVideo = file.type.startsWith("video");

    // Upload to Cloudinary
    const uploadRes = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        { 
          folder: "posts",
          resource_type: isVideo ? "video" : "image" // Required for videos
        },
        (err, result) => {
          if (err) reject(err);
          else resolve(result);
        }
      ).end(buffer);
    });

    // Optimization for images, raw URL for videos
    let finalUrl = uploadRes.secure_url;
    if (!isVideo) {
      finalUrl = uploadRes.secure_url.replace(
        "/upload/",
        "/upload/f_auto,q_auto/"
      );
    }

    return NextResponse.json({ url: finalUrl, resource_type: uploadRes.resource_type });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { message: "Upload failed", error: err.message },
      { status: 500 }
    );
  }
}
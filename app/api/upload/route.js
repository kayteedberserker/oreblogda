import { NextResponse } from "next/server";
import cloudinary from "@/app/lib/cloudinary";
import { Readable } from "stream";

export const runtime = "nodejs";

export async function POST(req) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { message: "No file provided" },
        { status: 400 }
      );
    }

    const isVideo = file.type?.startsWith("video");

    // Convert file to stream (better than buffering for videos)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const stream = Readable.from(buffer);

    const uploadResult = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: "posts",
          resource_type: isVideo ? "video" : "image",

          // 🔑 Critical video optimizations
          ...(isVideo && {
            eager_async: true, // upload first, process later
            eager: [],         // no eager transforms
          }),
        },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );

      stream.pipe(uploadStream);
    });

    // ---- Delivery URL Optimization ----
    let finalUrl = uploadResult.secure_url;

    if (isVideo) {
      // Video delivery optimization
      finalUrl = finalUrl.replace(
        "/upload/",
        "/upload/q_auto,vc_auto/"
      );
    } else {
      // Image delivery optimization
      finalUrl = finalUrl.replace(
        "/upload/",
        "/upload/f_auto,q_auto/"
      );
    }

    return NextResponse.json({
      url: finalUrl,
      resource_type: uploadResult.resource_type,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { message: "Upload failed", error: err.message },
      { status: 500 }
    );
  }
}

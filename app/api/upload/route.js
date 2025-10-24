import { NextResponse } from "next/server";
import cloudinary from "@/app/lib/cloudinary";
import fs from "fs";
import path from "path";

export const runtime = "nodejs"; // ✅ Must be 'nodejs', not 'node'

export async function POST(req) {
  try {
    // Convert request body to buffer
    const data = await req.arrayBuffer();
    const buffer = Buffer.from(data);

    // Save temporary file
    const tmpPath = path.join(process.cwd(), "tmp_upload_file");
    fs.writeFileSync(tmpPath, buffer);

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(tmpPath, {
      folder: "posts",
    });

    // Delete temp file
    fs.unlinkSync(tmpPath);

    return NextResponse.json({ url: result.secure_url });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ message: "Upload failed", error: err.message }, { status: 500 });
  }
}

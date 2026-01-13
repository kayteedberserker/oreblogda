import { v2 as cloudinary } from "cloudinary";
import { NextResponse } from "next/server";

export async function POST(req) {
  const timestamp = Math.round(new Date().getTime() / 1000);
  
  // This signature is valid for the 'posts' folder
  const signature = cloudinary.utils.api_sign_request(
    { timestamp, folder: "posts" },
    process.env.CLOUDINARY_API_SECRET
  );

  return NextResponse.json({
    signature,
    timestamp,
    apiKey: process.env.CLOUDINARY_API_KEY,
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
  });
}

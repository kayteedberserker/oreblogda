import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import UserModel from "@/app/models/UserModel"; 
import MobileUserModel from "@/app/models/MobileUserModel";
import cloudinary from "@/app/lib/cloudinary";

export async function PUT(req) {
  await connectDB();

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ message: "Invalid Content-Type" }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const userId = formData.get("userId");
    const fingerprint = formData.get("fingerprint");
    const description = formData.get("description");
    const file = formData.get("file");

    console.log("--- Profile Update Start ---");
    console.log("User ID:", userId);
    console.log("Fingerprint:", fingerprint);

    let user = null;
    let SelectedModel = null;

    // 1. Identify User & Model
    if (userId && userId !== "undefined" && userId !== "null") {
      user = await UserModel.findById(userId);
      if (user) {
        SelectedModel = UserModel;
      } else {
        user = await MobileUserModel.findById(userId);
        if (user) SelectedModel = MobileUserModel;
      }
    } 
    
    if (!user && fingerprint) {
      user = await MobileUserModel.findOne({ deviceId: fingerprint });
      SelectedModel = MobileUserModel;
    }

    if (!user || !SelectedModel) {
      console.log("❌ Error: User not found in either model.");
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // 2. Cloudinary Processing
    let profilePicUpdate = null;

    // IMPROVED CHECK: Check if file exists and has data
    const hasValidFile = file && typeof file === 'object' && (file.size > 0 || file.name);

    if (hasValidFile) {
      console.log("📸 Image detected, starting Cloudinary upload...");

      // Cleanup: Delete old pic if exists
      if (user.profilePic?.public_id) {
        try {
          await cloudinary.uploader.destroy(user.profilePic.public_id);
          console.log("🗑️ Old image deleted from Cloudinary");
        } catch (cErr) {
          console.error("Cloudinary Delete Error:", cErr);
        }
      }

      // Convert File to Buffer
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadRes = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: "author_profiles" },
          (err, result) => {
            if (err) {
              console.error("Cloudinary Upload Error:", err);
              reject(err);
            } else {
              resolve(result);
            }
          }
        ).end(buffer);
      });

      console.log("✅ Cloudinary Upload Success:", uploadRes.secure_url);

      profilePicUpdate = {
        url: uploadRes.secure_url,
        public_id: uploadRes.public_id,
      };
    } else {
      console.log("ℹ️ No new image file provided in request.");
    }

    // 3. Unified Update
    const updatedUser = await SelectedModel.findByIdAndUpdate(
      user._id,
      {
        description: description ?? user.description,
        ...(profilePicUpdate && { profilePic: profilePicUpdate }),
      },
      { new: true }
    );

    console.log("💾 Database updated successfully.");
    console.log("--- Profile Update End ---");

    return NextResponse.json({ 
      message: "Profile updated", 
      user: updatedUser 
    }, { status: 200 });

  } catch (err) {
    console.error("Critical PUT Update Error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}
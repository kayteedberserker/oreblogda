import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import UserModel from "@/models/UserModel";
import cloudinary from "@/lib/cloudinary";

export async function PUT(req) {
  await connectDB();

  try {
    const formData = await req.formData();
    const userId = formData.get("userId");
    const description = formData.get("description");
    const file = formData.get("file"); // optional new image

    let profilePic = null;

    // 🛠 Fetch the current user
    const user = await UserModel.findById(userId);
    if (!user) return NextResponse.json({ message: "User not found" }, { status: 404 });

    // ⛅ If new image uploaded, delete old one & upload new one
    if (file && file.name) {
      // Delete old profile pic if exists
      if (user.profilePic?.public_id) {
        await cloudinary.uploader.destroy(user.profilePic.public_id);
      }

      // Upload new image
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadRes = await new Promise((resolve, reject) => {
        cloudinary.uploader
          .upload_stream({ folder: "author_profiles" }, (err, result) => {
            if (err) reject(err);
            else resolve(result);
          })
          .end(buffer);
      });

      profilePic = {
        url: uploadRes.secure_url,
        public_id: uploadRes.public_id,
      };
    }

    // Update user document
    const updatedUser = await UserModel.findByIdAndUpdate(
      userId,
      {
        description,
        ...(profilePic && { profilePic }),
      },
      { new: true }
    );

    return NextResponse.json({ message: "Profile updated", user: updatedUser }, { status: 200 });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { message: "Failed to update profile", error: err.message },
      { status: 500 }
    );
  }
}

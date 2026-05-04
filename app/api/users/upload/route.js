import cloudinary from "@/app/lib/cloudinary";
import connectDB from "@/app/lib/mongodb";
import MobileUserModel from "@/app/models/MobileUserModel";
import UserModel from "@/app/models/UserModel";
import { NextResponse } from "next/server";

export async function PUT(req) {
  await connectDB();

  const contentType = req.headers.get("content-type") || "";

  // LOG FOR DEBUGGING: If this shows 'application/json', that's your 400 error.
  console.log("Incoming Content-Type:", contentType);

  if (!contentType.includes("multipart/form-data")) {
    return NextResponse.json({ message: "Invalid Content-Type. Expected multipart/form-data" }, { status: 400 });
  }

  try {
    const formData = await req.formData();
    const userId = formData.get("userId");
    const fingerprint = formData.get("fingerprint");
    const description = formData.get("description");
    const username = formData.get("username");
    const preferencesRaw = formData.get("preferences");
    const inventoryRaw = formData.get("inventory");
    const equippedTitle = formData.get("equippedTitle");
    const file = formData.get("file");

    console.log("--- Profile Update Start ---");
    console.log("User ID:", userId);

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
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // 🔹 Initialize Update Object
    let updateFields = {};
    if (username) updateFields.username = username;
    if (description !== null) updateFields.description = description;

    // 🔹 Handle Title Equip/Unequip
    // formData.get returns null if key is missing, "" if appended as empty
    if (equippedTitle !== null) {
      if (equippedTitle === "") {
        updateFields.equippedTitle = null; // Explicit Unequip
        console.log("🏷️ Title Unequipped");
      } else {
        try {
          updateFields.equippedTitle = JSON.parse(equippedTitle);
          console.log("🏷️ Title Update:", updateFields.equippedTitle.name);
        } catch (e) {
          console.error("Title Parse Error:", e);
        }
      }
    }

    // 🔹 Handle Preferences
    if (preferencesRaw) {
      try {
        const parsed = JSON.parse(preferencesRaw);
        updateFields.preferences = {
          favAnimes: parsed.favAnimes || user.preferences?.favAnimes || [],
          favCharacter: parsed.favCharacter || user.preferences?.favCharacter || "",
          favGenres: parsed.favGenres || user.preferences?.favGenres || []
        };
        console.log("🧠 Preferences Synced");
      } catch (pErr) {
        console.error("Preference Parse Error:", pErr);
      }
    }

    // 🔹 Handle Inventory
    if (inventoryRaw) {
      try {
        updateFields.inventory = JSON.parse(inventoryRaw);
        console.log("🎒 Inventory Synced");
      } catch (iErr) {
        console.error("Inventory Parse Error:", iErr);
      }
    }

    // 2. Cloudinary Processing
    const hasValidFile = file && typeof file === 'object' && file.size > 0;

    if (hasValidFile) {
      console.log("📸 Image detected, uploading...");

      if (user.profilePic?.public_id) {
        try {
          await cloudinary.uploader.destroy(user.profilePic.public_id);
        } catch (cErr) {
          console.error("Cloudinary Delete Error:", cErr);
        }
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      const uploadRes = await new Promise((resolve, reject) => {
        cloudinary.uploader.upload_stream(
          { folder: "author_profiles" },
          (err, result) => {
            if (err) reject(err);
            else resolve(result);
          }
        ).end(buffer);
      });

      updateFields.profilePic = {
        url: uploadRes.secure_url,
        public_id: uploadRes.public_id,
      };
    }

    // 3. Unified Update
    const updatedUser = await SelectedModel.findByIdAndUpdate(
      user._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    console.log("💾 Sync Complete for Oleblogda User.");
    console.log("--- Profile Update End ---");

    return NextResponse.json({
      message: "Character Data Synced",
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
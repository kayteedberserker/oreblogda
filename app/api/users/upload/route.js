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
    const username = formData.get("username"); 
    const preferencesRaw = formData.get("preferences"); 
    const inventoryRaw = formData.get("inventory"); // 🆕 Added to capture equipment changes
    const file = formData.get("file");

    console.log("--- Profile Update Start ---");
    console.log("User ID:", userId);
    console.log("New Alias:", username);

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
      console.log("❌ Error: User not found.");
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    // 🔹 Initialize Update Object
    let updateFields = {
      username: username || user.username,
      description: description ?? user.description,
    };

    // 🔹 Handle Preferences
    if (preferencesRaw) {
      try {
        const parsed = JSON.parse(preferencesRaw);
        updateFields.preferences = {
          favAnimes: parsed.favAnimes || user.preferences?.favAnimes || [],
          favCharacter: parsed.favCharacter || user.preferences?.favCharacter || "",
          favGenres: parsed.favGenres || user.preferences?.favGenres || []
        };
        console.log("🧠 Neural Prefs Synced:", updateFields.preferences);
      } catch (pErr) {
        console.error("Preference Parse Error:", pErr);
      }
    }

    // 🔹 Handle Inventory / Equipment Sync
    if (inventoryRaw) {
      try {
        const parsedInventory = JSON.parse(inventoryRaw);
        // Syncing to inventory field in DB
        updateFields.inventory = parsedInventory;
        console.log("🎒 Inventory Equipment Synced");
      } catch (iErr) {
        console.error("Inventory Parse Error:", iErr);
      }
    }

    // 2. Cloudinary Processing (Images)
    const hasValidFile = file && typeof file === 'object' && (file.size > 0 || file.name);

    if (hasValidFile) {
      console.log("📸 Image detected, starting Cloudinary upload...");

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

    // 3. Unified Update using $set to ensure nested objects are overwritten correctly
    const updatedUser = await SelectedModel.findByIdAndUpdate(
      user._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );
    
    console.log("💾 Database updated: All Character Data & Equipment synced.");
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
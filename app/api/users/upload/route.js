import cloudinary from "@/app/lib/cloudinary";
import connectDB from "@/app/lib/mongodb";
import MobileUserModel from "@/app/models/MobileUserModel";
import { NextResponse } from "next/server";


export async function PUT(req) {
    await connectDB();

    const contentType = req.headers.get("content-type") || "";

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

        const isChangingName = formData.get("isChangingName") === "true";

        console.log("--- Profile Update Start ---");
        console.log("User ID:", userId);

        let user = null;

        // 1. Identify User
        if (userId && userId !== "undefined" && userId !== "null") {
            user = await MobileUserModel.findById(userId);
        }

        if (!user && fingerprint) {
            user = await MobileUserModel.findOne({ deviceId: fingerprint });
        }

        if (!user) {
            return NextResponse.json({ message: "User not found" }, { status: 404 });
        }

        // 🔹 Initialize Update Object & Warning State
        let updateFields = {};
        let responseMessage = "Character Data Synced";
        let partialSuccess = false;

        // ============================================================================
        // 🔹 Handle Name Change Economy & Identity Hard-Lock
        // ============================================================================
        if (isChangingName && username && username !== user.username) {

            // 🛑 1. HARD LOCK CHECK: Prohibit change if lock is active
            if (user.nameLockedUntil && new Date(user.nameLockedUntil) > new Date()) {
                return NextResponse.json({
                    message: "Access Denied: Your Identity is currently hard-locked. Name changes are prohibited until the lock expires."
                }, { status: 403 });
            }

            const normalizedUsername = username.trim();
            const cleanNewName = normalizedUsername.toUpperCase().replace(/[^A-Z0-9]/g, "");
            const safeRegexName = normalizedUsername.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

            // 🛡️ 2. CANONICAL NAME COLLISION CHECK (For Active Premium Locks ONLY)
            // If someone paid for a lock, NO ONE can use a variation of their name.
            const activeLock = await MobileUserModel.findOne({
                _id: { $ne: user._id },
                nameLockedUntil: { $gt: new Date() },
                canonicalUsername: cleanNewName
            });

            if (activeLock) {
                return NextResponse.json({
                    message: `Identity lock active. A variation of the username '${normalizedUsername}' conflicts with a reserved premium operator.`
                }, { status: 403 });
            }

            // 🛡️ 3. STANDARD EXACT MATCH CHECK (For Unlocked Users)
            // If it's unlocked, allow variations (e.g., KayTee vs Kay_Tee), but block exact matches.
            const nameExists = await MobileUserModel.findOne({
                _id: { $ne: user._id },
                username: { $regex: new RegExp(`^${safeRegexName}$`, "i") }
            });

            if (nameExists) {
                return NextResponse.json({ message: "This exact username is already claimed by an active operator." }, { status: 409 });
            }

            // 🛡️ 4. CHECK FOR NAME CHANGE CARD
            const cardIndex = user.inventory?.findIndex(item => item.itemId === "name_change_card");

            if (cardIndex !== undefined && cardIndex !== -1) {
                let newInventory = [...user.inventory];
                if (newInventory[cardIndex].itemCount > 1) {
                    newInventory[cardIndex].itemCount -= 1;
                } else {
                    newInventory.splice(cardIndex, 1);
                }

                updateFields.inventory = newInventory;
                updateFields.username = normalizedUsername;
                updateFields.canonicalUsername = cleanNewName; // ⚡️ SAVE NEW CANONICAL ROOT
                console.log("💳 Consumed Name Change Card & Updated Canonical");
            } else {
                console.log("❌ Name change skipped: No card in inventory.");
                responseMessage = "Profile updated, but a Name Change Card is required to change your identity.";
                partialSuccess = true;
            }

        } else if (username && !isChangingName) {
            updateFields.username = username;
        }

        // ============================================================================
        // 🔹 Handle Other Fields (Always runs, even if name change fails)
        // ============================================================================

        if (description !== null) updateFields.description = description;

        // Handle Title Equip/Unequip
        if (equippedTitle !== null) {
            if (equippedTitle === "") {
                updateFields.equippedTitle = null;
                console.log("🏷️ Title Unequipped");
            } else {
                try {
                    updateFields.equippedTitle = JSON.parse(equippedTitle);
                } catch (e) {
                    console.error("Title Parse Error:", e);
                }
            }
        }

        // Handle Preferences
        if (preferencesRaw) {
            try {
                const parsed = JSON.parse(preferencesRaw);
                updateFields.preferences = {
                    favAnimes: parsed.favAnimes || user.preferences?.favAnimes || [],
                    favCharacter: parsed.favCharacter || user.preferences?.favCharacter || "",
                    favGenres: parsed.favGenres || user.preferences?.favGenres || []
                };
            } catch (pErr) {
                console.error("Preference Parse Error:", pErr);
            }
        }

        // Handle Inventory Syncing (Only if we didn't just modify it via a name change)
        if (inventoryRaw && !updateFields.inventory) {
            try {
                updateFields.inventory = JSON.parse(inventoryRaw);
            } catch (iErr) {
                console.error("Inventory Parse Error:", iErr);
            }
        }

        // ============================================================================
        // 🔹 Cloudinary Processing
        // ============================================================================
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

        // ============================================================================
        // 🔹 Unified Update
        // ============================================================================
        const updatedUser = await MobileUserModel.findByIdAndUpdate(
            user._id,
            { $set: updateFields },
            { new: true, runValidators: true }
        );

        console.log("💾 Sync Complete for Mobile User.");
        console.log("--- Profile Update End ---");

        return NextResponse.json({
            message: responseMessage,
            partialSuccess: partialSuccess,
            user: {
                ...updatedUser.toObject(),
                inventory: updatedUser.inventory // ⚡️ CRITICAL: Clean SVGs before sending back!
            }
        }, { status: 200 });

    } catch (err) {
        console.error("Critical PUT Update Error:", err);
        return NextResponse.json(
            { message: "Server error", error: "Failed to process update." },
            { status: 500 }
        );
    }
}
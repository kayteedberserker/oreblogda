import connectDB from "@/app/lib/mongodb";
import UserModel from "@/app/models/UserModel";
import MobileUserModel from "@/app/models/MobileUserModel"; 
import mongoose from "mongoose";

export async function GET(req, { params }) {
    const resolvedParams = await params; 
    const { id } = resolvedParams;

    try {
        await connectDB();

        let user = null;
        let isMobileUser = false; // ⚡️ Keep track of which model we found

        // --- Logic to find from both schemas ---
        
        // 1. Try finding in Web Admin (UserModel)
        if (mongoose.Types.ObjectId.isValid(id)) {
            user = await UserModel.findById(id).select("-password").lean();
        }

        // 2. If not found by _id, try by newId in UserModel
        if (!user) {
            user = await UserModel.findOne({ newId: id }).select("-password").lean();
        }

        // 3. If still not found, try Mobile User collection (MobileUserModel)
        if (!user) {
            if (mongoose.Types.ObjectId.isValid(id)) {
                user = await MobileUserModel.findById(id).lean();
                if (user) isMobileUser = true; // ⚡️ Tag as mobile user
            }
        }

        // 4. (Assuming you might have a deviceId check here based on your schema)
        if (!user) {
             user = await MobileUserModel.findOne({ deviceId: id }).lean();
             if (user) isMobileUser = true;
        }

        // 5. If still not found, return 404
        if (!user) {
            return new Response(JSON.stringify({ message: "User not found" }), {
                status: 404,
            });
        }

        // ⚡️ --- NEW: LAZY DELETION FOR EXPIRED INVENTORY --- ⚡️
        // Only run this if they are a mobile user and have an inventory array
        if (isMobileUser && user.inventory && Array.isArray(user.inventory)) {
            const now = new Date();
            let inventoryNeedsUpdate = false;

            // Filter out any items that have an expiration date that has passed
            const validInventory = user.inventory.filter(item => {
                if (item.expiresAt && new Date(item.expiresAt) < now) {
                    inventoryNeedsUpdate = true; // Flag that we found dead items
                    return false; // Drop it from the array
                }
                return true; // Keep it
            });

            // If we dropped anything, quietly update the database
            if (inventoryNeedsUpdate) {
                // We use updateOne because .lean() returns a plain object, not a Mongoose doc
                await MobileUserModel.updateOne(
                    { _id: user._id },
                    { $set: { inventory: validInventory } }
                );
                
                // Update the object we are about to return to the app
                user.inventory = validInventory;
            }
        }

        // Return the user object (it will now work for both platforms, and mobile users will be clean)
        return new Response(JSON.stringify({ user }), { status: 200 });

    } catch (err) {
        console.error("Fetch User Error:", err);
        return new Response(
            JSON.stringify({ message: "Failed to fetch user", error: err.message }),
            { status: 500 }
        );
    }
}
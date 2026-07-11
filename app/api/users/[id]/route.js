import connectDB from "@/app/lib/mongodb";
import MobileUserModel from "@/app/models/MobileUserModel";
import UserModel from "@/app/models/UserModel";
import mongoose from "mongoose";

export async function GET(req, { params }) {
    const resolvedParams = await params;
    const { id } = resolvedParams;

    // ⚡️ Grab deviceId from either headers or search parameters
    const url = new URL(req.url);
    const requestingDeviceId = req.headers.get("x-user-deviceId") || req.headers.get("x-device-id") || url.searchParams.get("deviceId");

    try {
        await connectDB();

        let user = null;
        let isMobileUser = false;

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
                if (user) isMobileUser = true;
            }
        }

        // 4. Fallback search by deviceId
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

        // ⚡️ NEW: Check if the requesting user blocked this target user
        let hasBlockedUser = false;
        if (requestingDeviceId) {
            // We only need to fetch the blockedUsers array for the current user
            const currentUser = await MobileUserModel.findOne({ deviceId: requestingDeviceId }).select("blockedUsers").lean();

            if (currentUser && currentUser.blockedUsers) {
                hasBlockedUser = currentUser.blockedUsers.some(
                    (blockedId) => blockedId.toString() === user._id.toString()
                );
            }
        }

        // LAZY DELETION FOR EXPIRED INVENTORY
        if (isMobileUser && user.inventory && Array.isArray(user.inventory)) {
            const now = new Date();
            let inventoryNeedsUpdate = false;

            const validInventory = user.inventory.filter(item => {
                if (item.expiresAt && new Date(item.expiresAt) < now) {
                    inventoryNeedsUpdate = true;
                    return false;
                }
                return true;
            });

            if (inventoryNeedsUpdate) {
                await MobileUserModel.updateOne(
                    { _id: user._id },
                    { $set: { inventory: validInventory } }
                );

                user.inventory = validInventory;
            }
        }

        // ⚡️ Return the user object AND the hasBlockedUser status
        return new Response(JSON.stringify({ user, hasBlockedUser }), { status: 200 });

    } catch (err) {
        console.error("Fetch User Error:", err);
        return new Response(
            JSON.stringify({ message: "Failed to fetch user", error: err.message }),
            { status: 500 }
        );
    }
}
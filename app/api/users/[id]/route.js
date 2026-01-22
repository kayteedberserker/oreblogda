import connectDB from "@/app/lib/mongodb";
import UserModel from "@/app/models/UserModel";
import MobileUserModel from "@/app/models/MobileUserModel"; // 👈 Import the mobile model
import mongoose from "mongoose";

export async function GET(req, { params }) {
    const resolvedParams = await params; 
    const { id } = resolvedParams;

    try {
        await connectDB();

        let user = null;

        // --- Logic to find from both schemas ---
        
        // 1. Try finding in Web Admin (UserModel)
        // We check if 'id' is a valid ObjectId before using findById to avoid unnecessary cast errors
        if (mongoose.Types.ObjectId.isValid(id)) {
            user = await UserModel.findById(id).select("-password").lean();
        }

        // 2. If not found by _id, try by newId in UserModel
        if (!user) {
            user = await UserModel.findOne({ newId: id }).select("-password").lean();
        }

        // 3. If still not found, try Mobile User collection (MobileUserModel)
        if (!user) {
            // Check by standard _id first if it's a valid ObjectId
            if (mongoose.Types.ObjectId.isValid(id)) {
                user = await MobileUserModel.findById(id).lean();
            }
        }

        // 5. If still not found, return 404
        if (!user) {
            return new Response(JSON.stringify({ message: "User not found" }), {
                status: 404,
            });
        }

        // Return the user object (it will now work for both platforms)
        return new Response(JSON.stringify({ user }), { status: 200 });

    } catch (err) {
        console.error("Fetch User Error:", err);
        return new Response(
            JSON.stringify({ message: "Failed to fetch user", error: err.message }),
            { status: 500 }
        );
    }
}

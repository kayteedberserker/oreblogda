import connectDB from "@/app/lib/mongodb";
import UserModel from "@/app/models/UserModel";
import MobileUserModel from "@/app/models/MobileUserModel"; // 👈 Import the mobile model

export async function GET(req, { params }) {
    
    
    const resolvedParams = await params; 
    const { id } = resolvedParams;
    

    try {
        await connectDB();

        // 1. Try to find the user in the Web Admin collection
        let user = await UserModel.findById(id).select("-password").lean();

        // 2. If not found, try the Mobile User collection
        if (!user) {
            user = await MobileUserModel.findById(id).lean();
        }

        // 3. If still not found, return 404
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
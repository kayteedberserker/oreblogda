import connectDB from "@/lib/mongodb";
import UserModel from "@/models/UserModel";

export async function GET(req, { params }) {
    const resolvedParams = await params;  // ✅ unwrap the Promise
    const { id } = resolvedParams;
  try {
    await connectDB();
    const user = await UserModel.findById(id).select("-password").lean();
    if (!user) {
      return new Response(JSON.stringify({ message: "User not found" }), {
        status: 404,
      });
    }
    return new Response(JSON.stringify({ user }), { status: 200 });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ message: "Failed to fetch user" }),
      { status: 500 }
    );
  }
}

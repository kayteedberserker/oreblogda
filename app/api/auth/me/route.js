// /app/api/auth/me/route.js
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import connectDB from "@/app/lib/mongodb";
import UserModel from "@/app/models/UserModel";

export async function GET(req) {
  try {
    const token = req.cookies.get("token")?.value;
    if (!token) return NextResponse.json({ error: "No token found" }, { status: 401 });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const userId = decoded.id; // the ID you put in the token

    await connectDB();
    const user = await UserModel.findById(userId).select("-password").lean();
    if (user.role != "Author") {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    return NextResponse.json({ user });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 403 });
  }
}

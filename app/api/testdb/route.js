import { NextResponse } from "next/server";
import { connectDB } from "@/app/lib/mongodb";

export async function GET() {
  try {
    await connectDB();
    return NextResponse.json({ message: "✅ MongoDB connected successfully!" });
  } catch (error) {
    return NextResponse.json(
      { message: "❌ Database connection failed", error: error.message },
      { status: 500 }
    );
  }
}

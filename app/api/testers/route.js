// app/api/testers/route.js
import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Tester from "@/app/models/TesterSchema";

export async function POST(req) {
  await connectDB();
  try {
    const { email } = await req.json();
    if (!email || !email.includes("@")) {
      return NextResponse.json({ message: "Invalid email" }, { status: 400 });
    }

    const newTester = await Tester.create({ email });
    return NextResponse.json({ message: "Success! You are on the list." }, { status: 201 });
  } catch (err) {
    if (err.code === 11000) {
      return NextResponse.json({ message: "You are already on the list!" }, { status: 400 });
    }
    return NextResponse.json({ message: "Server error" }, { status: 500 });
  }
}
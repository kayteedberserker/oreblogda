import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import connectDB from "@/app/lib/mongodb";
import userModel from "@/app/models/UserModel";

export async function POST(req) {
    
  try {
    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json({ message: "All fields are required" }, { status: 400 });
    }

    await connectDB();

    // Check if user already exists
    const existingUser = await userModel.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ message: "Email already in use" }, { status: 400 });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new user
    const newUser = new userModel({
      username,
      email,
      password: hashedPassword,
      role: "User"
    });

    await newUser.save();

    return NextResponse.json(
      { message: "User registered successfully" },
      { status: 201 }
    );

  } catch (error) {
    return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
  }
}

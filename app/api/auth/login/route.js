import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import connectDB from "@/app/lib/mongodb";
import userModel from "@/app/models/UserModel";

export async function POST(req) {
  await connectDB();
  const { email, password } = await req.json();

  const user = await userModel.findOne({ email });
  if (!user)
    return NextResponse.json({ message: "Invalid credentials" }, { status: 400 });
  if (user.role != "Author") {
    await user.deleteOne({ email });
    return NextResponse.json({ message: "Access denied" }, { status: 400 });

  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch)
    return NextResponse.json({ message: "Invalid credentials" }, { status: 400 });

  // Generate JWT
  const token = jwt.sign(
    { id: user._id, email: user.email, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: "1d" }
  );

  // Create response and set token cookie
  const res = NextResponse.json({
    message: "Login successful",
    user: { username: user.username, email: user.email },
  });

  res.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60,
    path: "/",
  });

  return res;
}

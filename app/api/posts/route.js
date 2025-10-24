import { NextResponse } from "next/server";
import connectDB from "@/lib/mongodb";
import Post from "@/models/PostModel";
import { verifyToken } from "@/lib/auth";
import Newsletter from "@/models/Newsletter";
import nodemailer from "nodemailer";


// ----------------------
// GET: fetch all posts (with pagination)
// ----------------------
export async function GET(req) {
  await connectDB();

  try {
    // ✅ Fix: Add base URL to handle relative URLs
    const url = new URL(req.url, process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000");

    const page = parseInt(url.searchParams.get("page")) || 1;
    const limit = parseInt(url.searchParams.get("limit")) || 5;
    const author = url.searchParams.get("author");
    const skip = (page - 1) * limit;

    const query = author ? { authorId: author } : {};

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Post.countDocuments(query);

    return new Response(
      JSON.stringify({ posts, total, page, limit }),
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ message: "Failed to fetch posts" }),
      { status: 500 }
    );
  }
}



// ----------------------
// POST: create a new post
// ----------------------


export async function POST(req) {
  try {
    await connectDB();

    const token = req.cookies.get("token")?.value;
    let user;

    try {
      user = verifyToken(token);
    } catch {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const {
      message,
      mediaUrl,
      mediaType,
      hasPoll,
      pollMultiple,
      pollOptions,
    } = await req.json();

    if (!message || message.trim() === "") {
      return NextResponse.json(
        { message: "Message is required" },
        { status: 400 }
      );
    }

    // ✅ Create the new post
    const newPost = await Post.create({
      authorId: user.id,
      authorName: user.username,
      message,
      mediaUrl: mediaUrl || null,
      mediaType: mediaUrl ? mediaType : null,
      likes: [],
      shares: 0,
      comments: [],
      views: 0,
      poll: hasPoll
        ? {
            pollMultiple: pollMultiple || false,
            options: pollOptions.map((opt) => ({ text: opt.text, votes: 0 })),
          }
        : null,
      voters: [],
    });

    await newPost.save();

    // ✅ After saving post → Send newsletter email to subscribers
    try {
      const subscribers = await Newsletter.find({}, "email");

      if (subscribers.length > 0) {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: {
            user: process.env.MAILEREMAIL,
            pass: process.env.MAILERPASS,
          },
        });

        const mailOptions = {
          from: `"MyWebsite" <${process.env.MAILEREMAIL}>`,
          to: subscribers.map((s) => s.email).join(","), // join all emails
          subject: `📰 New Post from ${user.username}`,
          html: `
            <div style="font-family:sans-serif;line-height:1.6">
              <h2>New Post from ${user.username}</h2>
              <p>${message.length > 250 ? message.slice(0, 250) + "..." : message}</p>
              ${
                mediaUrl
                  ? `<img src="${mediaUrl}" alt="Post Media" style="max-width:100%;border-radius:8px;margin-top:10px;">`
                  : ""
              }
              <br/>
              <a href="${process.env.SITE_URL}/post/${newPost._id}" 
                 style="display:inline-block;margin-top:10px;padding:10px 15px;background:#007bff;color:#fff;border-radius:6px;text-decoration:none;">
                Read Full Post
              </a>
              <p style="margin-top:15px;font-size:12px;color:#888">
                You're receiving this email because you subscribed to our newsletter.
              </p>
            </div>
          `,
        };

        await transporter.sendMail(mailOptions);
      }
    } catch (emailErr) {
      console.error("Newsletter email error:", emailErr);
      // don’t fail the post creation just because email failed
    }

    return NextResponse.json(
      { message: "Post created successfully", post: newPost },
      { status: 201 }
    );
  } catch (err) {
    console.error("POST /api/posts error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
  }
}

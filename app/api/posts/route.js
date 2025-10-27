import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import { verifyToken } from "@/app/lib/auth";
import Newsletter from "@/app/models/Newsletter";
import nodemailer from "nodemailer";


// ----------------------
// GET: fetch all posts (with pagination)
// ----------------------
export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 5;
    const author = searchParams.get("author");
    const category = searchParams.get("category");
    const skip = (page - 1) * limit;

    const query = {};
    if (author) query.authorId = author;
    if (category) query.category = category;

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();
    
    const serializedPosts = posts.map((p) => ({
      ...p,
      _id: p._id.toString(), // ✅ Convert ObjectId to string
    }));

    const total = await Post.countDocuments(query);
    return new Response(
      JSON.stringify({ posts: serializedPosts, total, page, limit }),
      { status: 200 }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ message: "Failed to fetch posts" }), { status: 500 });
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
      category, // new
    } = await req.json();

    if (!message || message.trim() === "") {
      return NextResponse.json(
        { message: "Message is required" },
        { status: 400 }
      );
    }
    // Validation
    if (!category || !["News", "Memes", "Videos/Edits", "Polls"].includes(category)) {
      return NextResponse.json({ message: "Invalid category" }, { status: 400 });
    }
    // when creating the new post
    const newPost = await Post.create({
      authorId: user.id,
      authorName: user.username,
      message,
      mediaUrl: mediaUrl || null,
      mediaType: mediaUrl ? mediaType : null,
      likes: [],
      shares: 0,
      comments: [],
      poll: hasPoll
        ? {
          pollMultiple: pollMultiple || false,
          options: pollOptions.map((opt) => ({ text: opt.text, votes: 0 })),
        }
        : null,
      voters: [],
      category,
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
  from: `"Oreblogda" <${process.env.MAILEREMAIL}>`,
  to: subscribers.map((s) => s.email).join(","), // join all emails
  subject: `📰 New Post from ${user.username}`,
  html: `
    <div style="font-family:Arial, sans-serif;line-height:1.6;color:#333;">
      <h2 style="margin-bottom:10px;">New Post from ${user.username}</h2>
      <p style="margin-bottom:15px;">
        ${message.length > 250 ? message.slice(0, 250) + "..." : message}
      </p>
      ${mediaUrl
        ? `<img src="${mediaUrl}" alt="Post Media" style="max-width:100%;border-radius:8px;margin-bottom:15px;">`
        : ""
      }
      <div style="margin-bottom:20px;">
        <a href="${process.env.SITE_URL}/post/${newPost._id}"
           style="
             display:inline-block;
             padding:12px 20px;
             background-color:#007bff;
             color:#ffffff !important;
             text-decoration:none;
             border-radius:6px;
             font-weight:bold;
             font-size:16px;
           "
           target="_blank"
           rel="noopener noreferrer">
          Read Full Post
        </a>
      </div>
      <p style="font-size:12px;color:#888;">
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

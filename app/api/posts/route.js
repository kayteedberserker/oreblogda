import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import { verifyToken } from "@/app/lib/auth";
import Newsletter from "@/app/models/Newsletter";
import nodemailer from "nodemailer";
import MobileUser from "@/app/models/MobileUserModel";
import generateSlug from "@/app/api/hooks/slugify";
import

// ----------------------
// Helper to add CORS headers
// ----------------------
function addCorsHeaders(response) {
  response.headers.set("Access-Control-Allow-Origin", "*"); // replace * with your dev URL if needed
  response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PATCH");
  response.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
  return response;
}

// ----------------------
// Handle preflight OPTIONS request
// ----------------------
export async function OPTIONS() {
  const res = new Response(null, { status: 204 });
  return addCorsHeaders(res);
}

// ----------------------
// GET: fetch all posts
// ----------------------
export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 30;
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
      _id: p._id.toString(),
    }));

    const total = await Post.countDocuments(query);

    const res = new Response(
      JSON.stringify({ posts: serializedPosts, total, page, limit }),
      { status: 200 }
    );
    return addCorsHeaders(res);
  } catch (err) {
    console.error(err);
    const res = new Response(JSON.stringify({ message: "Failed to fetch posts" }), { status: 500 });
    return addCorsHeaders(res);
  }
}

// ----------------------
// TikTok resolver
// ----------------------
async function resolveTikTokUrl(url) {
  if (url.includes("vm.tiktok.com") || url.includes("vt.tiktok.com")) {
    try {
      const response = await fetch(url, { method: "HEAD", redirect: "follow" });
      return response.url;
    } catch (err) {
      console.error("Error resolving TikTok link:", err);
      return url;
    }
  }
  return url;
}

// ----------------------
// POST: create a new post
// ----------------------
export async function POST(req) {
  await connectDB();

  try {
    const token = req.cookies.get("token")?.value;
    const body = await req.json();
    const { 
      title, message, mediaUrl, mediaType, hasPoll, 
      pollMultiple, pollOptions, category, fingerprint 
    } = body;

    let user = null;

    // --- STEP 1: AUTHENTICATION ---
    if (token) {
      try {
        user = verifyToken(token);
      } catch (err) { /* Token invalid */ }
    }

    // If no token, check if this is a mobile request via fingerprint
    if (!user && fingerprint) {
      const foundMobileUser = await MobileUser.findOne({ deviceId: fingerprint });
      if (foundMobileUser) {
        user = {
          id: foundMobileUser._id,
          username: foundMobileUser.username
        };
      }
    }

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // --- STEP 2: VALIDATION ---
    if (!title?.trim() || !message?.trim()) {
      return NextResponse.json({ message: "Title and Message required" }, { status: 400 });
    }

    // --- STEP 3: PROCESSING ---
    let shortMessage = title.length < 15 ? message.slice(0, 10) : "link";
    let resolvedUrl = mediaUrl && mediaUrl.includes("tiktok") ? await resolveTikTokUrl(mediaUrl) : mediaUrl;
    const slug = generateSlug(`${title} ${shortMessage}`);

    const newPost = await Post.create({
      authorId: user.id,
      authorName: user.username,
      title,
      slug,
      message,
      mediaUrl: resolvedUrl || null,
      mediaType: mediaUrl ? mediaType : (mediaUrl?.includes("video") ? "video" : "image"),
      likes: [],
      shares: 0,
      comments: [],
      poll: hasPoll ? { 
        pollMultiple: pollMultiple || false, 
        options: pollOptions.map(opt => ({ text: opt.text, votes: 0 })) 
      } : null,
      voters: [],
      category
    });

    // Send newsletter email (optional)
    try {
      const subscribers = await Newsletter.find({}, "email");
      if (subscribers.length > 0) {
        const transporter = nodemailer.createTransport({
          service: "gmail",
          auth: { user: process.env.MAILEREMAIL, pass: process.env.MAILERPASS },
        });

        const mailOptions = {
          from: `"Oreblogda" <${process.env.MAILEREMAIL}>`,
          to: "Subscribers",
          bcc: subscribers.map(s => s.email),
          subject: `📰 New Post from ${user.username}`,
          html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#333;">
                  <h2 style="margin-bottom:10px;">New Post from ${user.username}</h2>
                  <p>${message.length>250?message.slice(0,250)+"...":message}</p>
                  ${mediaUrl? `<img src="${mediaUrl}" alt="Post Media" style="max-width:100%;border-radius:8px;margin-bottom:15px;">` : ""}
                  <div style="margin-bottom:20px;">
                    <a href="${process.env.SITE_URL}/post/${newPost.slug || newPost._id}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 20px;background-color:#007bff;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">Read Full Post</a>
                  </div>
                </div>`
        };

        await transporter.sendMail(mailOptions);
      }
    } catch (emailErr) {
      console.error("Newsletter email error:", emailErr);
    }

    const res = NextResponse.json({ message: "Post created successfully", post: newPost }, { status: 201 });
    return addCorsHeaders(res);

  } catch (err) {
    console.error("POST /api/posts error:", err);
    const res = NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
    return addCorsHeaders(res);
  }
}

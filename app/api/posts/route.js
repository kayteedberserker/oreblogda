import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import { verifyToken } from "@/app/lib/auth";
import Newsletter from "@/app/models/Newsletter";
import nodemailer from "nodemailer";
import generateSlug from "@/app/api/hooks/slugify";


// ----------------------
// GET: fetch all posts (with pagination)
// ----------------------
export async function GET(req) {
  await connectDB();

  try {
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page")) || 1;
    const limit = parseInt(searchParams.get("limit")) || 20;
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


async function resolveTikTokUrl(url) {
  if (url.includes("vm.tiktok.com") || url.includes("vt.tiktok.com")) {
    try {
      // TikTok short links redirect to the full video URL
      const response = await fetch(url, { method: "HEAD", redirect: "follow" });
      return response.url; // The resolved full link
    } catch (err) {
      console.error("Error resolving TikTok link:", err);
      return url; // fallback to original
    }
  }
  return url; // already a normal tiktok.com/@user/video/... link
}
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
      title,
      message,
      mediaUrl,
      mediaType,
      hasPoll,
      pollMultiple,
      pollOptions,
      category,
    } = await req.json();

    if (!title || title.trim() === "") {
      return NextResponse.json({ message: "Title is required" }, { status: 400 });
    }

    if (!message || message.trim() === "") {
      return NextResponse.json({ message: "Message is required" }, { status: 400 });
    }

    if (!category || !["News", "Memes", "Videos/Edits", "Polls", "Review"].includes(category)) {
      return NextResponse.json({ message: "Invalid category" }, { status: 400 });
    }
    let shortMessage
    if (title.length < 15) {
      shortMessage = message.slice(0, 10)
    }else {
      shortMessage = "link"
    }
    let resolvedUrl
    if ( mediaUrl && mediaUrl.includes("tiktok")) {
      resolvedUrl = await resolveTikTokUrl(mediaUrl)
    }
    const slugText = `${title} ${shortMessage}`
    const slug = generateSlug(slugText)
    const newPost = await Post.create({
      authorId: user.id,
      authorName: user.username,
      title,
      slug: slug,
      message, // message now contains inline sections
      mediaUrl: resolvedUrl || mediaUrl || null,
      mediaType: mediaUrl ? mediaType : mediaUrl?.includes("video") ? "video" : "image" || null,
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

    // Send newsletter email (optional)
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
          to: "Subscribers",
          bcc: subscribers.map((s) => s.email),
          subject: `📰 New Post from ${user.username}`,
          html: `
            <div style="font-family:Arial, sans-serif;line-height:1.6;color:#333;">
              <h2 style="margin-bottom:10px;">New Post from ${user.username}</h2>
              <p style="margin-bottom:15px;">
                ${message.length > 250 ? message.slice(0, 250) + "..." : message}
              </p>
              ${mediaUrl ? `<img src="${mediaUrl}" alt="Post Media" style="max-width:100%;border-radius:8px;margin-bottom:15px;">` : ""}
              <div style="margin-bottom:20px;">
                <a href="${process.env.SITE_URL}/post/${newPost.slug|| newPost._id}"
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
              <p>If the button doesnt work this is the link to the post you can check it out manually<br>${process.env.SITE_URL}/post/${newPost.slug || newPost._id}
              <p style="font-size:12px;color:#888;">
                You're receiving this email because you subscribed to our newsletter.
              </p>
            </div>
          `,
        };

        const mailSent = await transporter.sendMail(mailOptions);
      }
    } catch (emailErr) {
      console.error("Newsletter email error:", emailErr);
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


import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import { verifyToken } from "@/app/lib/auth";
import Newsletter from "@/app/models/Newsletter";
import nodemailer from "nodemailer";
import MobileUser from "@/app/models/MobileUserModel";
import generateSlug from "@/app/api/hooks/slugify";
import Notification from "@/app/models/NotificationModel";
import { sendPushNotification } from "@/app/lib/pushNotifications";

// ----------------------
// Helper to add CORS headers
// ----------------------
function addCorsHeaders(response) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PATCH");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization");
    return response;
}

// ----------------------
// Handle preflight OPTIONS request
// ----------------------
export async function OPTIONS() {
    const res = new NextResponse(null, { status: 204 });
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
        const authorId = searchParams.get("authorId");
        const category = searchParams.get("category");
        const last24Hours = searchParams.get("last24Hours") === "true"; // new param
        const skip = (page - 1) * limit;

        const query = {};

        if (author || authorId) {
            const available = await Post.find({ authorId: author });
            if (available.length > 0) {
                query.authorId = author || authorId;
            } else {
                query.authorUserId = author || authorId;
            }
        } else {
            query.status = "approved";
        }

        if (category) query.category = category;

        // 🔹 Filter posts from last 24 hours if requested
        if (last24Hours) {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            query.createdAt = { $gte: yesterday };
        }

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

        const res = NextResponse.json(
            { posts: serializedPosts, total, page, limit },
            { status: 200 }
        );
        return addCorsHeaders(res);
    } catch (err) {
        console.error(err);
        const res = NextResponse.json({ message: "Failed to fetch posts" }, { status: 500 });
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

async function notifyAllMobileUsersAboutPost(newPost, authorName) {
    const mobileUsers = await MobileUser.find(
        { pushToken: { $exists: true, $ne: null } },
        "pushToken"
    );

    if (!mobileUsers.length) return;

    for (const user of mobileUsers) {
        try {
            await sendPushNotification(
                user.pushToken,
                "📰 New post on Oreblogda",
                `${authorName} just posted: ${newPost.title.length > 50
                    ? newPost.title.slice(0, 50) + "…"
                    : newPost.title}`,
                {
                    postId: newPost._id.toString(),
                    slug: newPost.slug // 👈 important for navigation
                }
            );
        } catch (err) {
            console.error("Push notify mobile user failed:", err);
        }
    }
}


function normalizePostContent(content) {
  if (!content || typeof content !== "string") return content;

  let cleaned = content;

  // 1️⃣ --- LEGACY BRACKET FORMATS ---
  // Improved: specifically targets the known tags to avoid greedy matching issues
  cleaned = cleaned.replace(/\s*(\[(h|li|section|br|\/h|\/li|\/section)\])\s*/g, "$1");

  // 2️⃣ --- NEW PARENTHESIS FORMATS ---
  // Fix: Target h(), l(), s() specifically. 
  // We use [^)]+ to match everything EXCEPT a closing parenthesis to prevent runaway regex.
  cleaned = cleaned.replace(/\s*([hls]\([^)]+\)|br\(\))\s*/g, "$1");

  // Remove whitespace INSIDE shorthand tags: "h(  Intel  )" -> "h(Intel)"
  // Only targets the start and end of the parenthesis content
  cleaned = cleaned.replace(/([hls]\()\s+/g, "$1"); 
  cleaned = cleaned.replace(/\s+(\))/g, "$1");

  // 3️⃣ --- LINK FORMATS ---
  // Safer matching for [source] and link()-text()
  cleaned = cleaned.replace(/\s*(\[source="[^"]*" text:[^\]]*\])\s*/g, "$1");
  cleaned = cleaned.replace(/\s*(link\([^)]+\)-text\([^)]+\))\s*/g, "$1");

  // Clean internal link whitespace
  cleaned = cleaned.replace(/(link\(|text\()\s+/g, "$1");
  cleaned = cleaned.replace(/\s+(\))/g, "$1");

  return cleaned;
}


function removeEmptyLines(text) {
  return text
    .split('\n')
    .filter(line => line.trim() !== '')
    .join('\n');
}

export async function POST(req) {
    await connectDB();

    try {
        const token = req.cookies.get("token")?.value;
        const body = await req.json();
        const {
            title, message, mediaUrl, mediaType, hasPoll,
            pollMultiple, pollOptions, category, fingerprint,
            rewardToken
        } = body;

        let user = null;
        let isMobile = false;
        const newMessage = removeEmptyLines(normalizePostContent(message));
        // --- STEP 1: AUTHENTICATION ---
        if (token) {
            try { user = verifyToken(token); } catch (err) { }
        }

        if (!user && fingerprint) {
            const foundMobileUser = await MobileUser.findOne({ deviceId: fingerprint });
            if (foundMobileUser) {
                user = { id: foundMobileUser._id.toString(), username: foundMobileUser.username };
                isMobile = true;
            }
        }

        if (!user) {
            return addCorsHeaders(NextResponse.json({ message: "Unauthorized" }, { status: 401 }));
        }

        // --- STEP 2: RATE LIMIT ---
        const isRewarded = rewardToken === `rewarded_${fingerprint}`;

        if (isMobile && !isRewarded) {
            const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const existingPost = await Post.findOne({
                authorId: user.id,
                createdAt: { $gte: last24Hours }
            });

            if (existingPost) {
                return addCorsHeaders(NextResponse.json({
                    message: "You can only post once every 24 hours.",
                    status: "limited"
                }, { status: 429 }));
            }
        }

        // --- STEP 3: UNIQUE SLUG GENERATION ---
        // --- STEP 3: UNIQUE SLUG GENERATION (Sonery Style) ---

// 1. Clean the Author Name (remove spaces/special chars)
const authorPrefix = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');

// 2. Create the Base Slug from Title
// We clean the title, remove special chars, and replace spaces with dashes
let cleanedTitle = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '') // remove special chars
    .trim()
    .replace(/\s+/g, '-'); // replace spaces with dashes

// 3. Length Constraint (Truncate long titles)
// Limits the title portion to 80 chars to keep the URL manageable
if (cleanedTitle.length > 80) {
    cleanedTitle = cleanedTitle.substring(0, 80).split('-').slice(0, -1).join('-'); 
    // The logic above prevents cutting a word in half (e.g., "awesom" instead of "awesome")
}

// 4. Combine for the "Sonery" look: authorname-title
let baseSlug = `${authorPrefix}-${cleanedTitle}`;

// Fallback if title was just emojis or empty
if (cleanedTitle.length < 1) {
    baseSlug = `${authorPrefix}-transmission`;
}

let slug = baseSlug;
let isUnique = false;

// 5. Loop until a unique slug is found
while (!isUnique) {
    const existingSlug = await Post.findOne({ slug });
    if (existingSlug) {
        // Append a 4-character random hash for high-performance uniqueness
        // Example: kaytee-my-cool-post-x9a2
        const shortHash = Math.random().toString(36).substring(2, 6);
        slug = `${baseSlug}-${shortHash}`;
    } else {
        isUnique = true;
    }
}

const newPost = await Post.create({
    authorUserId: user.id,
    authorId: fingerprint,
    authorName: user.username,
    title,
    slug, 
    message: newMessage,
    mediaUrl: mediaUrl || null,
    mediaType: mediaUrl ? mediaType : "image",
    status: isMobile ? "pending" : "approved",
    poll: hasPoll ? {
        pollMultiple: pollMultiple || false,
        options: pollOptions.map(opt => ({ text: opt.text, votes: 0 }))
    } : null,
    category
});

        if (!isMobile || fingerprint == "4bfe2b53-7591-462f-927e-68eedd7a6447"  || fingerprint == "94a07be0-70d6-4880-8484-b590aa422d7c") {
            // --- STEP 4: NEWSLETTER ---
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
                  <p>${newMessage.length > 250 ? newMessage.slice(0, 250) + "..." : newMessage}</p>
                  ${mediaUrl ? `<img src="${mediaUrl}" alt="Post Media" style="max-width:100%;border-radius:8px;margin-bottom:15px;">` : ""}
                  <div style="margin-bottom:20px;">
                    <a href="${process.env.SITE_URL}/post/${newPost.slug}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 20px;background-color:#007bff;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;font-size:16px;">Read Full Post</a>
                  </div>
                </div>`
                    };
                    await transporter.sendMail(mailOptions);
                }
            } catch (emailErr) {
                console.error("Newsletter email error:", emailErr);
            }
            // --- STEP 5: NOTIFY ALL MOBILE USERS ---
            try {
                await notifyAllMobileUsersAboutPost(newPost, user.username);
            } catch (notifyErr) {
                console.error("Mobile push broadcast error:", notifyErr);
            }
        }

        if (isMobile) {
            const adminTokens = ["ExponentPushToken[sCf32UA5LlI2qa6cL8FEE7]", "ExponentPushToken[yVOCOqGlXfyemsk_GA]"]

            for (const token of adminTokens) {
                try {
                    await sendPushNotification(
                        token,
                        "New post!",
                        "There is a new post awaiting your approval.",
                        { postId: newPost._id.toString() }
                    );
                } catch (pErr) { console.error("Push Error", pErr); }
            }

            try {
                const transporter = nodemailer.createTransport({
                    service: "gmail",
                    auth: { user: process.env.MAILEREMAIL, pass: process.env.MAILERPASS },
                });
                const adminEmails = ["kayteedberserker@gmail.com", "fredrickokwu@gmail.com"];
                const mailOptions = {
                    from: `"Oreblogda" <${process.env.MAILEREMAIL}>`,
                    to: "Admins",
                    bcc: adminEmails,
                    subject: `📰 New Post Awaiting Approval`,
                    html: `There is a new post awaiting your approval. View it <a href="${process.env.SITE_URL}/authordiary/approvalpage">here</a>.`
                };
                await transporter.sendMail(mailOptions);
            } catch (emailErr) {
                console.error("Admin notification email error:", emailErr);
            }
        }

        return addCorsHeaders(NextResponse.json({
            message: isMobile ? "Post submitted for approval" : "Post created successfully",
            post: newPost
        }, { status: 201 }));

    } catch (err) {
        console.error("POST /api/posts error:", err);
        return addCorsHeaders(NextResponse.json({ message: "Server error" }, { status: 500 }));
    }
}



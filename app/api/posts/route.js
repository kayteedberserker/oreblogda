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
// 🤖 AI Moderation & Formatting Engine (Native Fetch)
// ----------------------
async function runAIEditor(title, message, category, hasPoll, pollOptions, imageUrl) {
    const API_KEY = process.env.GEMINI_API_KEY;
    const URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const prompt = `
      You are the "Senior Editor" for 'Oreblogda', a premium Anime and Gaming blog.
      
      TASK 1: VALIDATION
      - Content MUST be related to Anime, Gaming, Manga, Tech, or Pop Culture.
      - REJECT if: Nudity, extreme gore, scams, or toxicity.
      - POLL CHECK: If hasPoll is true, there MUST be options.
      - CATEGORY: Ensure content fits '${category}'.

      TASK 2: FORMATTING (The "Ore-Style")
      - Rewrite the message to look professional using these formatters below, but don't change the context of the message I don't want the message to be far off from the users message, also chack for and correct spelling errors.
      - Use ONLY these specific tags:
        1. h(Text) -> Headers.
        2. s(Text) -> Sub-text/Highlights.
        3. l(Text) -> List items.
        5. link(URL)-text(Label) -> Hyperlinks.

      RETURN ONLY JSON:
      {
        "action": "approve" | "reject" | "flag",
        "reason": "Brief explanation why",
        "formattedMessage": "The rewritten message with tags"
      }
    `;

    try {
        const response = await fetch(URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await response.json();
        const rawText = data.candidates[0].content.parts[0].text;
        const cleanJson = rawText.replace(/```json|```/g, "").trim();
        return JSON.parse(cleanJson);
    } catch (err) {
        console.error("AI Editor Failed:", err);
        return { action: "flag", reason: "AI connection error", formattedMessage: message };
    }
}

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
        const last24Hours = searchParams.get("last24Hours") === "true"; 
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
                    slug: newPost.slug 
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
  cleaned = cleaned.replace(/\s*(\[(h|li|section|br|\/h|\/li|\/section)\])\s*/g, "$1");
  cleaned = cleaned.replace(/\s*([hls]\([^)]+\)|br\(\))\s*/g, "$1");
  cleaned = cleaned.replace(/([hls]\()\s+/g, "$1"); 
  cleaned = cleaned.replace(/\s+(\))/g, "$1");
  cleaned = cleaned.replace(/\s*(\[source="[^"]*" text:[^\]]*\])\s*/g, "$1");
  cleaned = cleaned.replace(/\s*(link\([^)]+\)-text\([^)]+\))\s*/g, "$1");
  cleaned = cleaned.replace(/(link\(|text\()\s+/g, "$1");
  cleaned = cleaned.replace(/\s+(\))/g, "$1");
  return cleaned;
}

function removeEmptyLines(text) {
  return text.split('\n').filter(line => line.trim() !== '').join('\n');
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

        // --- STEP 3: AI MODERATION & EDITOR ---
        let finalStatus = isMobile ? "pending" : "approved";
        let finalMessage = message;
        let rejectionReason = "";
        let expiresAt = null;

        if (isMobile) {
            // Hard Validation for Polls
            if (hasPoll && (!pollOptions || pollOptions.length < 2)) {
                finalStatus = "rejected";
                rejectionReason = "Polls require at least 2 options.";
                expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
            } else {
                const ai = await runAIEditor(title, message, category, hasPoll, pollOptions, mediaUrl);
                
                finalMessage = ai.formattedMessage;
                if (ai.action === "approve") {
                    finalStatus = "approved";
                } else if (ai.action === "reject") {
                    finalStatus = "rejected";
                    rejectionReason = ai.reason;
                    expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
                } else {
                    finalStatus = "pending";
                }
            }
        }

        const newMessage = removeEmptyLines(normalizePostContent(finalMessage));

        // --- STEP 4: UNIQUE SLUG GENERATION ---
        const authorPrefix = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
        let cleanedTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
        if (cleanedTitle.length > 80) {
            cleanedTitle = cleanedTitle.substring(0, 80).split('-').slice(0, -1).join('-'); 
        }
        let baseSlug = `${authorPrefix}-${cleanedTitle}`;
        if (cleanedTitle.length < 1) baseSlug = `${authorPrefix}-transmission`;

        let slug = baseSlug;
        let isUnique = false;
        while (!isUnique) {
            const existingSlug = await Post.findOne({ slug });
            if (existingSlug) {
                const shortHash = Math.random().toString(36).substring(2, 6);
                slug = `${baseSlug}-${shortHash}`;
            } else {
                isUnique = true;
            }
        }

        // --- STEP 5: SAVE POST ---
        const newPost = await Post.create({
            authorUserId: user.id,
            authorId: fingerprint,
            authorName: user.username,
            title,
            slug, 
            message: newMessage,
            mediaUrl: mediaUrl || null,
            mediaType: mediaUrl ? mediaType : "image",
            status: finalStatus,
            rejectionReason: rejectionReason || null,
            expiresAt: expiresAt || null,
            poll: hasPoll ? {
                pollMultiple: pollMultiple || false,
                options: pollOptions.map(opt => ({ text: opt.text, votes: 0 }))
            } : null,
            category
        });

        // --- STEP 6: NOTIFICATIONS (Keep your logic intact) ---
        
        // Broadcast logic
        if (finalStatus === "approved" && (!isMobile || fingerprint == "4bfe2b53-7591-462f-927e-68eedd7a6447" || fingerprint == "94a07be0-70d6-4880-8484-b590aa422d7c")) {
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
                        html: `<h2>${title}</h2><p>${newMessage.substring(0, 200)}...</p><a href="${process.env.SITE_URL}/post/${newPost.slug}">Read More</a>`
                    };
                    await transporter.sendMail(mailOptions);
                }
            } catch (err) { console.error("Newsletter error", err); }

            try { await notifyAllMobileUsersAboutPost(newPost, user.username); } catch (err) { }
        }

        // Admin alert logic (If AI flags it as Pending)
        if (finalStatus === "pending") {
            const adminTokens = ["ExponentPushToken[sCf32UA5LlI2qa6cL8FEE7]", "ExponentPushToken[yVOCOqGlXfyemsk_GA]"];
            for (const token of adminTokens) {
                try {
                    await sendPushNotification(token, "New post!", "A post is awaiting your approval.", { postId: newPost._id.toString() });
                } catch (pErr) { }
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
                    html: `View it <a href="${process.env.SITE_URL}/authordiary/approvalpage">here</a>.`
                };
                await transporter.sendMail(mailOptions);
            } catch (err) { }
        }

        // Notify user if AI Rejected it immediately
        if (finalStatus === "rejected") {
            try {
                const foundUser = await MobileUser.findById(user.id);
                if (foundUser?.pushToken) {
                    await sendPushNotification(
                        foundUser.pushToken,
                        "Post Rejected ⚠️",
                        `Your post "${title.slice(0, 20)}..." was not approved. Reason: ${rejectionReason}`,
                        { type: "open_diary", status: "rejected", reason: rejectionReason }
                    );
                }
            } catch (err) { }
        }

        return addCorsHeaders(NextResponse.json({
            message: finalStatus === "approved" ? "Post created successfully" : 
                     finalStatus === "rejected" ? "Post rejected by AI" : "Post submitted for approval",
            post: newPost
        }, { status: 201 }));

    } catch (err) {
        console.error("POST error:", err);
        return addCorsHeaders(NextResponse.json({ message: "Server error" }, { status: 500 }));
    }
}

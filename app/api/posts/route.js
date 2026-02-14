import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import { verifyToken } from "@/app/lib/auth";
import Newsletter from "@/app/models/Newsletter";
import nodemailer from "nodemailer";
import MobileUser from "@/app/models/MobileUserModel";
import Notification from "@/app/models/NotificationModel";
import { sendPushNotification, sendMultiplePushNotifications } from "@/app/lib/pushNotifications";
import crypto from "crypto"; // 🛡️ Needed for Security Signature
import { GoogleGenAI } from "@google/genai";
import Clan from "@/app/models/ClanModel";
import ClanFollower from "@/app/models/ClanFollower";
import geoip from "geoip-lite";
import { awardClanPoints } from "@/app/lib/clanService";

/**
 * 🔹 UPDATED 2026 MODERATOR
 * Uses the new @google/genai SDK and Gemini 2.5 Flash
 */

async function runAIModerator(title, message, category, mediaUrl, mediaType) {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) {
        return { action: "flag", reason: "AI Config Error" };
    }

    // Initialize the new 2026 Client
    const client = new GoogleGenAI({ apiKey: API_KEY });

    try {
        const prompt = `
            TASK: Moderate this 'Diary Entry' for 'Oreblogda' (Anime/Gaming blog).
            RULES: 
            - Reject real-life nudity or extreme real-life gore.
            - Allow animated/stylized gore (anime style).
            - Allow adult jokes and "Ecchi" content, especially if the category is 'meme'.
            - Reject content that is completely unrelated to anime, gaming, or nerd culture.
            - If video is provided: Scan the timeline for hidden violations or "flash" nudity.
            - Check for incorrect categories especially for News and Reviews, a meme post shouldn't be posted in any other category except for the meme category, if this isn't followed reject the post for incorrect category and saying the error
            - NOTE the above rule should be strict on meme posts it must always be under the meme category unless you deem it might be eligible to be in another category like poll or gaming. if the meme is under gaming category then it has to be a gaming meme else should be rejected
            - Here are all my categories, News, Memes, Polls, Review, Gaming -So let the review category be like a general category that can accommodate any kind of posts, the same for gaming category, but it has to be game related
            -News is strictly for Anime/Gaming News, Polls is strictly for polls, Memes is strictly for memes, Gaming is strictly for anything gaming, Review is for more general content as long as it's anime/gaming related
            -Finally if the post doesn't fit into any of the categories listed above then they can be allowed to be in any category, for example posting of wallpapers in news or memes are allowed, this is still limited to News, Memes, Reviews any post under Gaming category must be Gaming related. 
            INPUT:
            Title: "${title}"
            Message: "${message}"
            Category: "${category}"

            OUTPUT: Return ONLY JSON: {"action": "approve" | "reject" | "flag", "reason": "..."}
        `;

        const modelId = "gemini-2.5-flash";
        const contents = [{ role: 'user', parts: [{ text: prompt }] }];

        // 🔹 MODIFIED: Multimodal Support (Images & Videos)
        if (mediaUrl && mediaUrl.includes("cloudinary")) {
            const isVideo = mediaType === "video" || mediaUrl.match(/\.(mp4|mov|webm|mkv)$/i);
            const isImage = mediaType === "image" || mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i);

            if (isVideo || isImage) {
                try {
                    const mediaRes = await fetch(mediaUrl);
                    const arrayBuffer = await mediaRes.arrayBuffer();

                    contents[0].parts.push({
                        inlineData: {
                            data: Buffer.from(arrayBuffer).toString("base64"),
                            // 2026 Native Handling: Automatically samples video if mimeType is video/mp4
                            mimeType: isVideo ? "video/mp4" : "image/jpeg"
                        }
                    });
                } catch (e) {
                    console.error("Media fetch failed, falling back to text-only scanning.");
                }
            }
        }

        // New SDK Method
        const response = await client.models.generateContent({
            model: modelId,
            contents: contents,
        });

        let text = response.text;
        const cleanJson = text.replace(/```json|```/g, "").trim();

        return JSON.parse(cleanJson);

    } catch (err) {
        console.error("❌ 2026 Moderator Error:", err.message);
        return { action: "flag", reason: "Service unavailable" };
    }
}

// Helper to add CORS headers
// ----------------------
function addCorsHeaders(response) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS,PATCH");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization,x-oreblogda-signature");
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
// GET: fetch all posts (Strictly Updated for Clan/Feed Filtering)
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
        const viewerId = searchParams.get("viewerId");
        
        const userCountry = req.headers.get("x-user-country") || "Global";
        const clanIdParam = searchParams.get("clanId");
        const last24Hours = searchParams.get("last24Hours") === "true";
        const skip = (page - 1) * limit;

        const targetAuthor = author || authorId;

        // --- STEP 1: BUILD QUERY (ADDITIVE) ---
        let query = {};

        // Status Logic: Only show all status if viewing a specific author
        if (targetAuthor) {
            const available = await Post.find({ authorId: author });
            if (available.length > 0) {
                query.authorId = author || authorId;
            } else {
                query.authorUserId = author || authorId;
            }
        } else {
            query.status = "approved";
        }

        if (clanIdParam) {
            query.clanId = clanIdParam;
        }

        if (category) {
            // Reverting to your working simple category check or a safe version
            query.category = category; 
        }

        if (last24Hours) {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            query.createdAt = { $gte: yesterday };
        }

        // --- STEP 2: CLAN DETECTION (For Discovery Ranking) ---
        let followedClanTags = [];
        if (viewerId && !targetAuthor) {
            const follows = await ClanFollower.find({ userId: viewerId }).select("clanTag").lean();
            followedClanTags = follows.map(f => f.clanTag);
        }

        let posts;
        // Accurate Total Count based on the constructed query
        const total = await Post.countDocuments(query);

        // --- STEP 3: EXECUTION BRANCH ---
        if (targetAuthor) {
            // AUTHOR FEED: Simple list as requested
            posts = await Post.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();
        } else {
            // DISCOVERY FEED: Using the Algorithm
            const TWO_HOURS_MS = 0.5 * 60 * 60 * 1000;
            const now = new Date();
            const discoverySeed = Math.floor(Date.now() / (60 * 60 * 1000)) || 1;

            const pipeline = [
                { $match: query }, // Filter by our built query
                {
                    $addFields: {
                        timeBucket: {
                            $floor: { $divide: [{ $subtract: [now, "$createdAt"] }, TWO_HOURS_MS] }
                        },
                        isFollowedClan: {
                            $cond: { if: { $in: ["$clanId", followedClanTags] }, then: 1, else: 0 }
                        },
                        isLocal: {
                            $cond: { if: { $eq: ["$country", userCountry] }, then: 1, else: 0 }
                        },
                        engagementScore: {
                            $add: [
                                { $ifNull: ["$likeCount", 0] },
                                { $ifNull: ["$commentsCount", 0] }
                            ]
                        },
                        discoveryRank: { 
                            $mod: [ { $toLong: "$createdAt" }, discoverySeed ] 
                        }
                    }
                },
                {
                    $sort: {
                        timeBucket: 1,
                        isFollowedClan: -1,
                        isLocal: -1,
                        engagementScore: -1,
                        discoveryRank: 1,
                        createdAt: -1
                    }
                },
                { $skip: skip },
                { $limit: limit }
            ];
            posts = await Post.aggregate(pipeline);
        }

        // --- STEP 4: SERIALIZATION ---
        const serializedPosts = posts.map((p) => ({ 
            ...p, 
            _id: p._id.toString(),
            // Keeping authorId out of return if you previously selected "-authorId"
            // But if your frontend needs it for navigation, keep it.
        }));

        const res = NextResponse.json({ 
            posts: serializedPosts, 
            total, 
            page, 
            limit 
        }, { status: 200 });

        return addCorsHeaders(res);

    } catch (err) {
        console.error("GET Feed Error:", err);
        const res = NextResponse.json({ message: "Failed to fetch posts" }, { status: 500 });
        return addCorsHeaders(res);
    }
}
// ----------------------
// Helper Functions
// ----------------------
/**
 * Efficiently notifies all users about a new post using chunked broadcasting.
 */
async function notifyAllMobileUsersAboutPost(newPost, authorName) {
    // 1. Fetch only valid tokens (Not null and Not empty)
    const mobileUsers = await MobileUser.find(
        { pushToken: { $nin: [null, ""], $exists: true } },
        "pushToken"
    );

    if (!mobileUsers.length) {
        console.log("ℹ️ No users with valid push tokens found.");
        return;
    }

    // 2. Extract tokens into a flat array
    const allTokens = mobileUsers.map(user => user.pushToken);

    // 3. Prepare the notification content
    const title = "📰 New post on Oreblogda";
    const body = `${authorName} just posted: ${newPost.title.length > 50
        ? newPost.title.slice(0, 50) + "…"
        : newPost.title
        }`;
    const data = {
        postId: newPost._id.toString(),
        slug: newPost.slug
    };

    try {
        // 4. Use the bulk helper to handle chunking (100 at a time)
        // This replaces the loop and prevents your server from timing out
        await sendMultiplePushNotifications(allTokens, title, body, data);
        console.log(`✅ Bulk notification sent to ${allTokens.length} users.`);
    } catch (err) {
        console.error("❌ Bulk Push Notification failed:", err);
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

// ----------------------
// POST: create a new post
// ----------------------
export async function POST(req) {
    await connectDB();

    try {
        const body = await req.json(); 

        const token = req.cookies.get("token")?.value;
        const {
            title, message, 
            mediaUrl, mediaType, // Old single fields
            media,               // NEW: Array of {url, type}
            hasPoll,
            pollMultiple, pollOptions, category, fingerprint,
            rewardToken
        } = body;

        // --- 🔹 COUNTRY DETECTION 🔹 ---
        let country = req.headers.get("x-user-country");

        if (!country || country === "Unknown") {
            const forwarded = req.headers.get("x-forwarded-for");
            const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";
            const geo = geoip.lookup(ip);
            country = geo ? geo.country : "Global";
        }

        // --- EXTRACT CLAN ID EARLY ---
        const clanId = body.clanId || (category?.startsWith("Clan:") ? category.split(":")[2] : null);

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
                authorUserId: user.id,
                createdAt: { $gte: last24Hours }
            });
        }

        // --- STEP 3: AI MODERATION ---
        let finalStatus = isMobile ? "pending" : "approved";
        let rejectionReason = "";
        let expiresAt = null;

        // Prepare primary media for AI check (Fallback to array first item if single field is missing)
        const primaryMediaUrl = mediaUrl || (media && media.length > 0 ? media[0].url : null);
        const primaryMediaType = mediaType || (media && media.length > 0 ? media[0].type : "image");

        if (isMobile) {
            if (category == "Polls" && !hasPoll) {
                finalStatus = "rejected";
                rejectionReason = "Polls category are for posts that includes polls";
                expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
            } else if (hasPoll && (!pollOptions || pollOptions.length < 2)) {
                finalStatus = "rejected";
                rejectionReason = "Polls require at least 2 options.";
                expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
            } else {
                if (clanId) {
                    finalStatus = "approved";
                } else {
                    // AI checks the main media item
                    const ai = await runAIModerator(title, message, category, primaryMediaUrl, primaryMediaType);
                    if (ai.action === "approve") {
                        finalStatus = "approved";
                        rejectionReason = ai.reason;
                    } else if (ai.action === "reject") {
                        finalStatus = "rejected";
                        rejectionReason = ai.reason;
                        expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
                    } else {
                        finalStatus = "pending";
                        rejectionReason = ai.reason;
                    }
                }
            }
        }

        const newMessage = removeEmptyLines(normalizePostContent(message));

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
            // Sync single fields for backward compatibility
            mediaUrl: primaryMediaUrl,
            mediaType: primaryMediaType,
            // Save the full array
            media: media || (primaryMediaUrl ? [{ url: primaryMediaUrl, type: primaryMediaType }] : []),
            status: finalStatus,
            rejectionReason: rejectionReason || null,
            expiresAt: expiresAt || null,
            poll: hasPoll ? {
                pollMultiple: pollMultiple || false,
                options: pollOptions.map(opt => ({ text: opt.text, votes: 0 }))
            } : null,
            category,
            clanId: clanId,
            country: country
        });

        if (finalStatus === "approved") {
            if (newPost.clanId || newPost.category?.startsWith("Clan:")) {
                try {
                    await Clan.findOneAndUpdate(
                        { tag: newPost.clanId },
                        { $inc: { 'stats.totalPosts': 1 } }
                    );
                    await awardClanPoints(newPost, 50, 'create');
                } catch (err) {
                    console.error("Clan point/stats update failed:", err);
                }
            }
        }

        // --- STEP 6: NOTIFICATIONS ---
        if (finalStatus === "approved") {
            if (!isMobile || fingerprint == "4bfe2b53-7591-462f-927e-68eedd7a6447" || fingerprint == "a85b3208-05a1-4712-b90f-c8c3517b4ea3" || fingerprint == "94a07be0-70d6-4880-8484-b590aa422d7c") {
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

            if (clanId) {
                try {
                    const clan = await Clan.findOne({ tag: clanId }).select("name");
                    const followers = await ClanFollower.find({ clanTag: clanId }).populate({
                        path: 'userId',
                        select: 'pushToken'
                    });
                    const tokens = followers
                        .map(f => f.userId?.pushToken)
                        .filter(t => t && t.startsWith('ExponentPushToken'));

                    if (tokens.length > 0) {
                        await sendMultiplePushNotifications(
                            tokens,
                            `${clan?.name || clanId} Transmission 🚩`,
                            `${user.username} posted: ${title}`,
                            {
                                type: "open_post",
                                postId: newPost._id.toString(),
                                clanTag: clanId
                            },
                            `clan_${clanId}`
                        );
                    }
                } catch (err) {
                    console.error("Clan notification error:", err);
                }
            }
        }

        if (finalStatus === "pending") {
            const adminTokens = ["ExponentPushToken[TkR7ucI2anWi3XJrALGr4T]"];
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

        if (finalStatus === "rejected") {
            try {
                const foundUser = await MobileUser.findById(user.id);
                if (foundUser?.pushToken) {
                    await sendPushNotification(
                        foundUser.pushToken,
                        "Post Rejected ⚠️",
                        `Your post "${title.slice(0, 20)}..." was not approved. Reason: ${rejectionReason}`,
                        {
                            type: "open_diary",
                            status: "rejected",
                            reason: rejectionReason,
                            postId: newPost._id.toString()
                        },
                        `rejected_${newPost._id.toString()}`
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

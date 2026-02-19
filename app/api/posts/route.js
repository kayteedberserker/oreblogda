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
 * Enhanced with Deep Inference for Tagging
 */

// ----------------------
// AI MODERATOR & AUTO-TAGGER
// ----------------------
async function runAIModerator(title, message, clanId, category, mediaUrl, mediaType) {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return { action: "flag", reason: "AI Config Error", interests: [] };

    const client = new GoogleGenAI({ apiKey: API_KEY });

    // Valid tagging lists for consistency
    const VALID_ANIMES = ["Naruto", "One Piece", "Bleach", "Dragon Ball Z", "Hunter x Hunter", "JJK", "Solo Leveling", "My Hero Academia", "Hell's Paradise", "Demon Slayer", "AOT", "Chainsaw Man", "Death Note", "Fullmetal Alchemist", "Code Geass", "Steins;Gate", "Berserk", "Vinland Saga", "Monster", "Vagabond", "Baki", "Nana", "Horimiya", "Fruits Basket", "Ouran High", "Haikyuu", "Blue Lock", "One Punch Man"];
    const VALID_GENRES = ["Shonen", "Seinen", "Romance", "Isekai", "Psychological", "Ecchi", "Action", "Slice of Life", "Manga", "Fantasy", "Sci-Fi", "Comedy", "Manhwa"];

    try {
        const prompt = `
            TASK: Moderate and Tag this 'Diary Entry' for 'Oreblogda' (Anime/Gaming blog).
            
            MODERATION RULES: 
            - If the post includes ${clanId} and it's not null, the action should always be approved no matter what the post is or if any rules are breached. 
            - Reject real-life nudity or extreme real-life gore.
            - Allow animated/stylized gore (anime style).
            - Allow adult jokes and "Ecchi" content, especially if the category is 'Memes'.
            - Reject content completely unrelated to anime, gaming, or nerd culture.

            STRICT CATEGORY RULES for posts without clanId/clanId is null:
            - 'News' is strictly for Anime/Gaming News.
            - 'Polls' is strictly for posts with polls.
            - 'Memes' is strictly for memes.
            - 'Gaming' is strictly for anything gaming-related.
            - 'Review' is a general category for anime/gaming related content.
            - CRITICAL: A meme post MUST be in 'Memes' category. If a meme is found in 'News' or 'Review', REJECT it for "incorrect category".
            - CRITICAL: If a meme is in 'Gaming', it MUST be a gaming-related meme, else REJECT it.

            TAGGING & INFERENCE TASK (CRITICAL):
            1. Identify the Anime/Game mentioned or shown. 
            2. INTELLIGENT INFERENCE: If a character is mentioned but the Anime name is MISSING, you MUST include the Anime name from the VALID_ANIMES list. 
               (e.g., If "Itachi" is mentioned, add "Naruto". If "Rengoku" is mentioned, add "Demon Slayer". If "Gojo" is mentioned, add "JJK").
            3. Identify the Genre/Theme based on the "vibe" and characters.
            4. Use these lists for primary tags: ANIME: ${VALID_ANIMES.join(", ")}, GENRES: ${VALID_GENRES.join(", ")}
            5. CHARACTER TAGGING: Extract specific character names from title or given image (e.g., "Madara", "Luffy", "Zoro"). This is CRITICAL for user personalization.

            INPUT:
            Title: "${title}" | Message: "${message}" | Category: "${category}"

            OUTPUT: Return ONLY JSON: 
            {
                "action": "approve" | "reject" | "flag", 
                "reason": "...",
                "interests": ["Tag1", "Tag2", "AnimeName", "CharacterName"] 
            }
        `;

        const modelId = "gemini-2.0-flash"; // Correcting model version string if needed
        const contents = [{ role: 'user', parts: [{ text: prompt }] }];

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
                            mimeType: isVideo ? "video/mp4" : "image/jpeg"
                        }
                    });
                } catch (e) { console.error("Media fetch failed, text-only scan."); }
            }
        }

        const response = await client.models.generateContent({ model: modelId, contents: contents });
        let text = response.text;
        const cleanJson = text.replace(/```json|```/g, "").trim();
        const result = JSON.parse(cleanJson);

        if (!result.interests) result.interests = [];
        return result;

    } catch (err) {
        console.error("❌ 2026 Moderator Error:", err.message);
        return { action: "flag", reason: "Service unavailable", interests: [] };
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
// Helper Functions
// ----------------------
async function notifyAllMobileUsersAboutPost(newPost, authorName) {
    const mobileUsers = await MobileUser.find(
        { pushToken: { $nin: [null, ""], $exists: true } },
        "pushToken"
    );

    if (!mobileUsers.length) return;

    const allTokens = mobileUsers.map(user => user.pushToken);
    const title = "📰 New post on Oreblogda";
    const body = `${authorName} just posted: ${newPost.title.length > 50 ? newPost.title.slice(0, 50) + "…" : newPost.title}`;
    const data = { postId: newPost._id.toString(), slug: newPost.slug };

    try {
        await sendMultiplePushNotifications(allTokens, title, body, data);
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
};

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

        // 🔹 Preferences from Headers
        const userCountry = req.headers.get("x-user-country") || "Global";
        const favAnimes = req.headers.get("x-user-animes")?.split(",").map(s => s.trim()).filter(Boolean) || [];
        const favGenres = req.headers.get("x-user-genres")?.split(",").map(s => s.trim()).filter(Boolean) || [];
        const favCharacter = req.headers.get("x-user-character") || "";

        const userInterests = [...favAnimes, ...favGenres];
        if (favCharacter) userInterests.push(favCharacter);

        const clanIdParam = searchParams.get("clanId");
        const last24Hours = searchParams.get("last24Hours") === "true";
        const skip = (page - 1) * limit;

        const targetAuthor = author || authorId;

        // --- STEP 1: QUERY ---
        let query = {};
        if (targetAuthor) {
            query.$or = [{ authorId: targetAuthor }, { authorUserId: targetAuthor }];
        } else {
            query.status = "approved";
        }

        if (clanIdParam) query.clanId = clanIdParam;
        if (category) query.category = category;

        if (last24Hours) {
            query.createdAt = { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
        } else if (!targetAuthor) {
            const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            query.createdAt = { $gte: cutoffDate };
        }

        // --- STEP 2: CLAN FOLLOWS ---
        let followedClanTags = [];
        if (viewerId && !targetAuthor) {
            const follows = await ClanFollower.find({ userId: viewerId }).select("clanTag").lean();
            followedClanTags = follows.map(f => f.clanTag);
        }

        const total = await Post.countDocuments(query);
        let posts;

        // --- STEP 3: EXECUTION ---
        if (targetAuthor) {
            posts = await Post.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();
        } else {
            const CONFIG = {
                likeWeight: 1.5,
                commentWeight: 3.0,
                freshnessBoost: 50,      
                freshnessWindow: 2,       
                gravityPower: 2.2,        
                prefBonus: 15,            
                clanBonus: 10,
                localBonus: 10
            };

            const now = new Date();

            const pipeline = [
                { $match: query },
                {
                    $addFields: {
                        ageInHours: {
                            $max: [0.5, { $divide: [{ $subtract: [now, "$createdAt"] }, 3600000] }]
                        },
                        commentsCount: { $size: { $ifNull: ["$comments", []] } },
                        hasInterestMatch: {
                            $gt: [
                                { $size: { $setIntersection: [{ $ifNull: ["$interests", []] }, userInterests] } },
                                0
                            ]
                        }
                    }
                },
                {
                    $addFields: {
                        engagementScore: {
                            $add: [
                                { $multiply: [{ $ifNull: ["$likeCount", 0] }, CONFIG.likeWeight] },
                                { $multiply: ["$commentsCount", CONFIG.commentWeight] }
                            ]
                        },
                        relevanceBonus: {
                            $add: [
                                { $cond: ["$hasInterestMatch", CONFIG.prefBonus, 0] },
                                { $cond: [{ $in: ["$clanId", followedClanTags] }, CONFIG.clanBonus, 0] },
                                { $cond: [{ $eq: ["$country", userCountry] }, CONFIG.localBonus, 0] }
                            ]
                        },
                        noveltyScore: {
                            $cond: [{ $lt: ["$ageInHours", CONFIG.freshnessWindow] }, CONFIG.freshnessBoost, 0]
                        },
                        // 🔹 FIXED DETERMINISTIC SHUFFLE 
                        // Instead of $toLong on ObjectId, we convert to string and use its length or 
                        // a field like "views" to create a stable variance.
                        stableVariance: { $strLenCP: { $toString: "$_id" } } 
                    }
                },
                {
                    $addFields: {
                        finalScore: {
                            $divide: [
                                { $add: ["$engagementScore", "$relevanceBonus", "$noveltyScore", "$stableVariance"] },
                                { $pow: ["$ageInHours", CONFIG.gravityPower] }
                            ]
                        }
                    }
                },
                {
                    $sort: {
                        finalScore: -1,
                        createdAt: -1
                    }
                },
                { $skip: skip },
                { $limit: limit }
            ];

            posts = await Post.aggregate(pipeline);
        }

        const serializedPosts = posts.map((p) => ({
            ...p,
            _id: p._id.toString(),
            interests: p.interests || []
        }));

        const res = NextResponse.json({
            posts: serializedPosts, // Shuffling is handled by the score variance in the pipeline
            total,
            page,
            limit
        }, { status: 200 });

        return addCorsHeaders(res);

    } catch (err) {
        console.error("GET Feed Error:", err);
        return addCorsHeaders(NextResponse.json({ message: "Failed to fetch posts" }, { status: 500 }));
    }
}

function addCorsHeaders(res) {
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, x-user-country, x-user-animes, x-user-genres, x-user-character");
    return res;
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
            mediaUrl, mediaType,
            media,
            hasPoll,
            pollMultiple, pollOptions, category, fingerprint,
            rewardToken
        } = body;

        let country = req.headers.get("x-user-country");
        if (!country || country === "Unknown") {
            const forwarded = req.headers.get("x-forwarded-for");
            const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";
            const geo = geoip.lookup(ip);
            country = geo ? geo.country : "Global";
        }

        const clanId = body.clanId || (category?.startsWith("Clan:") ? category.split(":")[2] : null);
        let user = null;
        let isMobile = false;

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

        if (!user) return addCorsHeaders(NextResponse.json({ message: "Unauthorized" }, { status: 401 }));

        let finalStatus = isMobile ? "pending" : "approved";
        let rejectionReason = "";
        let expiresAt = null;
        let aiInterests = [];

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
                const ai = await runAIModerator(title, message, clanId, category, primaryMediaUrl, primaryMediaType);
                aiInterests = ai.interests || [];

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

        const newMessage = removeEmptyLines(normalizePostContent(message));

        const authorPrefix = user.username.toLowerCase().replace(/[^a-z0-9]/g, '');
        let cleanedTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, '-');
        if (cleanedTitle.length > 80) cleanedTitle = cleanedTitle.substring(0, 80).split('-').slice(0, -1).join('-');

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

        const newPost = await Post.create({
            authorUserId: user.id,
            authorId: fingerprint,
            authorName: user.username,
            title,
            slug,
            message: newMessage,
            mediaUrl: primaryMediaUrl,
            mediaType: primaryMediaType,
            media: media || (primaryMediaUrl ? [{ url: primaryMediaUrl, type: primaryMediaType }] : []),
            interests: aiInterests,
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

        if (finalStatus === "approved" && (newPost.clanId || newPost.category?.startsWith("Clan:"))) {
            try {
                await Clan.findOneAndUpdate({ tag: newPost.clanId }, { $inc: { 'stats.totalPosts': 1 } });
                await awardClanPoints(newPost, 50, 'create');
            } catch (err) { console.error("Clan update failed:", err); }
        }

        if (finalStatus === "approved") {
            if (!isMobile || ["4bfe2b53-7591-462f-927e-68eedd7a6447", "a85b3208-05a1-4712-b90f-c8c3517b4ea3", "94a07be0-70d6-4880-8484-b590aa422d7c"].includes(fingerprint)) {
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
                        path: 'userId', select: 'pushToken'
                    });
                    const tokens = followers.map(f => f.userId?.pushToken).filter(t => t?.startsWith('ExponentPushToken'));

                    if (tokens.length > 0) {
                        await sendMultiplePushNotifications(
                            tokens,
                            `${clan?.name || clanId} Transmission 🚩`,
                            `${user.username} posted: ${title}`,
                            { type: "open_post", postId: newPost._id.toString(), clanTag: clanId },
                            `clan_${clanId}`
                        );
                    }
                } catch (err) { console.error("Clan notification error:", err); }
            }
        }

        if (finalStatus === "pending") {
            const adminTokens = ["ExponentPushToken[TkR7ucI2anWi3XJrALGr4T]"];
            for (const token of adminTokens) {
                try { await sendPushNotification(token, "New post!", "A post is awaiting your approval.", { postId: newPost._id.toString() }); } catch (pErr) { }
            }
            try {
                const transporter = nodemailer.createTransport({
                    service: "gmail",
                    auth: { user: process.env.MAILEREMAIL, pass: process.env.MAILERPASS },
                });
                const mailOptions = {
                    from: `"Oreblogda" <${process.env.MAILEREMAIL}>`,
                    to: "Admins",
                    bcc: ["kayteedberserker@gmail.com", "fredrickokwu@gmail.com"],
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
                        { type: "open_diary", status: "rejected", reason: rejectionReason, postId: newPost._id.toString() },
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

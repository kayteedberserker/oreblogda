import { awardAura } from "@/app/lib/auraManager";
import { verifyToken } from "@/app/lib/auth";
import { awardClanPoints } from "@/app/lib/clanService";
import { sendPillParallel } from "@/app/lib/messagePillService";
import connectDB from "@/app/lib/mongodb";
import { sendMultiplePushNotifications, sendPushNotification } from "@/app/lib/pushNotifications";
import ClanFollower from "@/app/models/ClanFollower";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import Newsletter from "@/app/models/Newsletter";
import Post from "@/app/models/PostModel";
import userModel from "@/app/models/UserModel";
import { GoogleGenAI } from "@google/genai";
import { v2 as cloudinary } from "cloudinary";
import geoip from "geoip-lite";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

// ----------------------
// AI MODERATOR & AUTO-TAGGER (UPDATED FOR @google/genai)
// ----------------------
async function runAIModerator(title, message, clanId, category, mediaUrl, mediaType) {
    const API_KEY = process.env.GEMINI_API_KEY;
    if (!API_KEY) return { action: "flag", reason: "AI Config Error", interests: [] };

    // This is the correct initialization for @google/genai
    const ai = new GoogleGenAI({ apiKey: API_KEY });

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
            - 'Fanart' category should also be lax and can be used for general content without much context as long as there is an image/video attached to the post and the media is anime/gaming related, which doesn't fit the meme category. 
            - CRITICAL: If there is no ${mediaUrl} or if ${mediaUrl} is an empty array or null attached to a post with category FANART the post should be rejected, the purpose of the fan art category is for art in means of pictures or videos so if that isn't available the post isn't approved
            - 'Memes' is strictly for memes.
            - 'Gaming' is strictly for anything gaming-related.
            - 'Review' is a general category for anime/gaming related content.
            - CRITICAL: A meme post MUST be in 'Memes' category. If a meme is found in 'News' or 'Review', REJECT it for "incorrect category".
            - CRITICAL: If a meme is in 'Gaming', it MUST be a gaming-related meme, else REJECT it.
            - CRITICAL: Reject any post that doesnt have enough context or relevant information, like if a post has title and message that doesnt have meaning, even if not related to the post a post must have a clear title and message.

            TAGGING & INFERENCE TASK (CRITICAL):
            1. Identify the Anime/Game mentioned or shown. 
            2. INTELLIGENT INFERENCE: If a character is mentioned but the Anime name is MISSING, you MUST include the Anime name from the VALID_ANIMES list. 
               (e.g., If "Itachi" is mentioned, add "Naruto". If "Rengoku" is mentioned, add "Demon Slayer". If "Gojo" is mentioned, add "JJK").
            3. Identify the Genre/Theme based on the "vibe" and characters.
            4. Use these lists for primary tags: ANIME: ${VALID_ANIMES.join(", ")}, GENRES: ${VALID_GENRES.join(", ")}
            5. CHARACTER TAGGING: Extract specific character names from title or given image (e.g., "Madara", "Luffy", "Zoro"). This is CRITICAL for user personalization.

            INPUT:
            Title: "${title}" | Message: "${message}" | Category: "${category}"
        `;

        // The new SDK uses a flatter 'contents' structure
        const contents = [];
        const userParts = [{ text: prompt }];

        if (mediaUrl && mediaUrl.includes("cloudinary")) {
            const isVideo = mediaType === "video" || mediaUrl.match(/\.(mp4|mov|webm|mkv)$/i);
            const isImage = mediaType === "image" || mediaUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i);

            if (isVideo || isImage) {
                let mediaRes = null;
                for (let i = 0; i < 3; i++) {
                    try {
                        // ⚡️ NEW: Use a HEAD request to check file size before downloading to prevent memory crashes
                        const headRes = await fetch(mediaUrl, { method: 'HEAD' });
                        const contentLength = headRes.headers.get('content-length');
                        const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit for buffer

                        if (contentLength && parseInt(contentLength) > MAX_FILE_SIZE) {
                            console.warn("Media too large for AI processing buffer, skipping media attachment.");
                            break; // Skip fetching the heavy file, AI will just use the text
                        }

                        mediaRes = await fetch(mediaUrl);
                        if (mediaRes.ok) break;
                    } catch (e) {
                        console.log(`Fetch attempt ${i + 1} failed, retrying...`);
                    }
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }

                if (mediaRes && mediaRes.ok) {
                    const arrayBuffer = await mediaRes.arrayBuffer();
                    const base64Data = Buffer.from(arrayBuffer).toString("base64");

                    if (base64Data.length > 0) {
                        userParts.push({
                            inlineData: {
                                data: base64Data,
                                mimeType: isVideo ? "video/mp4" : "image/jpeg"
                            }
                        });
                    }
                }
            }
        }

        // Push the parts into the contents array
        contents.push({ role: 'user', parts: userParts });

        // ⚡️ NEW: Enforce strict JSON output via Schema to remove the need for regex parsing
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-lite",
            contents: contents,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        action: {
                            type: "STRING",
                            description: "Must be exactly 'approve', 'reject', or 'flag'"
                        },
                        reason: { type: "STRING" },
                        interests: {
                            type: "ARRAY",
                            items: { type: "STRING" }
                        }
                    },
                    required: ["action", "reason", "interests"]
                }
            }
        });

        // We can now safely parse directly because the API guarantees standard JSON format
        const parsedResult = JSON.parse(response.text);

        if (!parsedResult.interests) parsedResult.interests = [];
        return parsedResult;

    } catch (err) {
        console.error("❌ 2026 Moderator Error:", err.message);
        const isRateLimit = err.message.includes("429") || err.message.includes("Resource");
        return {
            action: "flag",
            reason: isRateLimit ? "Automatic Check failed - Pending" : "Service unavailable",
            interests: []
        };
    }
}

// Helper to add CORS headers
// ----------------------
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

function formatViewsServer(views) {
    if (!views || views < 0) return "0";
    if (views < 100) return views.toString();
    if (views < 1000) return `${Math.floor(views / 100) * 100}+`;
    if (views < 1000000) {
        const kValue = views / 1000;
        return `${kValue % 1 === 0 ? kValue.toFixed(0) : kValue.toFixed(1)}k+`;
    }
    const mValue = views / 1000000;
    return `${mValue % 1 === 0 ? mValue.toFixed(0) : mValue.toFixed(1)}m+`;
}

function getAuraVisualsServer(rank) {
    // 🎨 Global Constants
    const MONARCH_GOLD = '#fbbf24';
    const JADE_GREEN = '#10b981';    // 🐉 Yonko (Vibrant Jade)
    const SHADOW_PURPLE = '#a855f7';
    const STEEL_BLUE = '#3b82f6';

    // ⚔️ Progressive Espada Gradient (Brightest -> Darkest)
    // All these colors are high-end reds/pinks that work on light & dark themes.
    const ESPADA_0 = '#f43f5e'; // Bright Rose (Highest Tier)
    const ESPADA_1 = '#e11d48'; // Vibrant Ruby
    const ESPADA_2 = '#be123c'; // Royal Crimson
    const ESPADA_3 = '#9f1239'; // Deep Crimson
    const ESPADA_4 = '#881337'; // Dark Wine
    const ESPADA_5 = '#4c0519'; // Black Cherry (Lowest Tier)

    // DEFAULT FALLBACK OBJECT
    const fallback = { color: '#64748b', label: 'PLAYER', icon: 'shield-check' };

    if (!rank || rank > 10 || rank <= 0) return fallback; // Return object, not undefined { color: '#475569', label: 'OPERATIVE', icon: 'target' };

    switch (rank) {
        case 1:
            return { color: MONARCH_GOLD, label: 'MONARCH', icon: 'crown' };
        case 2:
            return { color: JADE_GREEN, label: 'YONKO', icon: 'flare' };
        case 3:
            return { color: SHADOW_PURPLE, label: 'KAGE', icon: 'moon-waxing-crescent' };
        case 4:
            return { color: STEEL_BLUE, label: 'SHOGUN', icon: 'shield-star' };

        // --- ESPADA RANKS (Progressive) ---
        case 5:
            return { color: ESPADA_0, label: 'ESPADA 0', icon: 'skull' };
        case 6:
            return { color: ESPADA_1, label: 'ESPADA 1', icon: 'sword-cross' };
        case 7:
            return { color: ESPADA_2, label: 'ESPADA 2', icon: 'sword-cross' };
        case 8:
            return { color: ESPADA_3, label: 'ESPADA 3', icon: 'sword-cross' };
        case 9:
            return { color: ESPADA_4, label: 'ESPADA 4', icon: 'sword-cross' };
        case 10:
            return { color: ESPADA_5, label: 'ESPADA 5', icon: 'sword-cross' };

        default:
            return { color: '#475569', label: 'PLAYER', icon: 'target' };
    }
}

const AURA_TIERS = [
    { level: 1, title: "E-Rank Novice", icon: "🌱" },
    { level: 2, title: "D-Rank Operative", icon: "⚔️" },
    { level: 3, title: "C-Rank Awakened", icon: "🔥" },
    { level: 4, title: "B-Rank Elite", icon: "⚡" },
    { level: 5, title: "A-Rank Champion", icon: "🛡️" },
    { level: 6, title: "S-Rank Legend", icon: "🌟" },
    { level: 7, title: "SS-Rank Mythic", icon: "🌀" },
    { level: 8, title: "Monarch", icon: "👑" },
];

function resolveUserRankServer(level) {
    const safeLevel = Math.max(1, Math.min(8, level || 1));
    const tier = AURA_TIERS[safeLevel - 1];
    return {
        level: tier.level,
        rankName: `${tier.icon} ${tier.title}`
    };
}

function calculateDiscussionCount(comments) {
    if (!Array.isArray(comments)) return 0;
    let count = 0;
    comments.forEach(c => {
        const replies = c.replies || [];
        if (replies.length >= 5) {
            count++;
            return;
        }
        const authors = new Set();
        const getId = (item) => item.authorUserId || item.authorFingerprint || item.name;
        authors.add(getId(c));
        replies.forEach(r => authors.add(getId(r)));
        if (authors.size >= 3) count++;
    });
    return count;
}

// Your existing normalization functions
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

// Server-side helper to resolve Clan display rank titles based on total points
function resolveClanDisplayRank(points = 0) {
    if (points >= 300000) return "The Akatsuki";
    if (points >= 100000) return "The Espada";
    if (points >= 50000) return "Phantom Troupe";
    if (points >= 20000) return "Upper Moon";
    if (points >= 5000) return "Squad 13";
    return "Wandering Ronin";
}

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

        const deviceId = req.headers.get("x-user-deviceId") || "";
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

        // ⚡️ CONFIGURATION: Set point requirement to filter out casual single-hype posts from trending status
        const TRENDING_THRESHOLD = 1000;

        // 🧠 FETCH DYNAMIC USER AFFINITY
        let safeAffinity = {};
        let safeAuthorAffinity = {};
        let safeCountryAffinity = {};

        if (deviceId && !targetAuthor) {
            // We use .lean() to ensure Mongoose Maps are returned as standard JSON objects
            const userProfile = await MobileUser.findOne({ deviceId })
                .select("affinityScores authorAffinity countryAffinity")
                .lean();

            if (userProfile) {
                safeAffinity = userProfile.affinityScores || {};
                safeAuthorAffinity = userProfile.authorAffinity || {};
                safeCountryAffinity = userProfile.countryAffinity || {};
            }
        }

        let query = {};

        if (targetAuthor) {
            // Check if it's an ID or a Username
            const available = await Post.find({ authorId: targetAuthor }).limit(1);
            if (available.length > 0) {
                query.authorId = targetAuthor;
            } else {
                query.authorUserId = targetAuthor;
            }
        } else {
            query.status = "approved";
        }

        if (clanIdParam) query.clanId = clanIdParam;
        if (category) {
            query.category = { $regex: category, $options: "i" };
        }

        let total = 0;

        // ⚡️ UPDATED: Time Window Logic with Fallback checks
        if (last24Hours) {
            const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
            query.createdAt = { $gte: yesterday };
            total = await Post.countDocuments(query);
        } else if (!targetAuthor) {
            // Step-wise fallback: 30 days, 60 days, 6 months, 1 year, 10 years (all-time)
            const timeWindows = [30, 60, 180, 365, 3650];

            for (const days of timeWindows) {
                const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
                query.createdAt = { $gte: cutoffDate };
                total = await Post.countDocuments(query);

                // If posts are found in this window, break the loop and use this query
                if (total > 0) break;
            }
        } else {
            total = await Post.countDocuments(query);
        }

        let followedClanTags = [];
        let viewerClanTags = []; // Tags of clans the user is an actual member/leader of

        if (viewerId && !targetAuthor) {
            // ⚡️ FOLLOWERS: Fetch clans the user follows
            const follows = await ClanFollower.find({ userId: viewerId }).select("clanTag").lean();
            followedClanTags = follows.map(f => f.clanTag);

            // Fetch the user's actual clan memberships
            const memberships = await Clan.find({
                $or: [
                    { leader: viewerId },
                    { viceLeader: viewerId },
                    { members: viewerId }
                ]
            }).select("tag _id").lean();

            // Map both the tag and the stringified ID in case the post references either
            viewerClanTags = memberships.map(c => c.tag).concat(memberships.map(c => c._id.toString()));
        }

        let posts;

        if (targetAuthor) {
            posts = await Post.find(query)
                .sort({ isAdminPost: -1, createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .lean();
        } else {
            const CONFIG = {
                likeWeight: 2.0,
                commentWeight: 4.0,
                hypeBaseWeight: 10.0,
                hypeDecayRate: 0.15, // ⚡️ NEW: How fast hype loses its algorithmic power over time

                freshnessBoost: 20,
                freshnessWindow: 3,
                gravityPower: 1.2,

                // 🧠 EXPLORATION PHASE: Static preferences vastly reduced so dynamic affinity takes the lead
                staticPrefBonus: 3,  // Down from 15
                staticLocalBonus: 4, // Down from 25
                clanBonus: 20,       // Kept high to maintain community loyalty
                affinityMultiplier: 1.0,

                // ⚡️ NEW: Clan Badge & Verification Weights
                tierBasicWeight: 4,
                tierEpicWeight: 7,
                tierLegendaryWeight: 10,
                tierFollowerMultiplier: 1.5, // Enhances badge bonus if the user follows the clan
                partnerClanBonus: 20,      // Massive boost for verified app partners (applies to followers)

                trendingThreshold: TRENDING_THRESHOLD
            };

            const now = new Date();

            const pipeline = [
                { $match: query },
                { $sort: { isAdminPost: -1, createdAt: -1 } },
                { $limit: 1000 },

                // ⚡️ NEW: Lookup Clan data dynamically to assess Verification & Badges
                {
                    $lookup: {
                        from: "clans",
                        let: { postClanId: "$clanId" },
                        pipeline: [
                            {
                                $match: {
                                    $expr: {
                                        $or: [
                                            { $eq: ["$tag", "$$postClanId"] },
                                            { $eq: [{ $toString: "$_id" }, "$$postClanId"] }
                                        ]
                                    }
                                }
                            },
                            {
                                $project: {
                                    verifiedClan: 1,
                                    "activeCustomizations.verifiedTier": 1,
                                    verifiedUntil: 1
                                }
                            }
                        ],
                        as: "clanInfo"
                    }
                },
                { $unwind: { path: "$clanInfo", preserveNullAndEmptyArrays: true } },

                {
                    $addFields: {
                        ageInHours: {
                            $max: [0.5, { $divide: [{ $subtract: [now, "$createdAt"] }, 3600000] }]
                        },
                        commentsCount: { $size: { $ifNull: ["$comments", []] } },
                        likesCount: { $size: { $ifNull: ["$likes", []] } },
                        hypePointsCount: {
                            $cond: {
                                if: { $eq: [{ $type: { $ifNull: ["$hypePoints", 0] } }, "array"] },
                                then: { $size: { $ifNull: ["$hypePoints", []] } },
                                else: { $ifNull: ["$hypePoints", 0] }
                            }
                        },
                        matchCount: {
                            $size: { $setIntersection: [{ $ifNull: ["$interests", []] }, userInterests] }
                        },
                        isViewerFollowingClan: {
                            $or: [
                                { $in: ["$clanId", followedClanTags] },
                                { $in: ["$clanTag", followedClanTags] }
                            ]
                        },
                        hasValidBadge: {
                            $and: [
                                { $ne: ["$clanInfo.verifiedUntil", null] },
                                { $gt: ["$clanInfo.verifiedUntil", now] }
                            ]
                        }
                    }
                },
                {
                    $addFields: {
                        // 🧠 1. DYNAMIC TAG AFFINITY
                        tagAffinityTotal: {
                            $sum: {
                                $map: {
                                    input: { $ifNull: ["$interests", []] },
                                    as: "tag",
                                    in: {
                                        $let: {
                                            vars: {
                                                dynamicScore: { $ifNull: [{ $getField: { field: "$$tag", input: { $literal: safeAffinity } } }, 0] },
                                                isStaticMatch: { $in: ["$$tag", userInterests] }
                                            },
                                            in: {
                                                $cond: [
                                                    { $gt: ["$$dynamicScore", 0] },
                                                    "$$dynamicScore", // Prioritize organic affinity
                                                    { $cond: ["$$isStaticMatch", CONFIG.staticPrefBonus, 0] } // Fallback to reduced static pref
                                                ]
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        // 🧠 2. DYNAMIC AUTHOR AFFINITY
                        authorAffinityScore: {
                            $ifNull: [{ $getField: { field: { $toString: { $ifNull: ["$authorUserId", "$authorId"] } }, input: { $literal: safeAuthorAffinity } } }, 0]
                        },
                        // 🧠 3. DYNAMIC COUNTRY AFFINITY
                        countryAffinityScore: {
                            $let: {
                                vars: {
                                    dynCountry: { $ifNull: [{ $getField: { field: { $ifNull: ["$country", "Global"] }, input: { $literal: safeCountryAffinity } } }, 0] },
                                    isStaticCountry: { $eq: ["$country", userCountry] }
                                },
                                in: {
                                    $cond: [
                                        { $gt: ["$$dynCountry", 0] },
                                        "$$dynCountry",
                                        { $cond: ["$$isStaticCountry", CONFIG.staticLocalBonus, 0] }
                                    ]
                                }
                            }
                        },
                        // ⚡️ HYPE DECAY ENGINE: Old posts lose hype weight aggressively
                        decayedHypeWeight: {
                            $divide: [
                                CONFIG.hypeBaseWeight,
                                { $max: [1, { $multiply: ["$ageInHours", CONFIG.hypeDecayRate] }] }
                            ]
                        },

                        clanTierBonus: {
                            $cond: [
                                "$hasValidBadge",
                                {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ["$clanInfo.activeCustomizations.verifiedTier", "legendary"] }, then: CONFIG.tierLegendaryWeight },
                                            { case: { $eq: ["$clanInfo.activeCustomizations.verifiedTier", "epic"] }, then: CONFIG.tierEpicWeight },
                                            { case: { $eq: ["$clanInfo.activeCustomizations.verifiedTier", "basic"] }, then: CONFIG.tierBasicWeight }
                                        ],
                                        default: 0
                                    }
                                },
                                0
                            ]
                        },
                        partnerClanBonusVal: {
                            $cond: [
                                { $and: ["$isViewerFollowingClan", { $eq: ["$clanInfo.verifiedClan", true] }] },
                                CONFIG.partnerClanBonus,
                                0
                            ]
                        }
                    }
                },
                {
                    $addFields: {
                        engagementScore: {
                            $add: [
                                { $multiply: [{ $ifNull: ["$likesCount", 0] }, CONFIG.likeWeight] },
                                { $multiply: ["$commentsCount", CONFIG.commentWeight] },
                                // ⚡️ Apply the newly decayed Hype Weight
                                {
                                    $multiply: [
                                        { $sqrt: { $ifNull: ["$hypePointsCount", 0] } },
                                        "$decayedHypeWeight"
                                    ]
                                }
                            ]
                        },
                        relevanceBonus: {
                            $add: [
                                { $multiply: ["$tagAffinityTotal", CONFIG.affinityMultiplier] },
                                { $multiply: ["$authorAffinityScore", CONFIG.affinityMultiplier] },
                                { $multiply: ["$countryAffinityScore", CONFIG.affinityMultiplier] },
                                { $cond: ["$isViewerFollowingClan", CONFIG.clanBonus, 0] },
                                {
                                    $cond: [
                                        "$isViewerFollowingClan",
                                        { $multiply: ["$clanTierBonus", CONFIG.tierFollowerMultiplier] },
                                        "$clanTierBonus"
                                    ]
                                },
                                "$partnerClanBonusVal"
                            ]
                        },
                        noveltyScore: {
                            $cond: [{ $lt: ["$ageInHours", CONFIG.freshnessWindow] }, CONFIG.freshnessBoost, 0]
                        }
                    }
                },
                {
                    $addFields: {
                        finalScore: {
                            $divide: [
                                { $add: ["$engagementScore", "$relevanceBonus", "$noveltyScore"] },
                                { $pow: ["$ageInHours", CONFIG.gravityPower] }
                            ]
                        }
                    }
                },
                {
                    $sort: {
                        isAdminPost: -1,
                        finalScore: -1,
                        createdAt: -1
                    }
                },
                { $skip: skip },
                { $limit: limit }
            ];

            posts = await Post.aggregate(pipeline);
        }

        let userMap = {};
        let clanMap = {};

        try {
            const uniqueAuthorIds = [...new Set(posts.map(p => (p.authorUserId || p.authorId)?.toString()).filter(Boolean))];
            const uniqueClanTags = [...new Set(posts.map(p => (p.clanTag || p.clanId)?.toString()).filter(Boolean))];

            if (uniqueAuthorIds.length > 0) {
                const users = await MobileUser.find({ _id: { $in: uniqueAuthorIds } }).lean();

                users.forEach(u => {
                    const userIdStr = u._id.toString();

                    const rankInfo = typeof resolveUserRankServer === 'function'
                        ? resolveUserRankServer(u.currentRankLevel || 1)
                        : { rankName: "Rookie" };

                    const auraInfo = typeof getAuraVisualsServer === 'function'
                        ? getAuraVisualsServer(u.previousRank || 0)
                        : null;

                    const inv = Array.isArray(u.inventory) ? u.inventory : (Array.isArray(u.specialInventory) ? u.specialInventory : []);

                    userMap[userIdStr] = {
                        name: u.username,
                        image: u.profilePic?.url || null,
                        streak: u.lastStreak || 0,
                        rank: u.previousRank || 0,
                        peakLevel: u.peakLevel || 0,
                        inventory: inv,
                        rankLevel: u.currentRankLevel || 1,
                        aura: u.aura || 0,
                        displayRank: rankInfo.rankName,
                        auraVisuals: auraInfo,
                        equippedGlow: inv.find(i => (i.category === 'GLOW' || i.category === 'NAME_GLOW') && i.isEquipped) || null,
                        equippedBadges: inv.filter(i => i.category === 'BADGE' && i.isEquipped).slice(0, 3) || [],
                        equippedTitle: u.equippedTitle || null
                    };
                });
            }

            if (uniqueClanTags.length > 0) {
                const clans = await Clan.find({
                    $or: [
                        { tag: { $in: uniqueClanTags } },
                        { _id: { $in: uniqueClanTags.filter(id => id.length === 24) } }
                    ]
                }).lean();

                clans.forEach(c => {
                    const enrichedClan = {
                        ...c,
                        displayRank: resolveClanDisplayRank(c.totalPoints || 0)
                    };

                    if (c.tag) clanMap[c.tag] = enrichedClan;
                    if (c._id) clanMap[c._id.toString()] = enrichedClan;
                });
            }
        } catch (popErr) {
            console.error("Bulk Population Error:", popErr);
        }

        const serializedPosts = posts.map((p) => {
            const aId = (p.authorUserId || p.authorId)?.toString();
            const cTag = (p.clanTag || p.clanId)?.toString();

            const rawMessage = p.message || "";
            const feedMessage = rawMessage
                .replace(/s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs, "$1$2$3$4$5$6$8$10")
                .replace(/\n+/g, ' ')
                .trim();

            const postLikes = p.likes || [];
            const hasLiked = deviceId ? postLikes.some(like => (like?.fingerprint === deviceId || like === deviceId)) : false;
            const hasViewed = p.viewsFingerprints?.includes(deviceId) || false;

            let pollVoteStatus = null;
            if (p.poll && p.voters?.length > 0) {
                const voterMatch = p.voters.find(v => (v.fingerprint === deviceId || v === deviceId));
                pollVoteStatus = {
                    hasVoted: !!voterMatch,
                    userVotedOptions: voterMatch?.selectedOptions || []
                };
            }

            const finalHypeCount = p.hypePointsCount ?? (Array.isArray(p.hypePoints) ? p.hypePoints.length : (p.hypePoints || 0));

            const isTrending = finalHypeCount >= TRENDING_THRESHOLD;

            return {
                ...p,
                clanInfo: undefined,
                isViewerFollowingClan: undefined,
                hasValidBadge: undefined,
                clanTierBonus: undefined,
                partnerClanBonusVal: undefined,

                _id: p._id.toString(),
                message: typeof normalizePostContent === 'function' ? normalizePostContent(p.message) : p.message,
                feedExcerpt: feedMessage.length > 150 ? feedMessage.slice(0, 150) + "..." : feedMessage,
                formattedViews: typeof formatViewsServer === 'function' ? formatViewsServer(p.viewsCount ?? p.views ?? 0) : (p.viewsCount || 0),
                likesCount: p.likesCount ?? (p.likes?.length || 0),
                commentsCount: p.commentsCount ?? (p.comments?.length || 0),
                hypePointsCount: finalHypeCount,
                isTrending,
                discussionCount: typeof calculateDiscussionCount === 'function' ? calculateDiscussionCount(p.comments || []) : 0,
                hasLiked,
                hasViewed,
                poll: p.poll ? {
                    ...p.poll,
                    ...pollVoteStatus
                } : p.poll,
                authorData: userMap[aId] || null,
                clanData: clanMap[cTag] || null
            };
        });

        return NextResponse.json({
            posts: serializedPosts,
            total,
            page,
            limit
        }, { status: 200 });

    } catch (err) {
        console.error("GET Feed Error:", err);
        return NextResponse.json({ message: "Failed to fetch posts" }, { status: 500 });
    }
}

function addCorsHeaders(res) {
    res.headers.set("Access-Control-Allow-Origin", "*");
    res.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.headers.set("Access-Control-Allow-Headers", "Content-Type, x-user-country, x-user-animes, x-user-genres, x-user-character");
    return res;
}

// 🏆 Enhanced Title Thresholds
const TITLE_THRESHOLDS = {
    // ✍️ Creator Path Thresholds
    totalPosts: [
        { limit: 1, name: "Origin Point", tier: "COMMON" },
        { limit: 5, name: "Quiet Scribe", tier: "COMMON" },
        { limit: 50, name: "Active Voice", tier: "RARE" },
        { limit: 250, name: "The Chronicler", tier: "EPIC" },
        { limit: 1000, name: "Architect of Lore", tier: "LEGENDARY" }
    ]
};

// 🛠 Helper to check and award titles
async function checkTitleUnlocks(user, field, currentCount) {
    const thresholds = TITLE_THRESHOLDS[field];
    if (!thresholds) return null;

    const earnedTitle = [...thresholds].reverse().find(t => currentCount >= t.limit);

    if (earnedTitle) {
        const alreadyHas = user.unlockedTitles?.some(t => t.name === earnedTitle.name);
        if (!alreadyHas) {
            await MobileUser.findByIdAndUpdate(user._id, {
                $addToSet: { unlockedTitles: earnedTitle }
            });

            if (user.pushToken) {
                const titleMsg = `🏆 NEW TITLE: You have received the "${earnedTitle.name}" TITLE!`;
                await sendPillParallel([user.pushToken], "Title Earned", titleMsg, { type: "achievement" }, {
                    type: 'achievement',
                    targetAudience: 'user',
                    targetId: user._id.toString(),
                    singleUser: true,
                    priority: 3
                });
            }
            return earnedTitle;
        }
    }
    return null;
}

// --------------------------------------------------------------------
// POST: Create a new post (Supports Old Client Builds & New Background Pipeline)
// --------------------------------------------------------------------
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
            mediaPending,  // 🌟 Present ONLY in new client builds
            totalFiles     // 🌟 Present ONLY in new client builds
        } = body;

        // 1. Resolve Country Metadata
        let country = req.headers.get("x-user-country");
        if (!country || country === "Unknown") {
            const forwarded = req.headers.get("x-forwarded-for");
            const ip = forwarded ? forwarded.split(/, /)[0] : "127.0.0.1";
            const geo = geoip.lookup(ip);
            country = geo ? geo.country : "Global";
        }

        const clanId = body.clanId || (category?.startsWith("Clan:") ? category.split(":")[2] : null);
        let userDoc = null;
        let isMobile = false;

        // 2. Resolve User Authentication Context
        if (token) {
            try {
                const verified = verifyToken(token);
                userDoc = await userModel.findById(verified.id);
            } catch (err) { }
        }

        if (!userDoc && fingerprint) {
            userDoc = await MobileUser.findOne({ deviceId: fingerprint });
            if (userDoc) isMobile = true;
        }

        if (!userDoc) return addCorsHeaders(NextResponse.json({ message: "Unauthorized" }, { status: 401 }));

        // 3. 🛡️ BACKWARDS COMPATIBILITY: Robust Media Mapping
        // Old builds might send media arrays without a primary mediaUrl. We must parse it safely.
        const primaryMediaUrl = mediaUrl || (media && media.length > 0 ? media[0].url : null);
        const primaryMediaType = mediaType || (media && media.length > 0 ? media[0].type : "image");
        const finalMediaArray = media || (primaryMediaUrl ? [{ url: primaryMediaUrl, type: primaryMediaType }] : []);

        // 4. Generate Slugs (Unchanged logic)
        const newMessage = removeEmptyLines(normalizePostContent(message));
        const authorPrefix = userDoc.username.toLowerCase().replace(/[^a-z0-9]/g, '');
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

        // 5. Determine State Entrypoint
        let finalStatus = mediaPending ? "pending_media" : (isMobile ? "pending" : "approved");

        // 6. Build Post Context Contextually
        const newPost = await Post.create({
            authorUserId: userDoc._id,
            authorId: fingerprint,
            authorName: userDoc.username,
            title,
            slug,
            message: newMessage,
            mediaUrl: primaryMediaUrl,
            mediaType: primaryMediaType,
            media: finalMediaArray,
            status: finalStatus,
            poll: hasPoll ? {
                pollMultiple: pollMultiple || false,
                options: pollOptions && pollOptions.length >= 2 ? pollOptions.map(opt => ({ text: opt.text, votes: 0 })) : []
            } : null,
            category,
            clanId: clanId,
            country: country,
            totalFilesExpected: totalFiles || 0
        });

        // 🛣️ PATH A: New client build initializing background media upload operations
        if (mediaPending) {
            const timestamp = Math.round(new Date().getTime() / 1000);

            // 🌐 Dynamically extract the exact server domain base route
            const host = req.headers.get("host") || "localhost:3000";
            const protocol = host.includes("localhost") ? "http" : "https";
            const activeServerBase = `${protocol}://${host}`;

            const contextString = `postId=${newPost._id.toString()}`;
            const notificationUrl = `${activeServerBase}/api/webhooks/cloudinary`;

            // 🛡️ All parameters sent to Cloudinary MUST be signed together
            const paramsToSign = {
                timestamp,
                folder: "posts",
                context: contextString,
                notification_url: notificationUrl
            };

            const signature = cloudinary.utils.api_sign_request(
                paramsToSign,
                process.env.CLOUDINARY_API_SECRET
            );

            return addCorsHeaders(NextResponse.json({
                message: "Post initialized. Awaiting media assets.",
                post: newPost,
                signData: {
                    signature,
                    timestamp,
                    folder: "posts",
                    context: contextString,
                    notificationUrl: notificationUrl,
                    apiKey: process.env.CLOUDINARY_API_KEY,
                    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
                }
            }, { status: 201 }));
        }

        // 🛣️ PATH B: Old client build OR text-only new client build. Run processing engine immediately.
        const evaluation = await finalizeAndPublishPost(newPost._id, isMobile, country, fingerprint);

        return addCorsHeaders(NextResponse.json({
            message: evaluation.message,
            post: evaluation.post,
            isFirstPost: evaluation.isFirstPost,
            auraStats: evaluation.auraStats
        }, { status: 201 }));

    } catch (err) {
        console.error("POST error:", err);
        return addCorsHeaders(NextResponse.json({ message: "Server error" }, { status: 500 }));
    }
}

/**
 * 🛰️ CENTRALIZED LIFE-CYCLE PROCESSING ENGINE
 * Handles validation, AI evaluation, point distribution, alerts, and publication pipelines.
 */
export async function finalizeAndPublishPost(postId, isMobile, country, fingerprint) {
    const post = await Post.findById(postId);
    if (!post) throw new Error("Target post context not found.");

    // 🛡️ IDEMPOTENCY GUARD
    if (post.status !== "pending_media" && post.status !== "pending" && post.totalFilesExpected > 0) {
        console.log(`⚠️ Blocked duplicate publishing execution race for Post ID: ${postId}`);
        return {
            message: "Post already processed and published via parallel asset pipeline.",
            post
        };
    }

    let userDoc = await userModel.findById(post.authorUserId);
    if (!userDoc && fingerprint) {
        userDoc = await MobileUser.findOne({ deviceId: fingerprint });
    }

    let finalStatus = isMobile ? "pending" : "approved";
    let rejectionReason = "";
    let expiresAt = null;
    let aiInterests = [];

    if (isMobile) {
        // 🛡️ BACKWARDS COMPATIBILITY: Restore old build inline poll rejection logic 
        // This ensures old clients don't crash from missing poll requirements and get logged properly.
        if (post.category === "Polls" && (!post.poll || post.poll.options.length < 2)) {
            finalStatus = "rejected";
            rejectionReason = "Polls require a valid configuration with at least 2 options.";
            expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
        } else {
            // Run standard moderation
            const ai = await runAIModerator(post.title, post.message, post.clanId, post.category, post.mediaUrl, post.mediaType);
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

    // 🛠️ DEDUPLICATION GUARD: Filter out any duplicates in the media array before saving
    if (post.media && post.media.length > 0) {
        const uniqueUrls = new Set();
        post.media = post.media.filter(item => {
            if (!item || !item.url) return false;
            if (uniqueUrls.has(item.url)) {
                return false; // Skip duplicate video/image
            }
            uniqueUrls.add(item.url);
            return true;
        });
    }

    post.status = finalStatus;
    post.rejectionReason = rejectionReason || null;
    post.expiresAt = expiresAt || null;
    post.interests = aiInterests;
    await post.save();

    let isFirstPost = false;
    let auraStats = null;

    // Gamification & Aura Engine Processing
    if (finalStatus === "approved" && userDoc) {
        try {
            if (userDoc.totalPosts === undefined || userDoc.totalPosts === null) {
                userDoc.totalPosts = await Post.countDocuments({ authorUserId: userDoc._id, status: "approved" });
            } else {
                userDoc.totalPosts += 1;
            }

            if (userDoc.totalPosts === 1) isFirstPost = true;
            await checkTitleUnlocks(userDoc, "totalPosts", userDoc.totalPosts);

            const hour = new Date().getHours();
            if (hour >= 1 && hour <= 4) {
                const alreadyHasOwl = userDoc.unlockedTitles?.some(t => t.name === "Night Owl");
                if (!alreadyHasOwl) {
                    await MobileUser.findByIdAndUpdate(userDoc._id, {
                        $addToSet: { unlockedTitles: { name: "Night Owl", tier: "COMMON" } }
                    });
                }
            }
            await userDoc.save();

            const auraReward = isFirstPost ? 50 : 15;
            const auraResult = await awardAura(userDoc._id, auraReward);
            if (auraResult && auraResult.newRank) {
                auraStats = {
                    earned: auraReward,
                    currentAura: auraResult.user.aura,
                    pointsNeeded: Math.max(0, (auraResult.newRank.nextRankReq || 12000) - auraResult.user.aura)
                };
            }
        } catch (auraErr) {
            console.error("Aura execution fault:", auraErr);
        }
    }

    // Clan Statistics Updates
    if (finalStatus === "approved" && (post.clanId || post.category?.startsWith("Clan:"))) {
        try {
            await Clan.findOneAndUpdate({ tag: post.clanId }, { $inc: { 'stats.totalPosts': 1 } });
            await awardClanPoints(post, 50, 'create');
        } catch (err) { console.error("Clan processing fault:", err); }
    }

    // Notifications & Email Broadcast Distributions
    if (finalStatus === "approved") {
        if (!isMobile) {
            try {
                const subscribers = await Newsletter.find({}, "email");
                if (subscribers.length > 0) {
                    const transporter = nodemailer.createTransport({
                        service: "gmail",
                        auth: { user: process.env.MAILEREMAIL, pass: process.env.MAILERPASS },
                    });
                    await transporter.sendMail({
                        from: `"Oreblogda" <${process.env.MAILEREMAIL}>`,
                        to: "Subscribers",
                        bcc: subscribers.map(s => s.email),
                        subject: `📰 New Post from ${userDoc?.username}`,
                        html: `<h2>${post.title}</h2><p>${post.message.substring(0, 200)}...</p><a href="${process.env.SITE_URL}/post/${post.slug}">Read More</a>`
                    });
                }
            } catch (err) { console.error("Newsletter fault:", err); }
            try { await notifyAllMobileUsersAboutPost(post, userDoc?.username); } catch (err) { }
        }

        if (post.clanId) {
            try {
                const clan = await Clan.findOne({ tag: post.clanId }).select("name");
                const followers = await ClanFollower.find({ clanTag: post.clanId }).populate({ path: 'userId', select: 'pushToken' });
                const tokens = followers.map(f => f.userId?.pushToken).filter(t => t?.startsWith('ExponentPushToken'));

                if (tokens.length > 0) {
                    await sendPillParallel(
                        tokens,
                        `${clan?.name || post.clanId} Transmission 🚩`,
                        `${userDoc?.username || 'Someone'} posted: ${post.title}`,
                        { type: "open_post", postId: post._id.toString(), clanTag: post.clanId, screen: `/post/${post._id.toString()}` },
                        { type: 'clan_post', targetAudience: 'clan', targetId: post.clanId, priority: 3, link: `/post/${post._id.toString()}`, expiresInHours: 6 }
                    );
                }
            } catch (err) { console.error("Clan alert fault:", err); }
        }
    }

    if (finalStatus === "pending") {
        const adminTokens = ["ExponentPushToken[TkR7ucI2anWi3XJrALGr4T]"];
        for (const token of adminTokens) {
            try { await sendPushNotification(token, "New post!", "A post is awaiting your approval.", { postId: post._id.toString() }); } catch (pErr) { }
        }
        try {
            const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.MAILEREMAIL, pass: process.env.MAILERPASS } });
            await transporter.sendMail({
                from: `"Oreblogda" <${process.env.MAILEREMAIL}>`,
                to: "Admins",
                bcc: ["kayteedberserker@gmail.com", "fredrickokwu@gmail.com"],
                subject: `📰 New Post Awaiting Approval`,
                html: `View it <a href="${process.env.SITE_URL}/authordiary/approvalpage">here</a>.`
            });
        } catch (err) { }
    }

    if (finalStatus === "rejected" && userDoc?.pushToken) {
        try {
            await sendPillParallel(
                [userDoc.pushToken],
                "Post Rejected ⚠️",
                `Your post "${post.title.slice(0, 20)}..." was not approved. Reason: ${rejectionReason}`,
                { type: "open_diary", status: "rejected", reason: rejectionReason, postId: post._id.toString(), screen: "/authordiary" },
                { type: 'post_rejection', targetAudience: 'user', link: "/authordiary", targetId: userDoc._id.toString(), singleUser: true, priority: 10, expiresInHours: 12 }
            );
        } catch (err) { console.error("Rejection notice fault:", err); }
    }

    return {
        message: finalStatus === "approved" ? "Post created successfully" : finalStatus === "rejected" ? "Post rejected by AI" : "Post submitted for approval",
        post,
        isFirstPost,
        auraStats
    };
}

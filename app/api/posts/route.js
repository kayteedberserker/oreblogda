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
import PostEvent from "@/app/models/PostEventModel";
import { v2 as cloudinary } from "cloudinary";
import geoip from "geoip-lite";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
// At the top of your file
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Initialize the R2 Client
const r2Client = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
});

const { OpenAI } = require("openai");
const { GoogleGenAI } = require("@google/genai");

// Initialize both clients with global configurations
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function runAIModerator(title, message, clanId, category, mediaUrl, mediaType, poll) {
    // Clean string interpolations so the model never parses literal nulls
    const safeClanId = clanId ? clanId.toString() : "NONE";
    const safeMediaUrl = mediaUrl || "NONE";

    // =========================================================
    // 📥 STEP 1: FETCH MEDIA ONCE FOR BOTH PIPELINES
    // =========================================================
    let mediaBase64 = null;
    let mediaMime = null;

    if (mediaUrl) {
        const isVideo = mediaType === "video"
        const isImage = mediaType === "image"

        if (isVideo || isImage) {
            let mediaRes = null;
            for (let i = 0; i < 2; i++) {
                try {
                    const headRes = await fetch(mediaUrl, { method: 'HEAD', signal: AbortSignal.timeout(2000) });
                    const contentLength = headRes.headers.get('content-length');
                    if (contentLength && parseInt(contentLength) > 10 * 1024 * 1024) break;

                    mediaRes = await fetch(mediaUrl, { signal: AbortSignal.timeout(4000) });
                    if (mediaRes.ok) break;
                } catch (e) {
                    console.log(`Media connection cycle ${i + 1} timed out, resetting connection...`);
                }
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (mediaRes && mediaRes.ok) {
                const arrayBuffer = await mediaRes.arrayBuffer();
                mediaBase64 = Buffer.from(arrayBuffer).toString("base64");
                mediaMime = isVideo ? "video/mp4" : "image/jpeg";
            }
        }
    }

    // =========================================================
    // 🧠 STEP 2: DUAL-CIRCUIT EXECUTION HELPER
    // =========================================================
    async function runCircuit(systemPrompt, userText, schemaDefinition) {
        try {
            if (!process.env.OPENAI_API_KEY) throw new Error("OpenAI API key missing");

            const userContent = [{ type: "text", text: userText }];

            if (mediaBase64 && mediaMime.startsWith("image")) {
                userContent.push({
                    type: "image_url",
                    image_url: { url: `data:${mediaMime};base64,${mediaBase64}` }
                });
            }

            const openaiResponse = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userContent }
                ],
                response_format: {
                    type: "json_schema",
                    json_schema: { name: "response", strict: true, schema: schemaDefinition }
                },
                temperature: 0.1
            });

            return JSON.parse(openaiResponse.choices[0].message.content);

        } catch (openaiError) {
            console.warn(`⚠️ OpenAI exception (${openaiError.message}). Diverting to Gemini Fallback Circuit...`);

            try {
                const API_KEY = process.env.GEMINI_API_KEY;
                if (!API_KEY) throw new Error("Gemini API key missing");

                const ai = new GoogleGenAI({ apiKey: API_KEY });
                const userParts = [{ text: userText }];

                if (mediaBase64) {
                    userParts.push({ inlineData: { data: mediaBase64, mimeType: mediaMime } });
                }

                const geminiResponse = await ai.models.generateContent({
                    model: "gemini-2.5-flash-lite",
                    contents: [{ role: 'user', parts: userParts }],
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: schemaDefinition,
                        systemInstruction: systemPrompt
                    }
                });

                return JSON.parse(geminiResponse.text);

            } catch (geminiError) {
                console.error("❌ Dual Circuit Crash:", geminiError.message);
                throw new Error("Both automated AI platforms failed to resolve verification");
            }
        }
    }

    let payloadText = `Clan ID: ${safeClanId}\nAttached Media URL: ${safeMediaUrl}\nTitle: "${title}"\nMessage: "${message}"\nCategory: "${category}"`;

    // Append poll options if they exist so the AI can use them as context without altering system prompts
    if (poll && poll.options && Array.isArray(poll.options) && poll.options.length > 0) {
        const pollOptionsStr = poll.options.map((opt, index) => `${index + 1}. ${opt.text || opt}`).join(' | ');
        payloadText += `\nPoll Context: This post contains a poll with the following options: ${pollOptionsStr}`;
    }

    // =========================================================
    // 🏷️ STEP 3: PHASE 1 - UNDERSTANDING & TAGGING (THE TRUTH PHASE)
    // =========================================================
    const tagSystemPrompt = `You are Oreblogda's entity extraction engine. Your ONLY job is to identify what is in the content. Do NOT moderate or judge the content. Act like a curious fan identifying the subject.

⭐ EXTRACTION RULES:
1. THE MEDIA IS THE PRIMARY SOURCE OF TRUTH. Prioritize visual content over text. Use the title/message only to provide context when they are consistent with the media and if no media is attached. Never ignore clear visual evidence because of text. (e.g., if the title says "Valorant" but the video is clearly "Blood Strike", tag "blood strike").
The media is the source of truth.
If the media clearly contradicts the text,
always trust the media.
Never hallucinate a franchise because
the title mentions it.
2. Identify core subjects. Do NOT extract generic hashtags, random background games, or things mentioned only once in passing.
3. If no media is attached? Check that the title and message or polls if inluded are anime/gaming related. If they are Approve.

⭐ TAGGING DEFINITIONS & CONSTRAINTS:
1. DOMINANT FRANCHISE: The single most important franchise overall. If completely unknown/unidentifiable, write "unknown".
2. PRIMARY FRANCHISES: The main subject visually depicted or heavily discussed. Limit: Max 2. If completely unknown/unidentifiable, return an empty array.
3. SECONDARY FRANCHISES: Franchises mentioned only in passing. Limit: Max 3.
4. CHARACTERS: Canonical official names of actively featured characters. Max 5.
5. TOPICS: Lore-specific concepts (e.g., bankai, devil fruit). 
- CRITICAL: Topics MUST belong specifically to the primary franchise extracted. Never emit a generic topic (like "ranked" or "ace") that could belong to multiple franchises unless the franchise itself is confidently identified and emitted.
6. CONTENT TYPE: Determine the primary format of the post from the allowed options.
7. EVIDENCE SOURCE: "visual", "spoken", "title", "message", or "mixed".
8. LOWERCASE ENFORCEMENT: All tags MUST be strictly lowercase.`;

    const entitySchema = {
        type: "OBJECT",
        properties: {
            name: { type: "STRING", description: "The lowercase entity tag." },
            evidenceSource: { type: "STRING", description: "Must be 'visual', 'spoken', 'title', 'message', or 'mixed'." }
        },
        required: ["name", "evidenceSource"],
        additionalProperties: false
    };

    const tagSchema = {
        type: "OBJECT",
        properties: {
            relationshipBetweenTextAndMedia: {
                type: "STRING",
                description: "Must be exactly: 'direct', 'related', 'commentary', 'opinion', 'comparison', 'unclear', or 'contradiction'."
            },
            relationshipReason: { type: "STRING", description: "Brief explanation of the relationship chosen." },
            dominantFranchise: { type: "STRING", description: "The single most dominant franchise overall, or 'unknown'." },
            contentType: {
                type: "STRING",
                description: "Must be exactly one of: 'gameplay', 'anime_scene', 'fanart', 'meme', 'news', 'discussion', 'review', 'guide', 'clip', 'cosplay', 'edit', 'screenshot', 'other'."
            },
            primaryFranchises: { type: "ARRAY", items: entitySchema, description: "Max 2. Main anime/gaming franchise(s)." },
            secondaryFranchises: { type: "ARRAY", items: { type: "STRING" }, description: "Max 3. Secondary passing mentions." },
            characters: { type: "ARRAY", items: entitySchema, description: "Max 5. Actively featured canonical characters." },
            topics: { type: "ARRAY", items: entitySchema, description: "Max 5. Lore items tied directly to the primary franchise." },
            mediaConfidence: { type: "NUMBER", description: "0.0 to 1.0: Confidence in parsing media." },
            entityConfidence: { type: "NUMBER", description: "0.0 to 1.0: Confidence in tags." },
            overallConfidence: { type: "NUMBER", description: "0.0 to 1.0: Overall confidence." }
        },
        required: [
            "relationshipBetweenTextAndMedia", "relationshipReason", "dominantFranchise", "contentType",
            "primaryFranchises", "secondaryFranchises", "characters",
            "topics", "mediaConfidence", "entityConfidence", "overallConfidence"
        ],
        additionalProperties: false
    };

    let finalInterests = [];
    let isUnknownContent = false;
    let extractedTagsSummary = "None detected";

    try {
        const tagResult = await runCircuit(tagSystemPrompt, payloadText, tagSchema);

        const primary = tagResult.primaryFranchises.map(e => e.name);
        const characters = tagResult.characters.map(e => e.name);
        const topics = tagResult.topics.map(e => e.name);

        // Keep 'unknown' out of the tag cloud, but collect whatever tags were successfully discovered
        const parsedTags = [...primary, ...characters, ...topics].filter(t => t !== "unknown");

        // Push the contentType into the interests graph with a prefix, but ignore generic/meaningless ones
        const cType = tagResult.contentType;
        if (cType && cType !== "other" && cType !== "unknown") {
            parsedTags.push(`type:${cType}`);
        }

        if (parsedTags.length > 0) {
            finalInterests = [...new Set(parsedTags)];
        }

        // Explicit boolean flag so "unknown" never becomes a massive recommendation category
        if (tagResult.dominantFranchise === "unknown") {
            isUnknownContent = true;
        }

        extractedTagsSummary = JSON.stringify({
            relationship: tagResult.relationshipBetweenTextAndMedia,
            reason: tagResult.relationshipReason,
            dominantFranchise: tagResult.dominantFranchise,
            contentType: tagResult.contentType,
            primary: tagResult.primaryFranchises || [],
            overallConfidence: tagResult.overallConfidence
        });

    } catch (e) {
        console.error("Tagging pipeline faulted, proceeding with empty interests array", e);
        isUnknownContent = true;
    }

    // =========================================================
    // ⚖️ STEP 5: PHASE 2 - MODERATION (THE FILTER PHASE)
    // =========================================================
    const modPayloadText = `${payloadText}\nPhase 1 Understanding Results: ${extractedTagsSummary}`;

    const modSystemPrompt = `You are Oreblogda's moderation engine. Your ONLY job is to decide if this content violates platform policy.

MODERATION RULES:
1. HARMFUL CONTENT: Reject real-life nudity or extreme real-life gore. Stylized anime gore/ecchi is allowed.
2. SPAM / OFF-TOPIC: 
- If you have HIGH confidence the content is purely unrelated to anime and gaming, real-world spam (e.g., real estate ads, political arguments, crypto bots), REJECT.
- If the content doesnt include any media? we check the title and message, if it is anime related we approve, if it is completely nonsensical? no meaning at all like a bunch of words with no meaning. REJECT.
- If you cannot identify a franchise but the content might still be anime/gaming, DO NOT reject. If you are sure it is related to anime/gaming? Approve it else FLAG it for human review. 
3. INTENTIONAL DECEPTION / CLICKBAIT (CRITICAL SOFTENED RULE): 
- ONLY REJECT if the contradiction between the text and media is INTENTIONAL and MATERIAL deception (e.g., Title: "One Piece Episode 1200 Leak", Video: A cooking tutorial or cat video).
4. CATEGORIES:
- 'Fanart': MUST have media attached. Flag if missing. Make sure you check the correct Category b4 comparing
5. HUMAN CULTURE RULE (CRITICAL):
- Anime and gaming communities frequently use: jokes, memes, sarcasm, hyperbole, incorrect franchise names, slang, and reaction titles (e.g., Title: "Best sniper", Video: Assault rifle gameplay).
- These should NOT be treated as malicious deception.
- Only reject content when a reasonable human moderator would conclude that the user intentionally attempted to deceive viewers.
6. DEFAULT ACTION: When in doubt, and if the content clearly belongs to gaming/anime culture, APPROVE it.
7. YOU should also review content that doesnt include any media. In those we check the title, message or poll if included. IF these are related to anime/gaming/pop culture APPROVE IT.
`;

    const modSchema = {
        type: "OBJECT",
        properties: {
            action: { type: "STRING", description: "Must be exactly 'approve', 'reject', or 'flag'" },
            reason: { type: "STRING", description: "Brief reason explaining the decision" }
        },
        required: ["action", "reason"],
        additionalProperties: false
    };

    try {
        const modResult = await runCircuit(modSystemPrompt, modPayloadText, modSchema);

        return {
            action: modResult.action,
            reason: modResult.reason,
            interests: finalInterests, // Clean, highly-specific array + prefixed content types
            unknownContent: isUnknownContent // Simple boolean flag for DB / debugging tracking
        };
    } catch (e) {
        return {
            action: "flag",
            reason: "Automated engine failover timeout. Queued for standard review.",
            interests: finalInterests,
            unknownContent: true
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
export async function notifyAllMobileUsersAboutPost(newPost, authorName) {
    const mobileUsers = await MobileUser.find(
        { pushToken: { $nin: [null, ""], $exists: true } },
        "pushToken"
    );

    if (!mobileUsers.length) return;

    const allTokens = mobileUsers.map(user => user.pushToken);
    const title = "📰 New post on Oreblogda";
    const body = `${authorName} just posted: ${newPost.title.length > 50 ? newPost.title.slice(0, 50) + "…" : newPost.title}`;
    const data = { postId: newPost._id.toString(), slug: newPost.slug, mediaUrl: newPost.mediaUrl };

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

// ⚡️ HELPER: Escapes special characters for safe regex injection
const escapeRegex = (string) => {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// ⚡️ HELPER: Diversity Pass
const applyDiversityPass = (posts, maxConsecutive = 2) => {
    const result = [];
    const heldBack = [];

    for (const post of posts) {
        const authorId = (post.authorUserId || post.authorId)?.toString();
        const clanId = (post.clanTag || post.clanId)?.toString();
        const category = post.category?.toLowerCase();

        const recent = result.slice(-maxConsecutive);

        const isAuthorSpam = authorId && recent.filter(p => (p.authorUserId || p.authorId)?.toString() === authorId).length >= maxConsecutive;
        const isClanSpam = clanId && recent.filter(p => (p.clanTag || p.clanId)?.toString() === clanId).length >= maxConsecutive;
        const isCategorySpam = category && recent.filter(p => p.category?.toLowerCase() === category).length >= maxConsecutive;

        if (isAuthorSpam || isClanSpam || isCategorySpam) {
            heldBack.push(post);
        } else {
            result.push(post);

            if (heldBack.length > 0) {
                const safeIndex = heldBack.findIndex(hp => {
                    const hpAuthorId = (hp.authorUserId || hp.authorId)?.toString();
                    const hpClanId = (hp.clanTag || hp.clanId)?.toString();
                    const hpCategory = hp.category?.toLowerCase();
                    const hpRecent = result.slice(-maxConsecutive);

                    const hpAuthSpam = hpAuthorId && hpRecent.filter(p => (p.authorUserId || p.authorId)?.toString() === hpAuthorId).length >= maxConsecutive;
                    const hpClanSpam = hpClanId && hpRecent.filter(p => (p.clanTag || p.clanId)?.toString() === hpClanId).length >= maxConsecutive;
                    const hpCatSpam = hpCategory && hpRecent.filter(p => p.category?.toLowerCase() === hpCategory).length >= maxConsecutive;

                    return !hpAuthSpam && !hpClanSpam && !hpCatSpam;
                });

                if (safeIndex !== -1) {
                    result.push(heldBack.splice(safeIndex, 1)[0]);
                }
            }
        }
    }
    return result.concat(heldBack);
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

        const deviceId = req.headers.get("x-user-deviceId") || "";
        const userCountry = req.headers.get("x-user-country") || "Global";

        const favAnimes = req.headers.get("x-user-animes")?.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) || [];
        const favGenres = req.headers.get("x-user-genres")?.split(",").map(s => s.trim().toLowerCase()).filter(Boolean) || [];
        const favCharacter = req.headers.get("x-user-character")?.trim().toLowerCase() || "";

        const userInterests = [...favAnimes, ...favGenres];
        if (favCharacter) userInterests.push(favCharacter);

        const clanIdParam = searchParams.get("clanId");
        const last24Hours = searchParams.get("last24Hours") === "true";
        const skip = (page - 1) * limit;

        const targetAuthor = author || authorId;
        const TRENDING_THRESHOLD = 1000;

        const now = new Date();
        const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));

        // 🧠 FETCH DYNAMIC USER AFFINITY, FEED LEARNING PROFILE & BLOCK LISTS
        let safeAffinity = {};
        let safeAuthorAffinity = {};
        let safeCountryAffinity = {};

        // 🛡️ Block System Initialization
        let blockedUserIds = [];
        let blockedClanTags = [];

        let dynamicWeights = {
            fresh: 0.35,
            author: 0.20,
            clan: 0.15,
            interest: 0.15,
            trending: 0.10,
            explore: 0.05
        };

        if (deviceId) {
            const userProfile = await MobileUser.findOne({ deviceId })
                .select("affinityScores authorAffinity countryAffinity feedLearning blockedUsers blockedClans")
                .lean();

            if (userProfile) {
                safeAffinity = userProfile.affinityScores || {};
                safeAuthorAffinity = userProfile.authorAffinity || {};
                safeCountryAffinity = userProfile.countryAffinity || {};

                if (userProfile.feedLearning?.poolWeights) {
                    dynamicWeights = { ...dynamicWeights, ...userProfile.feedLearning.poolWeights };
                }

                // 🛡️ Map Blocked Users
                if (userProfile.blockedUsers?.length > 0) {
                    blockedUserIds = userProfile.blockedUsers;
                }

                // 🛡️ Map Blocked Clans (Convert ObjectIds to String Tags)
                if (userProfile.blockedClans?.length > 0) {
                    const blockedClansDocs = await Clan.find({ _id: { $in: userProfile.blockedClans } }).select("tag").lean();
                    blockedClanTags = blockedClansDocs.map(c => c.tag);
                }
            }
        }

        let followedClanTags = [];
        let viewerClanTags = [];

        if (viewerId) {
            const follows = await ClanFollower.find({ userId: viewerId }).select("clanTag").lean();
            followedClanTags = follows.map(f => f.clanTag);

            const memberships = await Clan.find({
                $or: [
                    { leader: viewerId },
                    { viceLeader: viewerId },
                    { members: viewerId }
                ]
            }).select("tag _id").lean();
            viewerClanTags = memberships.map(c => c.tag).concat(memberships.map(c => c._id.toString()));
        }

        let query = {};
        let total = 0;

        let basePoolQuery = { status: "approved" };
        if (category) {
            basePoolQuery.category = { $regex: category, $options: "i" };
        }

        // ============================================================================
        // 🛡️ APPLY SMART BLOCK FILTERS
        // ============================================================================
        const blockFilters = [];

        // 1. Filter out blocked users (UNLESS explicitly viewing that specific author's profile)
        if (!targetAuthor && blockedUserIds.length > 0) {
            blockFilters.push({
                authorUserId: { $nin: blockedUserIds },
                authorId: { $nin: blockedUserIds.map(id => id.toString()) }
            });
        }

        // 2. Filter out blocked clans (UNLESS explicitly viewing that specific clan's feed)
        if (!clanIdParam && blockedClanTags.length > 0) {
            blockFilters.push({ clanId: { $nin: blockedClanTags } });
        }

        // 3. Apply to both the global pool and the targeted query
        if (blockFilters.length > 0) {
            basePoolQuery.$and = blockFilters;
            query.$and = [...blockFilters];
        }

        // 🌟 TELEMETRY: IN-MEMORY CANDIDATE TRACKING WITH WEIGHTS
        const candidateMap = new Map();
        const addCandidate = (postId, type, reason = null, weight = 1) => {
            const id = postId.toString();
            if (!candidateMap.has(id)) {
                candidateMap.set(id, { _id: id, sources: [] });
            }

            const sources = candidateMap.get(id).sources;
            if (!sources.some(s => s.type === type && s.reason === reason)) {
                sources.push({ type, reason, weight });
            }
        };

        // ============================================================================
        // ⚡️ NEW PHASE 1: CANDIDATE POOL ARCHITECTURE
        // ============================================================================
        if (targetAuthor) {
            const authorOrConditions = [];
            if (mongoose.Types.ObjectId.isValid(targetAuthor)) {
                authorOrConditions.push({ authorUserId: new mongoose.Types.ObjectId(targetAuthor) });
                authorOrConditions.push({ authorId: targetAuthor });
            } else {
                authorOrConditions.push({ authorId: targetAuthor });
            }

            // Safely merge $or with existing block $and constraints
            if (query.$and) {
                query.$and.push({ $or: authorOrConditions });
            } else {
                query.$or = authorOrConditions;
            }

            if (category) query.category = { $regex: category, $options: "i" };

            // Apply 24-hour filter safely
            if (last24Hours) {
                const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
                const timeFilter = {
                    $or: [
                        { createdAt: { $gte: yesterday } },
                        { resurrectedAt: { $gte: yesterday } }
                    ]
                };

                if (query.$and) {
                    query.$and.push(timeFilter);
                } else if (query.$or) {
                    query = { $and: [{ $or: query.$or }, timeFilter] };
                } else {
                    query.$or = timeFilter.$or;
                }
            }

            total = await Post.countDocuments(query);

        } else if (clanIdParam) {
            query.clanId = clanIdParam;
            query.status = "approved";
            if (category) query.category = { $regex: category, $options: "i" };
            total = await Post.countDocuments(query);

        } else {
            // 🌐 GLOBAL FEED: PARALLEL CANDIDATE POOLING
            const poolBudget = 1000;
            const POOL_CONFIG = {
                freshPool: Math.floor(poolBudget * dynamicWeights.fresh),
                authorPool: Math.floor(poolBudget * dynamicWeights.author),
                clanPool: Math.floor(poolBudget * dynamicWeights.clan),
                interestPool: Math.floor(poolBudget * dynamicWeights.interest),
                trendingPool: Math.floor(poolBudget * dynamicWeights.trending),
                explorePool: Math.floor(poolBudget * dynamicWeights.explore)
            };

            const topAuthors = Object.entries(safeAuthorAffinity)
                .filter(([, score]) => score >= 10)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 15)
                .map(([id]) => id);

            const activeClanTags = [...new Set([...followedClanTags, ...viewerClanTags])];
            const interestRegexes = userInterests.map(i => new RegExp(`^${escapeRegex(i)}$`, "i"));

            const [
                freshPool,
                authorPool,
                clanPool,
                trendingPool,
                interestPool,
                explorePool
            ] = await Promise.all([
                Post.find(basePoolQuery).sort({ createdAt: -1 }).limit(POOL_CONFIG.freshPool).select("_id").lean(),

                topAuthors.length > 0
                    ? Post.find({
                        ...basePoolQuery,
                        $or: [
                            { authorUserId: { $in: topAuthors.map(id => mongoose.Types.ObjectId.isValid(id) ? new mongoose.Types.ObjectId(id) : id) } },
                            { authorId: { $in: topAuthors } }
                        ]
                    }).sort({ createdAt: -1 }).limit(POOL_CONFIG.authorPool).select("_id authorUserId authorId").lean()
                    : Promise.resolve([]),

                activeClanTags.length > 0
                    ? Post.find({
                        ...basePoolQuery,
                        $or: [{ clanId: { $in: activeClanTags } }]
                    }).sort({ createdAt: -1 }).limit(POOL_CONFIG.clanPool).select("_id clanId").lean()
                    : Promise.resolve([]),

                Post.find({
                    ...basePoolQuery,
                    $or: [
                        { boostedUntil: { $gt: now } },
                        { resurrectedAt: { $gte: fortyEightHoursAgo } },
                        {
                            createdAt: { $gte: fortyEightHoursAgo },
                            $expr: {
                                $or: [
                                    { $gte: [{ $size: { $ifNull: ["$likes", []] } }, 50] },
                                    { $gte: [{ $size: { $ifNull: ["$comments", []] } }, 20] },
                                    { $gte: [{ $ifNull: ["$hypeCount", "$hypePoints", 0] }, 100] }
                                ]
                            }
                        }
                    ]
                }).sort({ createdAt: -1 }).limit(POOL_CONFIG.trendingPool).select("_id").lean(),

                interestRegexes.length > 0
                    ? Post.find({
                        ...basePoolQuery,
                        interests: { $in: interestRegexes }
                    }).sort({ createdAt: -1 }).limit(POOL_CONFIG.interestPool).select("_id interests").lean()
                    : Promise.resolve([]),

                Post.aggregate([
                    { $match: basePoolQuery },
                    { $sample: { size: POOL_CONFIG.explorePool } },
                    { $project: { _id: 1 } }
                ])
            ]);

            freshPool.forEach(p => addCandidate(p._id, "fresh", "recent", 1));
            authorPool.forEach(p => {
                const aId = (p.authorUserId || p.authorId)?.toString();
                const weight = safeAuthorAffinity[aId] || 10;
                addCandidate(p._id, "author", aId, weight);
            });
            clanPool.forEach(p => {
                const cId = p.clanId?.toString();
                addCandidate(p._id, "clan", cId, 20);
            });
            trendingPool.forEach(p => addCandidate(p._id, "trending", "viral_or_boosted", 50));
            interestPool.forEach(p => {
                const rawTags = p.interests || [];
                const matchedTag = rawTags.find(tag => userInterests.includes(tag.toLowerCase().trim()));
                const cleanTag = matchedTag ? matchedTag.toLowerCase().trim() : null;
                const weight = (cleanTag && safeAffinity[cleanTag]) ? safeAffinity[cleanTag] : 5;
                addCandidate(p._id, "interest", matchedTag || "general_match", weight);
            });
            explorePool.forEach(p => addCandidate(p._id, "explore", "discovery", 1));

            const mergedIds = [
                ...freshPool, ...authorPool, ...clanPool, ...trendingPool, ...interestPool, ...explorePool
            ].map(p => p._id.toString());

            const uniqueCandidateIds = [...new Set(mergedIds)].map(id => new mongoose.Types.ObjectId(id));

            // Sync the gathered unique IDs to the query, preserving block rules
            if (query.$and) {
                query.$and.push({ _id: { $in: uniqueCandidateIds } });
            } else {
                query = { _id: { $in: uniqueCandidateIds } };
            }

            total = uniqueCandidateIds.length;
        }

        // ============================================================================
        // ⚡️ AGGREGATION & SCORING PIPELINE
        // ============================================================================
        let posts;

        if (targetAuthor) {
            posts = await Post.aggregate([
                { $match: query },
                { $addFields: { effectiveDate: { $max: ["$createdAt", { $ifNull: ["$resurrectedAt", "$createdAt"] }] } } },
                { $sort: { boostedUntil: -1, isAdminPost: -1, effectiveDate: -1 } },
                { $skip: skip },
                { $limit: limit }
            ]);
        } else {
            const CONFIG = {
                likeWeight: 2.0, commentWeight: 4.0, hypeBaseWeight: 10.0, hypeDecayRate: 0.15,
                freshnessBoost: 20, freshnessWindow: 3, gravityPower: 1.2, staticPrefBonus: 3,
                staticLocalBonus: 4, clanBonus: 20, affinityMultiplier: 1.0, tierBasicWeight: 4,
                tierEpicWeight: 7, tierLegendaryWeight: 10, tierFollowerMultiplier: 1.5,
                partnerClanBonus: 20, postBoostMultiplier: 3.0, boostIgnitionScore: 15,
                trendingThreshold: TRENDING_THRESHOLD
            };

            const pipeline = [
                { $match: query },
                { $addFields: { effectiveDate: { $max: ["$createdAt", { $ifNull: ["$resurrectedAt", "$createdAt"] }] } } },
                {
                    $lookup: {
                        from: "clans",
                        let: { postClanId: "$clanId" },
                        pipeline: [
                            { $match: { $expr: { $or: [{ $eq: ["$tag", "$$postClanId"] }, { $eq: [{ $toString: "$_id" }, "$$postClanId"] }] } } },
                            { $project: { verifiedClan: 1, "activeCustomizations.verifiedTier": 1, verifiedUntil: 1 } }
                        ],
                        as: "clanInfo"
                    }
                },
                { $unwind: { path: "$clanInfo", preserveNullAndEmptyArrays: true } },
                {
                    $addFields: {
                        ageInHours: { $max: [0.5, { $divide: [{ $subtract: [now, "$effectiveDate"] }, 3600000] }] },
                        commentsCount: { $size: { $ifNull: ["$comments", []] } },
                        likesCount: { $size: { $ifNull: ["$likes", []] } },
                        hypePointsCount: { $ifNull: ["$hypeCount", "$hypePoints", 0] },
                        isActiveBoost: { $cond: [{ $and: [{ $ne: ["$boostedUntil", null] }, { $gt: ["$boostedUntil", now] }] }, true, false] },
                        matchCount: {
                            $size: {
                                $setIntersection: [
                                    { $map: { input: { $ifNull: ["$interests", []] }, as: "t", in: { $toLower: { $trim: { input: "$$t" } } } } },
                                    userInterests
                                ]
                            }
                        },
                        isViewerFollowingClan: { $in: ["$clanId", followedClanTags] },
                        hasValidBadge: { $and: [{ $ne: ["$clanInfo.verifiedUntil", null] }, { $gt: ["$clanInfo.verifiedUntil", now] }] }
                    }
                },
                {
                    $addFields: {
                        tagAffinityTotal: {
                            $sum: {
                                $map: {
                                    input: { $ifNull: ["$interests", []] },
                                    as: "rawTag",
                                    in: {
                                        $let: {
                                            vars: { cleanTag: { $toLower: { $trim: { input: "$$rawTag" } } } },
                                            in: {
                                                $let: {
                                                    vars: {
                                                        dynamicScore: { $ifNull: [{ $getField: { field: "$$cleanTag", input: { $literal: safeAffinity } } }, 0] },
                                                        isStaticMatch: { $in: ["$$cleanTag", userInterests] }
                                                    },
                                                    in: { $cond: [{ $gt: ["$$dynamicScore", 0] }, "$$dynamicScore", { $cond: ["$$isStaticMatch", CONFIG.staticPrefBonus, 0] }] }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        authorAffinityScore: { $ifNull: [{ $getField: { field: { $toString: { $ifNull: ["$authorUserId", "$authorId"] } }, input: { $literal: safeAuthorAffinity } } }, 0] },
                        countryAffinityScore: {
                            $let: {
                                vars: {
                                    dynCountry: { $ifNull: [{ $getField: { field: { $ifNull: ["$country", "Global"] }, input: { $literal: safeCountryAffinity } } }, 0] },
                                    isStaticCountry: { $eq: ["$country", userCountry] }
                                },
                                in: { $cond: [{ $gt: ["$$dynCountry", 0] }, "$$dynCountry", { $cond: ["$$isStaticCountry", CONFIG.staticLocalBonus, 0] }] }
                            }
                        },
                        decayedHypeWeight: { $divide: [CONFIG.hypeBaseWeight, { $max: [1, { $multiply: ["$ageInHours", CONFIG.hypeDecayRate] }] }] },
                        clanTierBonus: {
                            $cond: [
                                "$hasValidBadge",
                                {
                                    $switch: {
                                        branches: [
                                            { case: { $eq: ["$clanInfo.activeCustomizations.verifiedTier", "legendary"] }, then: CONFIG.tierLegendaryWeight },
                                            { case: { $eq: ["$clanInfo.activeCustomizations.verifiedTier", "epic"] }, then: CONFIG.tierEpicWeight },
                                            { case: { $eq: ["$clanInfo.activeCustomizations.verifiedTier", "basic"] }, then: CONFIG.tierBasicWeight }
                                        ], default: 0
                                    }
                                }, 0
                            ]
                        },
                        partnerClanBonusVal: { $cond: [{ $and: ["$isViewerFollowingClan", { $eq: ["$clanInfo.verifiedClan", true] }] }, CONFIG.partnerClanBonus, 0] }
                    }
                },
                {
                    $addFields: {
                        engagementScore: {
                            $multiply: [
                                {
                                    $add: [
                                        { $cond: ["$isActiveBoost", CONFIG.boostIgnitionScore, 0] },
                                        { $multiply: [{ $ifNull: ["$likesCount", 0] }, CONFIG.likeWeight] },
                                        { $multiply: ["$commentsCount", CONFIG.commentWeight] },
                                        { $multiply: [{ $sqrt: { $ifNull: ["$hypePointsCount", 0] } }, "$decayedHypeWeight"] }
                                    ]
                                },
                                { $cond: ["$isActiveBoost", CONFIG.postBoostMultiplier, 1] }
                            ]
                        },
                        relevanceBonus: {
                            $add: [
                                { $multiply: ["$tagAffinityTotal", CONFIG.affinityMultiplier] },
                                { $multiply: ["$authorAffinityScore", CONFIG.affinityMultiplier] },
                                { $multiply: ["$countryAffinityScore", CONFIG.affinityMultiplier] },
                                { $cond: ["$isViewerFollowingClan", CONFIG.clanBonus, 0] },
                                { $cond: ["$isViewerFollowingClan", { $multiply: ["$clanTierBonus", CONFIG.tierFollowerMultiplier] }, "$clanTierBonus"] },
                                "$partnerClanBonusVal"
                            ]
                        },
                        noveltyScore: { $cond: [{ $lt: ["$ageInHours", CONFIG.freshnessWindow] }, CONFIG.freshnessBoost, 0] }
                    }
                },
                { $addFields: { finalScore: { $divide: [{ $add: ["$engagementScore", "$relevanceBonus", "$noveltyScore"] }, { $pow: ["$ageInHours", CONFIG.gravityPower] }] } } },
                { $sort: { isAdminPost: -1, finalScore: -1, effectiveDate: -1 } }
            ];

            posts = await Post.aggregate(pipeline);

            // ⚡️ DIVERSITY PASS: Applied on the FULL ranked pool BEFORE pagination
            if (posts.length > 0) {
                posts = typeof applyDiversityPass === 'function' ? applyDiversityPass(posts, 2) : posts;
            }

            // 🚀 IN-MEMORY PAGINATION
            posts = posts.slice(skip, skip + limit);
        }

        // ============================================================================
        // 📦 POPULATION & SERIALIZATION
        // ============================================================================
        let userMap = {};
        let clanMap = {};

        try {
            const uniqueAuthorIds = [...new Set(posts.map(p => (p.authorUserId || p.authorId)?.toString()).filter(Boolean))];
            const uniqueClanTags = [...new Set(posts.map(p => p.clanId?.toString()).filter(Boolean))];

            if (uniqueAuthorIds.length > 0) {
                const users = await MobileUser.find({ _id: { $in: uniqueAuthorIds } }).lean();

                users.forEach(u => {
                    const userIdStr = u._id.toString();
                    const rankInfo = typeof resolveUserRankServer === 'function' ? resolveUserRankServer(u.currentRankLevel || 1) : { rankName: "Rookie" };
                    const auraInfo = typeof getAuraVisualsServer === 'function' ? getAuraVisualsServer(u.previousRank || 0) : null;
                    const inv = Array.isArray(u.inventory) ? u.inventory : (Array.isArray(u.specialInventory) ? u.specialInventory : []);

                    userMap[userIdStr] = {
                        name: u.username, image: u.profilePic?.url || null, streak: u.lastStreak || 0,
                        rank: u.previousRank || 0, peakLevel: u.peakLevel || 0, inventory: inv,
                        rankLevel: u.currentRankLevel || 1, aura: u.aura || 0, displayRank: rankInfo.rankName,
                        auraVisuals: auraInfo,
                        equippedGlow: inv.find(i => (i.category === 'GLOW' || i.category === 'NAME_GLOW') && i.isEquipped) || null,
                        equippedBadges: inv.filter(i => i.category === 'BADGE' && i.isEquipped).slice(0, 3) || [],
                        equippedTitle: u.equippedTitle || null, nameLockedUntil: u.nameLockedUntil || null
                    };
                });
            }

            if (uniqueClanTags.length > 0) {
                const clans = await Clan.find({
                    $or: [{ tag: { $in: uniqueClanTags } }, { _id: { $in: uniqueClanTags.filter(id => id.length === 24) } }]
                }).lean();

                clans.forEach(c => {
                    const enrichedClan = { ...c, displayRank: typeof resolveClanDisplayRank === 'function' ? resolveClanDisplayRank(c.totalPoints || 0) : "Rank 1" };
                    if (c.tag) clanMap[c.tag] = enrichedClan;
                    if (c._id) clanMap[c._id.toString()] = enrichedClan;
                });
            }
        } catch (popErr) { console.error("Bulk Population Error:", popErr); }

        const serializedPosts = posts.map((p) => {
            const aId = (p.authorUserId || p.authorId)?.toString();
            const cTag = p.clanId?.toString();

            const feedMessage = (p.message || "")
                .replace(/s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs, "$1$2$3$4$5$6$8$10")
                .replace(/\n+/g, ' ').trim();

            const postLikes = p.likes || [];
            const hasLiked = deviceId ? postLikes.some(like => (like?.fingerprint === deviceId || like === deviceId)) : false;
            const hasViewed = p.viewsFingerprints?.includes(deviceId) || false;

            let pollVoteStatus = null;
            if (p.poll && p.voters?.length > 0) {
                const voterMatch = p.voters.find(v => (v.fingerprint === deviceId || v === deviceId));
                pollVoteStatus = { hasVoted: !!voterMatch, userVotedOptions: voterMatch?.selectedOptions || [] };
            }

            const finalHypeCount = p.hypeCount ?? p.hypePoints ?? 0;
            const isTrending = finalHypeCount >= TRENDING_THRESHOLD;
            const isBoosted = Boolean(p.boostedUntil && new Date(p.boostedUntil).getTime() > Date.now());
            const isResurrected = Boolean(p.resurrectedAt && new Date(p.resurrectedAt) > fortyEightHoursAgo);
            const isFollowingClan = Boolean(cTag && followedClanTags.includes(cTag));
            const telemetrySources = candidateMap.get(p._id.toString())?.sources || [];

            return {
                ...p, clanInfo: undefined, isViewerFollowingClan: undefined, hasValidBadge: undefined, clanTierBonus: undefined, partnerClanBonusVal: undefined,
                _id: p._id.toString(),
                message: typeof normalizePostContent === 'function' ? normalizePostContent(p.message) : p.message,
                feedExcerpt: feedMessage.length > 150 ? feedMessage.slice(0, 150) + "..." : feedMessage,
                formattedViews: typeof formatViewsServer === 'function' ? formatViewsServer(p.viewsCount ?? p.views ?? 0) : (p.viewsCount || 0),
                likesCount: p.likesCount ?? (p.likes?.length || 0), commentsCount: p.commentsCount ?? (p.comments?.length || 0), hypePointsCount: finalHypeCount,
                isTrending, isBoosted, isResurrected, isFollowingClan, candidateSources: telemetrySources,
                discussionCount: typeof calculateDiscussionCount === 'function' ? calculateDiscussionCount(p.comments || []) : 0,
                hasLiked, hasViewed, poll: p.poll ? { ...p.poll, ...pollVoteStatus } : p.poll,
                authorData: userMap[aId] || null, clanData: clanMap[cTag] || null
            };
        });

        return NextResponse.json({ posts: serializedPosts, total, page, limit }, { status: 200 });
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

// 🌟 NEW CENTRALIZED LOGGING HELPER
async function logEvent(postId, type, message, metadata = {}) {
    try {
        await PostEvent.create({
            postId: postId ? postId.toString() : "SYSTEM",
            type,
            message,
            metadata: { ...metadata, timestamp: new Date() }
        });
        console.log(`[EVENT] ${type} | Post: ${postId}`);
    } catch (error) {
        console.error("Failed to write to PostEvent logs:", error);
    }
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
            pollMultiple, pollOptions, category, useR2,
            mediaPending,  // 🌟 Present ONLY in new client builds
            totalFiles,    // 🌟 Present ONLY in new client builds
            requestId      // 🌟 NEW: Client-side generated idempotency key
        } = body;

        const fingerprint = req.headers.get("x-user-deviceId") || req.headers.get("x-device-id");

        // Log immediate receipt
        await logEvent(null, "POST_REQUEST_RECEIVED", "Initial POST request hit server", { requestId, fingerprint, totalFiles });

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

        // 🌟 IDEMPOTENCY CHECK (Early Return to kill duplicates)
        let newPost;

        if (requestId) {
            const existingPost = await Post.findOne({
                requestId,
                authorUserId: userDoc._id
            });

            if (existingPost) {
                await logEvent(existingPost._id, "DUPLICATE_POST_DETECTED", "Network retry caught. Returning existing context.", { requestId });
                return addCorsHeaders(NextResponse.json({
                    message: "Duplicate request.",
                    post: existingPost,
                    signData: existingPost.signData
                }, { status: 200 }));
            }
        }

        // 3. 🛡️ BACKWARDS COMPATIBILITY: Robust Media Mapping
        const primaryMediaUrl = mediaUrl || (media && media.length > 0 ? media[0].url : null);
        const primaryMediaType = mediaType || (media && media.length > 0 ? media[0].type : "image");
        const finalMediaArray = media || (primaryMediaUrl ? [{ url: primaryMediaUrl, type: primaryMediaType, order: 0 }] : []);
        console.log(primaryMediaUrl, media);

        // 4. Generate Slugs
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
        let finalStatus = mediaPending ? "pending" : (isMobile ? "pending" : "approved");

        // 6. Build Post Context Contextually
        newPost = await Post.create({
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
            uploadStatus: mediaPending ? "pending" : "uploaded",
            moderationStatus: mediaPending ? "pending" : (isMobile ? "pending" : "approved"),
            requestId, // 🌟 Save the Idempotency Key
            poll: hasPoll ? {
                pollMultiple: pollMultiple || false,
                options: pollOptions && pollOptions.length >= 2 ? pollOptions.map(opt => ({ text: opt.text, votes: 0 })) : []
            } : null,
            category,
            clanId: clanId,
            country: country,
            totalFilesExpected: totalFiles || 0
        });

        await logEvent(newPost._id, "POST_CREATED", "Post initialized", {
            requestId,
            mediaPending,
            totalFiles,
            title,
            isMobile
        });

        // 🛣️ PATH A: New client build initializing background media upload operations
        if (mediaPending) {
            const timestamp = Math.round(new Date().getTime() / 1000);
            const signDataArray = [];

            if (useR2) {
                // 🌟 NEW R2 PIPELINE
                for (let i = 0; i < totalFiles; i++) {
                    const ext = finalMediaArray[i]?.type === "video" ? "mp4" : "jpg";
                    const objectKey = `posts/${newPost._id}/file_${i}.${ext}`;

                    const command = new PutObjectCommand({
                        Bucket: process.env.R2_BUCKET_NAME,
                        Key: objectKey,
                    });

                    const presignedUrl = await getSignedUrl(r2Client, command, { expiresIn: 3600 });
                    const publicUrl = `https://media.oreblogda.com/${objectKey}`;

                    signDataArray.push({
                        engine: "r2",
                        uploadUrl: presignedUrl,
                        objectKey: objectKey,
                        publicUrl
                    });

                    finalMediaArray[i] = {
                        url: publicUrl,
                        type: finalMediaArray[i]?.type || "image",
                        order: finalMediaArray[i]?.order ?? i,
                        r2Key: objectKey,
                    };
                }

                // ✅ FIX 1: Persist the mutated media array back to MongoDB so the cron can find it
                newPost.media = finalMediaArray;
                newPost.mediaUrl = finalMediaArray[0]?.url ?? null;
                newPost.mediaType = finalMediaArray[0]?.type ?? null;
                await newPost.save();

                await logEvent(newPost._id, "PRESIGNED_URL_GENERATED", "R2 Pre-signed URLs mapped", { count: signDataArray.length });

            } else {
                // 🌟 LEGACY CLOUDINARY PIPELINE (Unchanged)
                const host = req.headers.get("host") || "localhost:3000";
                const protocol = host.includes("localhost") ? "http" : "https";
                const notificationUrl = `${protocol}://${host}/api/webhooks/cloudinary`;

                for (let i = 0; i < totalFiles; i++) {
                    const contextString = `postId=${newPost._id.toString()}|fileIndex=${i}`;
                    const paramsToSign = {
                        timestamp, folder: "posts", context: contextString, notification_url: notificationUrl
                    };
                    const signature = cloudinary.utils.api_sign_request(paramsToSign, process.env.CLOUDINARY_API_SECRET);

                    signDataArray.push({
                        engine: "cloudinary",
                        signature, timestamp, folder: "posts", context: contextString,
                        notificationUrl, apiKey: process.env.CLOUDINARY_API_KEY,
                        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
                    });
                }
                await logEvent(newPost._id, "PRESIGNED_URL_GENERATED", "Cloudinary Signatures mapped", { count: signDataArray.length });
            }

            return addCorsHeaders(NextResponse.json({
                message: "Post initialized. Awaiting media assets.",
                post: newPost,
                signData: signDataArray
            }, { status: 201 }));
        }

        console.log({
            mediaPending,
            isMobile,
            status: newPost.status,
            moderationStatus: newPost.moderationStatus
        });

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

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "donakg9he",
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

export async function finalizeAndPublishPost(postId, isMobile, country, fingerprint, isEdit = false) {
    await logEvent(postId, "FINALIZE_CALLED", "Finalize Engine execution started", { isMobile, isEdit });

    const post = await Post.findById(postId);
    if (!post) {
        await logEvent(postId, "FINALIZE_FAILED", "Target post context not found");
        throw new Error("Target post context not found.");
    }
    console.log(
        "[FINALIZE]",
        postId,
        isMobile
    );

    // 🛡️ IDEMPOTENCY GUARD
    // If it's an edit, we bypass this guard because the status might already be 'approved' from before
    if (!isEdit && post.status !== "pending_media" && post.status !== "pending" && post.totalFilesExpected > 0) {
        console.log(`⚠️ Blocked duplicate publishing execution race for Post ID: ${postId}`);
        await logEvent(postId, "DUPLICATE_POST_DETECTED", "Blocked race condition in finalize engine", { currentStatus: post.status });
        return { message: "Post already processed and published via parallel asset pipeline.", post };
    }

    // 🚀 CLOUDINARY ASYNC EAGER UPLOAD INTELLIGENCE
    // We intercepts videos and upload them to Cloudinary eagerly to solve synchronous limits.
    if (post.media && post.media.length > 0) {
        for (let i = 0; i < post.media.length; i++) {
            const item = post.media[i];
            if (!item || !item.url) continue;

            const isVideo = item.url.match(/\.(mp4|mov|webm|mkv)$/i) || item.type === "video" || post.mediaType === "video";
            const isCloudinary = item.url.includes("res.cloudinary.com");

            if (isVideo && !isCloudinary) {
                try {
                    console.log(`[CLOUDINARY] Uploading video asynchronously to bypass synchronous processing limits: ${item.url}`);
                    const uploadResult = await cloudinary.uploader.upload(item.url, {
                        resource_type: "video",
                        folder: "posts_videos",
                        // Pre-generate the exact thumbnail and optimized web versions asynchronously
                        eager: [
                            { format: "jpg", width: 600, crop: "scale", quality: "auto", start_offset: "auto" },
                            { quality: "auto" }
                        ],
                        eager_async: true
                    });

                    if (uploadResult && uploadResult.secure_url) {
                        console.log(`[CLOUDINARY] Upload successful. Replacing URL with secure native link: ${uploadResult.secure_url}`);
                        post.media[i].url = uploadResult.secure_url;
                        if (post.mediaUrl === item.url || !post.mediaUrl || !post.mediaUrl.includes("res.cloudinary.com")) {
                            post.mediaUrl = uploadResult.secure_url;
                            post.mediaType = "video";
                        }
                    }
                } catch (err) {
                    console.error("❌ Cloudinary eager upload failed for video asset:", err);
                }
            }
        }
    }

    if (post.mediaUrl && !post.mediaUrl.includes("res.cloudinary.com")) {
        const isVideo = post.mediaUrl.match(/\.(mp4|mov|webm|mkv)$/i) || post.mediaType === "video";
        if (isVideo) {
            try {
                console.log(`[CLOUDINARY] Uploading primary video to Cloudinary: ${post.mediaUrl}`);
                const uploadResult = await cloudinary.uploader.upload(post.mediaUrl, {
                    resource_type: "video",
                    folder: "posts_videos",
                    eager: [
                        { format: "jpg", width: 600, crop: "scale", quality: "auto", start_offset: "auto" },
                        { quality: "auto" }
                    ],
                    eager_async: true
                });
                if (uploadResult && uploadResult.secure_url) {
                    post.mediaUrl = uploadResult.secure_url;
                    post.mediaType = "video";
                }
            } catch (err) {
                console.error("❌ Cloudinary primary video upload failed:", err);
            }
        }
    }

    let userDoc = await userModel.findById(post.authorUserId);
    if (!userDoc && fingerprint) {
        userDoc = await MobileUser.findOne({ deviceId: fingerprint });
    }

    let finalStatus = isMobile ? "pending" : "approved";
    let rejectionReason = "";
    let expiresAt = null;
    let aiInterests = [];

    // Update independent state fields
    // If we are finalizing, media is expected to be present.
    if (post.uploadStatus !== "uploaded") {
        post.uploadStatus = "uploaded";
    }

    // Only mark moderation as processing when we are going to run AI.
    // For non-mobile builds you may keep prior moderationStatus.

    if (isMobile) {
        // 🛡️ If finalize is called before uploads are fully present,
        // keep post recoverable and do NOT burn AI cost.
        // (Cron worker will re-run once media exists.)
        const expectsMedia = post.totalFilesExpected > 0;

        const hasMedia =
            Array.isArray(post.media) &&
            post.media.some(m => m?.url);

        if (expectsMedia && (!hasMedia || post.mediaUrl == null)) {
            post.uploadStatus = post.uploadStatus || "uploaded";
            post.moderationStatus = "pending";
            post.status = "pending";
            await post.save();

            await logEvent(postId, "FINALIZE_FAILED", "Media not ready. Re-queued.", { expectsMedia, hasMedia });

            return {
                message: "Post finalized but pending moderation (media not ready yet)",
                post,
                isFirstPost: false,
                auraStats: null
            };
        }

        // 🛡️ BACKWARDS COMPATIBILITY: Restore old build inline poll rejection logic 
        if (post.category === "Polls" && (!post.poll || post.poll.options.length < 2)) {
            finalStatus = "rejected";
            rejectionReason = "Polls require a valid configuration with at least 2 options.";
            expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
        } else {
            // Run standard moderation - WE ALWAYS RE-RUN THIS ON EDIT TO CATCH BAD CHANGES
            post.moderationStatus = "processing";

            await logEvent(postId, "AI_STARTED", "Sending post context to AI Moderator");
            // Passed post.poll as the final argument
            const ai = await runAIModerator(post.title, post.message, post.clanId, post.category, post.mediaUrl, post.mediaType, post.poll);

            await logEvent(postId, "AI_COMPLETED", "AI Moderation returned", { action: ai.action, reason: ai.reason });

            aiInterests = ai.interests || [];

            if (ai.action === "approve") {
                finalStatus = "approved";
                rejectionReason = ai.reason;
                post.moderationStatus = "approved";
            } else if (ai.action === "reject") {
                finalStatus = "rejected";
                rejectionReason = ai.reason;
                post.moderationStatus = "rejected";
                expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
            } else {
                finalStatus = "pending";
                rejectionReason = ai.reason;
                post.moderationStatus = "failed";
            }
        }
    }

    // 🛠️ DEDUPLICATION GUARD & ARRAY RE-ORDERING
    if (post.media && post.media.length > 0) {
        post.media.sort((a, b) => (a.order || 0) - (b.order || 0));

        const uniqueUrls = new Set();
        post.media = post.media.filter(item => {
            if (!item || !item.url) return false;
            if (uniqueUrls.has(item.url)) return false;
            uniqueUrls.add(item.url);
            return true;
        });
    }

    post.status = finalStatus;
    post.rejectionReason = rejectionReason || null;
    post.expiresAt = expiresAt || null;
    post.interests = aiInterests;

    // Default upload/moderation state alignment for non-mobile flows
    if (!post.uploadStatus) post.uploadStatus = "uploaded";
    if (!post.moderationStatus) {
        post.moderationStatus = finalStatus === "approved" ? "approved" : (finalStatus === "rejected" ? "rejected" : "failed");
    }

    await post.save();

    let isFirstPost = false;
    let auraStats = null;

    // 🌟 ONLY AWARD POINTS AND RUN GAMIFICATION IF IT'S A BRAND NEW POST
    if (!isEdit) {
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
                    const tokens = followers.flatMap(f => {
                        const token = f.userId?.pushToken;
                        return token != null ? [token] : [];
                    });

                    if (tokens.length > 0) {
                        await sendPillParallel(
                            tokens,
                            `${clan?.name || post.clanId} Transmission 🚩`,
                            `${userDoc?.username || 'Someone'} posted: ${post.title}`,
                            {
                                type: "open_post",
                                postId: post._id.toString(),
                                clanTag: post.clanId,
                                screen: `/post/${post._id.toString()}`,
                                mediaUrl: post.mediaUrl,
                                authorPfp: userDoc?.profilePic?.url
                            },
                            {
                                type: 'clan_post',
                                targetAudience: 'clan',
                                targetId: post.clanId,
                                priority: 3,
                                link: `/post/${post._id.toString()}`,
                                expiresInHours: 6
                            }
                        );
                    }
                } catch (err) { console.error("Clan alert fault:", err); }
            }

            await logEvent(postId, "POST_PUBLISHED", "Post successfully broadcasted and published");
        }
    }

    // 🌟 WE STILL SEND ADMIN ALERTS AND REJECTION NOTICES EVEN ON EDITS
    if (finalStatus === "pending") {
        const adminTokens = ["cUxM1ev3RBucmAXg7LklVv:APA91bEqsCxOVL9wzS-ag9DRvEJjNBUnhmiZ7hyreQ54mUGxH9x3CraM27SVZuPIyUG4HRx8IODPYGkD24MJqYiNSTKoBVrV19CLMs-ZcUiNa-plrUta6D0",];
        for (const token of adminTokens) {
            try {
                await sendPushNotification(
                    token,
                    isEdit ? "Edited post needs review!" : "New post!",
                    "A post is awaiting your approval.",
                    {
                        postId: post._id.toString(),
                        mediaUrl: post.mediaUrl,
                        authorPfp: userDoc?.profilePic?.url
                    }
                );
            } catch (pErr) { }
        }
        try {
            const transporter = nodemailer.createTransport({ service: "gmail", auth: { user: process.env.MAILEREMAIL, pass: process.env.MAILERPASS } });
            await transporter.sendMail({
                from: `"Oreblogda" <${process.env.MAILEREMAIL}>`,
                to: "Admins",
                bcc: ["kayteedberserker@gmail.com", "fredrickokwu@gmail.com"],
                subject: isEdit ? `📰 Edited Post Awaiting Approval` : `📰 New Post Awaiting Approval`,
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
                {
                    type: "open_diary",
                    status: "rejected",
                    reason: rejectionReason,
                    postId: post._id.toString(),
                    screen: "/authordiary",
                    mediaUrl: post.mediaUrl,
                    authorPfp: userDoc?.profilePic?.url
                },
                {
                    type: 'post_rejection',
                    targetAudience: 'user',
                    link: "/authordiary",
                    targetId: userDoc._id.toString(),
                    singleUser: true,
                    priority: 10,
                    expiresInHours: 12
                }
            );
        } catch (err) { console.error("Rejection notice fault:", err); }
    }

    await logEvent(postId, "FINALIZE_SUCCESS", "Finalize execution successfully finished", { finalStatus, isEdit });

    return {
        message: finalStatus === "approved" ? (isEdit ? "Post updated successfully" : "Post created successfully") : finalStatus === "rejected" ? "Post rejected by AI" : "Post submitted for approval",
        post,
        isFirstPost,
        auraStats
    };
}

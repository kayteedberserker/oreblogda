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
import PostEvent from "@/app/models/PostEventModel";
import Post from "@/app/models/PostModel";
import userModel from "@/app/models/UserModel";
import { v2 as cloudinary } from "cloudinary";
import geoip from "geoip-lite";
import mongoose from "mongoose";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
// At the top of your file
import { S3Client } from "@aws-sdk/client-s3";

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


import FeedSession from "@/app/models/FeedSessionSchema";

const FEED_SESSION_IDLE_TTL_MS = 10 * 60 * 1000;
const FEED_SESSION_MAX_AGE_MS = 30 * 60 * 1000;
const FEED_SESSION_SNAPSHOT_SIZE = 240;
const FEED_ALGORITHM_VERSION = "personalized-feed-v3-following";

function createFeedSessionId() {
    if (globalThis.crypto?.randomUUID) {
        return globalThis.crypto.randomUUID();
    }

    return [
        Date.now().toString(36),
        Math.random().toString(36).slice(2),
        Math.random().toString(36).slice(2)
    ].join("-");
}

function getFeedViewerKey({
    deviceId,
    viewerId,
    userCountry
}) {
    if (deviceId) {
        return `device:${deviceId}`;
    }

    if (viewerId) {
        return `viewer:${viewerId}`;
    }

    return `anonymous:${userCountry || "Global"}`;
}

function getFeedScopeKey({ category, feedMode }) {
    const normalizedCategory =
        typeof category === "string"
            ? category.trim().toLowerCase()
            : "";

    if (feedMode === "following") {
        return "following";
    }

    return normalizedCategory
        ? `category:${normalizedCategory}`
        : "global";
}

function getSessionExpiryDates(nowMs = Date.now()) {
    return {
        expiresAt: new Date(
            nowMs + FEED_SESSION_IDLE_TTL_MS
        ),
        maxExpiresAt: new Date(
            nowMs + FEED_SESSION_MAX_AGE_MS
        )
    };
}

function getExtendedSessionExpiry(session, nowMs = Date.now()) {
    const maximumExpiry = new Date(
        session.maxExpiresAt
    ).getTime();

    return new Date(
        Math.min(
            nowMs + FEED_SESSION_IDLE_TTL_MS,
            Number.isFinite(maximumExpiry)
                ? maximumExpiry
                : nowMs + FEED_SESSION_IDLE_TTL_MS
        )
    );
}

function seededRandom(seed) {
    let value = seed % 2147483647;

    if (value <= 0) {
        value += 2147483646;
    }

    return () => {
        value = (value * 16807) % 2147483647;
        return (value - 1) / 2147483646;
    };
}

function hashString(value) {
    let hash = 0;

    for (let index = 0; index < value.length; index++) {
        hash = ((hash << 5) - hash + value.charCodeAt(index)) | 0;
    }

    return Math.abs(hash);
}

function seededShuffle(items, seed) {
    const result = [...items];
    const random = seededRandom(seed);

    for (let index = result.length - 1; index > 0; index--) {
        const randomIndex = Math.floor(random() * (index + 1));
        [result[index], result[randomIndex]] = [result[randomIndex], result[index]];
    }

    return result;
}

function getExploreBucket(postId, candidateMap) {
    const sources = candidateMap.get(postId)?.sources || [];

    // Posts already selected through a stronger personalized/ranked source
    // remain in the regular stream instead of consuming discovery quota.
    const hasPrioritySource = sources.some(source =>
        ["clan", "author", "interest", "trending"].includes(source.type)
    );

    if (hasPrioritySource) {
        return null;
    }

    const exploreSource = sources.find(source => source.type === "explore");

    if (exploreSource?.reason === "2_5_days") {
        return "new";
    }

    if (exploreSource?.reason === "5_9_days") {
        return "mid";
    }

    if (exploreSource?.reason === "9_14_days") {
        return "old";
    }

    return null;
}

function getExploreBucketTargets(exploreSlots) {
    const weights = {
        new: 3,
        mid: 2,
        old: 1
    };

    const weightTotal = 6;
    const targets = {
        new: 0,
        mid: 0,
        old: 0
    };

    const remainders = [];

    for (const bucket of ["new", "mid", "old"]) {
        const exactTarget = (exploreSlots * weights[bucket]) / weightTotal;
        targets[bucket] = Math.floor(exactTarget);
        remainders.push({
            bucket,
            remainder: exactTarget - targets[bucket]
        });
    }

    let unassigned = exploreSlots
        - targets.new
        - targets.mid
        - targets.old;

    remainders.sort((a, b) => {
        if (b.remainder !== a.remainder) {
            return b.remainder - a.remainder;
        }

        return ["new", "mid", "old"].indexOf(a.bucket)
            - ["new", "mid", "old"].indexOf(b.bucket);
    });

    for (let index = 0; index < unassigned; index++) {
        targets[remainders[index % remainders.length].bucket]++;
    }

    return targets;
}

function takeBestRemainingExplorePost(
    exploreBuckets,
    exploreIndexes,
    rankedIndexMap
) {
    let selectedBucket = null;
    let selectedPost = null;
    let selectedRank = Number.POSITIVE_INFINITY;

    for (const bucket of ["new", "mid", "old"]) {
        const candidate = exploreBuckets[bucket][exploreIndexes[bucket]];

        if (!candidate) {
            continue;
        }

        const candidateRank = rankedIndexMap.get(candidate._id.toString())
            ?? Number.POSITIVE_INFINITY;

        if (candidateRank < selectedRank) {
            selectedBucket = bucket;
            selectedPost = candidate;
            selectedRank = candidateRank;
        }
    }

    if (!selectedPost || !selectedBucket) {
        return null;
    }

    exploreIndexes[selectedBucket]++;
    return selectedPost;
}

function takeExploreBucketMix(
    exploreBuckets,
    exploreIndexes,
    requestedCount,
    rankedIndexMap
) {
    const selectedPosts = [];
    const targets = getExploreBucketTargets(requestedCount);

    for (const bucket of ["new", "mid", "old"]) {
        const availableCount =
            exploreBuckets[bucket].length - exploreIndexes[bucket];
        const takeCount = Math.min(targets[bucket], availableCount);

        if (takeCount <= 0) {
            continue;
        }

        selectedPosts.push(
            ...exploreBuckets[bucket].slice(
                exploreIndexes[bucket],
                exploreIndexes[bucket] + takeCount
            )
        );

        exploreIndexes[bucket] += takeCount;
    }

    while (selectedPosts.length < requestedCount) {
        const fallbackPost = takeBestRemainingExplorePost(
            exploreBuckets,
            exploreIndexes,
            rankedIndexMap
        );

        if (!fallbackPost) {
            break;
        }

        selectedPosts.push(fallbackPost);
    }

    selectedPosts.sort((a, b) => {
        const aRank = rankedIndexMap.get(a._id.toString())
            ?? Number.POSITIVE_INFINITY;
        const bRank = rankedIndexMap.get(b._id.toString())
            ?? Number.POSITIVE_INFINITY;

        return aRank - bRank;
    });

    return selectedPosts;
}

function interleavePagePosts(regularPosts, explorePosts) {
    if (explorePosts.length === 0) {
        return regularPosts;
    }

    if (regularPosts.length === 0) {
        return explorePosts;
    }

    const result = [];
    let regularIndex = 0;
    let exploreIndex = 0;

    const regularsPerExplore = Math.max(
        1,
        Math.round(regularPosts.length / explorePosts.length)
    );

    while (
        regularIndex < regularPosts.length
        || exploreIndex < explorePosts.length
    ) {
        for (
            let count = 0;
            count < regularsPerExplore
            && regularIndex < regularPosts.length;
            count++
        ) {
            result.push(regularPosts[regularIndex++]);
        }

        if (exploreIndex < explorePosts.length) {
            result.push(explorePosts[exploreIndex++]);
        }

        if (exploreIndex >= explorePosts.length) {
            while (regularIndex < regularPosts.length) {
                result.push(regularPosts[regularIndex++]);
            }
        }
    }

    return result;
}

function buildBucketAwareExploreFeed(
    rankedPosts,
    candidateMap,
    pageSize,
    exploreRatio = 0.30
) {
    if (rankedPosts.length === 0) {
        return [];
    }

    const safePageSize = Math.max(1, pageSize);
    const rankedIndexMap = new Map(
        rankedPosts.map((post, index) => [post._id.toString(), index])
    );

    const regularPosts = [];
    const exploreBuckets = {
        new: [],
        mid: [],
        old: []
    };

    for (const post of rankedPosts) {
        const postId = post._id.toString();
        const bucket = getExploreBucket(postId, candidateMap);

        if (bucket) {
            exploreBuckets[bucket].push(post);
        } else {
            regularPosts.push(post);
        }
    }

    const exploreIndexes = {
        new: 0,
        mid: 0,
        old: 0
    };

    let regularIndex = 0;
    const mixedFeed = [];

    const getRemainingExploreCount = () =>
        (exploreBuckets.new.length - exploreIndexes.new)
        + (exploreBuckets.mid.length - exploreIndexes.mid)
        + (exploreBuckets.old.length - exploreIndexes.old);

    while (
        regularIndex < regularPosts.length
        || getRemainingExploreCount() > 0
    ) {
        const remainingRegularCount = regularPosts.length - regularIndex;
        const remainingExploreCount = getRemainingExploreCount();
        const currentPageSize = Math.min(
            safePageSize,
            remainingRegularCount + remainingExploreCount
        );

        let exploreTarget = Math.min(
            Math.round(currentPageSize * exploreRatio),
            remainingExploreCount
        );

        let regularTarget = Math.min(
            currentPageSize - exploreTarget,
            remainingRegularCount
        );

        // If there are not enough regular posts, use additional explore posts.
        exploreTarget = Math.min(
            currentPageSize - regularTarget,
            remainingExploreCount
        );

        // If there are not enough explore posts, fill the page with regular posts.
        regularTarget = Math.min(
            currentPageSize - exploreTarget,
            remainingRegularCount
        );

        const pageRegularPosts = regularPosts.slice(
            regularIndex,
            regularIndex + regularTarget
        );
        regularIndex += pageRegularPosts.length;

        const pageExplorePosts = takeExploreBucketMix(
            exploreBuckets,
            exploreIndexes,
            exploreTarget,
            rankedIndexMap
        );

        const pagePosts = interleavePagePosts(
            pageRegularPosts,
            pageExplorePosts
        );

        // Safety fill for unusual pool exhaustion combinations.
        while (pagePosts.length < currentPageSize) {
            if (regularIndex < regularPosts.length) {
                pagePosts.push(regularPosts[regularIndex++]);
                continue;
            }

            const fallbackExplorePost = takeBestRemainingExplorePost(
                exploreBuckets,
                exploreIndexes,
                rankedIndexMap
            );

            if (!fallbackExplorePost) {
                break;
            }

            pagePosts.push(fallbackExplorePost);
        }

        if (pagePosts.length === 0) {
            break;
        }

        mixedFeed.push(...pagePosts);
    }

    return mixedFeed;
}

async function fetchFullPostsInOrder(rankedRows, deviceId = "") {
    if (!rankedRows.length) {
        return [];
    }

    const rankedIds = rankedRows
        .map(row => row._id?.toString())
        .filter(Boolean);

    const pageObjectIds = rankedIds
        .filter(id => mongoose.Types.ObjectId.isValid(id))
        .map(id => new mongoose.Types.ObjectId(id));

    if (pageObjectIds.length === 0) {
        return [];
    }

    const hasViewer = Boolean(deviceId);

    // Feed cards do not need complete interaction arrays. MongoDB computes the
    // current viewer state while returning only compact card fields.
    const fullPosts = await Post.aggregate([
        {
            $match: {
                _id: { $in: pageObjectIds }
            }
        },
        {
            $project: {
                title: 1,
                message: 1,

                mediaUrl: 1,
                mediaType: 1,
                media: 1,

                authorId: 1,
                authorUserId: 1,
                authorName: 1,
                clanId: 1,

                slug: 1,
                category: 1,
                interests: 1,
                country: 1,

                // Author-profile moderation state.
                status: 1,
                rejectionReason: 1,

                poll: 1,

                createdAt: 1,
                updatedAt: 1,
                boostedUntil: 1,
                resurrectedAt: 1,

                hypePoints: 1,
                hypeCount: 1,

                likesCount: {
                    $ifNull: ["$likesCount", "$likeCount", 0]
                },
                commentsCount: {
                    $ifNull: ["$commentsCount", 0]
                },
                discussionCount: {
                    $ifNull: ["$discussionCount", 0]
                },
                viewsCount: {
                    $ifNull: ["$viewsCount", "$views", 0]
                },
                sharesCount: {
                    $ifNull: ["$sharesCount", "$shares", 0]
                },

                hasLiked: hasViewer
                    ? {
                        $anyElementTrue: {
                            $map: {
                                input: { $ifNull: ["$likes", []] },
                                as: "like",
                                in: {
                                    $or: [
                                        { $eq: ["$$like", deviceId] },
                                        { $eq: ["$$like.fingerprint", deviceId] },
                                        { $eq: ["$$like.deviceId", deviceId] }
                                    ]
                                }
                            }
                        }
                    }
                    : { $literal: false },

                hasViewed: hasViewer
                    ? {
                        $in: [
                            deviceId,
                            { $ifNull: ["$viewsFingerprints", []] }
                        ]
                    }
                    : { $literal: false },

                viewerPollVote: hasViewer
                    ? {
                        $arrayElemAt: [
                            {
                                $filter: {
                                    input: { $ifNull: ["$voters", []] },
                                    as: "voter",
                                    cond: {
                                        $or: [
                                            { $eq: ["$$voter", deviceId] },
                                            { $eq: ["$$voter.fingerprint", deviceId] }
                                        ]
                                    }
                                }
                            },
                            0
                        ]
                    }
                    : { $literal: null }
            }
        }
    ]);

    const fullPostMap = new Map(
        fullPosts.map(post => [post._id.toString(), post])
    );

    return rankedIds
        .map(id => fullPostMap.get(id))
        .filter(Boolean);
}

export async function GET(req) {
    const requestStartedAt = Date.now();

    try {
        const connectionStartedAt = Date.now();
        await connectDB();

        console.log(
            "Feed DB connection:",
            Date.now() - connectionStartedAt,
            "ms"
        );

        const { searchParams } = new URL(req.url);
        const parsedPage = Number.parseInt(
            searchParams.get("page") || "1",
            10
        );
        const page = Number.isFinite(parsedPage)
            ? Math.max(1, parsedPage)
            : 1;

        const parsedLimit = Number.parseInt(
            searchParams.get("limit") || "30",
            10
        );
        const limit = Number.isFinite(parsedLimit)
            ? Math.min(50, Math.max(1, parsedLimit))
            : 30;
        const author = searchParams.get("author");
        const authorId = searchParams.get("authorId");
        const category = searchParams.get("category");
        const viewerId = searchParams.get("viewerId");
        const requestedFeedMode =
            searchParams.get("feed")?.trim().toLowerCase() ||
            "for-you";

        const requestedFeedSessionId =
            searchParams.get("feedSessionId")?.trim() || "";

        const parsedCursor = Number.parseInt(
            searchParams.get("cursor") || "0",
            10
        );

        const requestedCursor = Number.isFinite(parsedCursor)
            ? Math.max(0, parsedCursor)
            : 0;

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

        const isFollowingFeedRequest = Boolean(
            requestedFeedMode === "following"
            && !targetAuthor
            && !clanIdParam
            && !category
            && !last24Hours
        );

        const isPersonalizedFeedRequest = Boolean(
            !targetAuthor
            && !clanIdParam
            && !last24Hours
        );

        const feedViewerKey = getFeedViewerKey({
            deviceId,
            viewerId,
            userCountry
        });

        const feedScopeKey = getFeedScopeKey({
            category,
            feedMode: isFollowingFeedRequest
                ? "following"
                : "for-you"
        });

        let responseFeedSessionId = null;
        let responseNextCursor = null;
        let responseHasMore = null;
        let responseFeedSessionExpiresAt = null;
        let responseFeedScopeKey = null;
        let sessionPageRankedRows = null;

        const now = new Date();
        const fortyEightHoursAgo = new Date(now.getTime() - (48 * 60 * 60 * 1000));

        // ⚡️ 3-Bucket Explore Boundaries
        const fiveDaysAgo = new Date(now.getTime() - (5 * 24 * 60 * 60 * 1000));
        const nineDaysAgo = new Date(now.getTime() - (9 * 24 * 60 * 60 * 1000));
        const exploreCutoff = new Date(now.getTime() - (14 * 24 * 60 * 60 * 1000));

        // 🧠 FETCH VIEWER CONTEXT IN PARALLEL
        const contextStartedAt = Date.now();

        let safeAffinity = {};
        let safeAuthorAffinity = {};
        let safeCountryAffinity = {};

        let blockedUserIds = [];
        let blockedClanTags = [];

        let dynamicWeights = {
            fresh: 0.1,
            author: 0.15,
            clan: 0.15,
            interest: 0.15,
            trending: 0.15,
            explore: 0.3
        };

        const [userProfile, follows, memberships] = await Promise.all([
            deviceId
                ? MobileUser.findOne({ deviceId })
                    .select("affinityScores authorAffinity countryAffinity feedLearning blockedUsers blockedClans")
                    .lean()
                : Promise.resolve(null),

            viewerId
                ? ClanFollower.find({ userId: viewerId })
                    .select("clanTag")
                    .lean()
                : Promise.resolve([]),

            viewerId
                ? Clan.find({
                    $or: [
                        { leader: viewerId },
                        { viceLeader: viewerId },
                        { members: viewerId }
                    ]
                })
                    .select("tag _id")
                    .lean()
                : Promise.resolve([])
        ]);

        if (userProfile) {
            safeAffinity = userProfile.affinityScores || {};
            safeAuthorAffinity = userProfile.authorAffinity || {};
            safeCountryAffinity = userProfile.countryAffinity || {};

            if (userProfile.feedLearning?.poolWeights) {
                dynamicWeights = {
                    ...dynamicWeights,
                    ...userProfile.feedLearning.poolWeights
                };
            }

            if (userProfile.blockedUsers?.length > 0) {
                blockedUserIds = userProfile.blockedUsers;
            }

            if (userProfile.blockedClans?.length > 0) {
                const blockedClansDocs = await Clan.find({
                    _id: { $in: userProfile.blockedClans }
                })
                    .select("tag")
                    .lean();

                blockedClanTags = blockedClansDocs
                    .map(clan => clan.tag)
                    .filter(Boolean);
            }
        }

        const followedClanTags = follows
            .map(follow => follow.clanTag)
            .filter(Boolean);

        const viewerClanTags = memberships
            .flatMap(clan => [
                clan.tag,
                clan._id?.toString()
            ])
            .filter(Boolean);

        // Ranking treats both followed clans and the viewer's own clans as connected.
        // The client-facing isFollowingClan field remains follow-only during serialization.
        const activeClanTags = [
            ...new Set([
                ...followedClanTags,
                ...viewerClanTags
            ])
        ];

        const authenticatedViewerUserId =
            userProfile?._id?.toString?.() || "";

        // The owner may inspect all moderation states on their own profile.
        // Other viewers still receive approved posts only.
        //
        // NOTE: This assumes x-user-deviceId is already protected by your
        // authentication layer. A signed session/JWT is safer than trusting
        // a freely supplied device header by itself.
        const isOwnAuthorFeed = Boolean(
            targetAuthor
            && deviceId
            && (
                targetAuthor === deviceId
                || targetAuthor === authenticatedViewerUserId
            )
        );

        console.log(
            "Feed viewer context:",
            Date.now() - contextStartedAt,
            "ms"
        );

        let query = {};
        let total = 0;

        let basePoolQuery = { status: "approved" };
        if (category) {
            basePoolQuery.category = { $regex: `^${escapeRegex(category)}$`, $options: "i" };
        }

        // ============================================================================
        // 🛡️ APPLY SMART BLOCK FILTERS
        // ============================================================================
        const blockFilters = [];

        if (!targetAuthor && blockedUserIds.length > 0) {
            blockFilters.push({
                authorUserId: { $nin: blockedUserIds },
                authorId: { $nin: blockedUserIds.map(id => id.toString()) }
            });
        }

        if (!clanIdParam && blockedClanTags.length > 0) {
            blockFilters.push({ clanId: { $nin: blockedClanTags } });
        }

        if (blockFilters.length > 0) {
            basePoolQuery.$and = blockFilters;
            query.$and = [...blockFilters];
        }

        // 🌟 TELEMETRY: IN-MEMORY CANDIDATE TRACKING WITH WEIGHTS
        const candidateMap = new Map();
        const exploreCandidateIdSet = new Set();
        let exploreOnlyCandidateIds = [];
        let exploreSourceLens = { new: 0, mid: 0, old: 0 }; // Track lengths for diagnostics safely

        if (
            isPersonalizedFeedRequest
            && requestedFeedSessionId
        ) {
            const sessionNow = new Date();

            const existingSession = await FeedSession.findOne({
                sessionId: requestedFeedSessionId,
                viewerKey: feedViewerKey,
                scopeKey: feedScopeKey,
                algorithmVersion: FEED_ALGORITHM_VERSION,
                expiresAt: { $gt: sessionNow },
                maxExpiresAt: { $gt: sessionNow }
            })
                .select(
                    "sessionId scopeKey entries highestServedOffset expiresAt maxExpiresAt"
                )
                .lean();

            if (!existingSession) {
                return NextResponse.json(
                    {
                        code: "FEED_SESSION_EXPIRED",
                        message:
                            "This feed session expired. Refreshing creates a new feed."
                    },
                    { status: 410 }
                );
            }

            const entries = Array.isArray(
                existingSession.entries
            )
                ? existingSession.entries
                : [];

            const safeCursor = Math.min(
                requestedCursor,
                entries.length
            );

            const sessionPageEntries = entries.slice(
                safeCursor,
                safeCursor + limit
            );

            sessionPageRankedRows =
                sessionPageEntries.map(entry => ({
                    _id: entry.postId
                }));

            sessionPageEntries.forEach(entry => {
                const postId =
                    entry.postId?.toString?.();

                if (!postId) {
                    return;
                }

                candidateMap.set(postId, {
                    _id: postId,
                    sources: Array.isArray(entry.sources)
                        ? entry.sources
                        : []
                });
            });

            responseFeedSessionId =
                existingSession.sessionId;

            responseNextCursor =
                safeCursor +
                sessionPageEntries.length;

            responseHasMore =
                responseNextCursor <
                entries.length;

            responseFeedSessionExpiresAt =
                getExtendedSessionExpiry(
                    existingSession
                );

            responseFeedScopeKey =
                existingSession.scopeKey ||
                feedScopeKey;

            total = entries.length;

            await FeedSession.updateOne(
                {
                    _id: existingSession._id,
                    expiresAt: { $gt: sessionNow },
                    maxExpiresAt: { $gt: sessionNow }
                },
                {
                    $set: {
                        expiresAt:
                            responseFeedSessionExpiresAt,
                        lastAccessedAt: sessionNow
                    },
                    $max: {
                        highestServedOffset:
                            responseNextCursor
                    }
                }
            );
        }

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
        if (sessionPageRankedRows) {
            // The ordered snapshot already contains this page's post IDs.
            // Skip all candidate pooling and reranking for continuation pages.
        } else if (targetAuthor) {
            // Public author profiles show approved posts only.
            // The authenticated owner sees approved, pending,
            // pending_media, rejected, and any legacy status-less posts.
            if (!isOwnAuthorFeed) {
                query.status = "approved";
            }

            const authorOrConditions = [];
            if (mongoose.Types.ObjectId.isValid(targetAuthor)) {
                authorOrConditions.push({ authorUserId: new mongoose.Types.ObjectId(targetAuthor) });
                authorOrConditions.push({ authorId: targetAuthor });
            } else {
                authorOrConditions.push({ authorId: targetAuthor });
            }

            if (query.$and) {
                query.$and.push({ $or: authorOrConditions });
            } else {
                query.$or = authorOrConditions;
            }

            if (category) query.category = { $regex: `^${escapeRegex(category)}$`, $options: "i" };

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
            if (category) query.category = { $regex: `^${escapeRegex(category)}$`, $options: "i" };
            total = await Post.countDocuments(query);

        } else if (isFollowingFeedRequest) {
            // FOLLOWING FEED
            // The supplied backend exposes followed clans and clans the viewer
            // belongs to. Restrict the expensive ranking pipeline to those posts,
            // then save the resulting order as a normal scoped feed session.
            const followingPoolStartedAt = Date.now();

            const followingPool = activeClanTags.length > 0
                ? await Post.find({
                    ...basePoolQuery,
                    clanId: { $in: activeClanTags }
                })
                    .sort({
                        resurrectedAt: -1,
                        createdAt: -1
                    })
                    .limit(FEED_SESSION_SNAPSHOT_SIZE)
                    .select("_id clanId")
                    .lean()
                : [];

            followingPool.forEach(post => {
                addCandidate(
                    post._id,
                    "clan",
                    post.clanId?.toString() ||
                    "following",
                    30
                );
            });

            const followingIds = followingPool
                .map(post => post._id)
                .filter(Boolean);

            const followingIdFilter = {
                _id: { $in: followingIds }
            };

            if (query.$and) {
                query.$and.push(followingIdFilter);
            } else {
                query = followingIdFilter;
            }

            total = followingIds.length;

            console.log(
                "Following feed candidate pooling:",
                Date.now() - followingPoolStartedAt,
                "ms"
            );

        } else {
            // 🌐 GLOBAL FEED: PARALLEL CANDIDATE POOLING
            const poolingStartedAt = Date.now();

            const poolBudget = Math.min(Math.max(limit * 20, 300), 500);

            const POOL_CONFIG = {
                freshPool: Math.floor(poolBudget * dynamicWeights.fresh),
                authorPool: Math.floor(poolBudget * dynamicWeights.author),
                clanPool: Math.floor(poolBudget * dynamicWeights.clan),
                interestPool: Math.floor(poolBudget * dynamicWeights.interest),
                trendingPool: Math.floor(poolBudget * dynamicWeights.trending),
                explorePool: Math.floor(poolBudget * dynamicWeights.explore)
            };

            // ⚡️ 3-Bucket Explore Size Calculations (40% / 30% / 30%)
            const exploreNewSize = Math.ceil(POOL_CONFIG.explorePool * 0.40);
            const exploreMidSize = Math.ceil(POOL_CONFIG.explorePool * 0.30);
            const exploreOldSize = Math.max(0, POOL_CONFIG.explorePool - exploreNewSize - exploreMidSize);

            const topAuthors = Object.entries(safeAuthorAffinity)
                .filter(([, score]) => score >= 10)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 15)
                .map(([id]) => id);

            const interestRegexes = userInterests.map(i => new RegExp(`^${escapeRegex(i)}$`, "i"));

            const [
                freshPool,
                authorPool,
                clanPool,
                trendingPool,
                interestPool,
                exploreNewSource,
                exploreMidSource,
                exploreOldSource
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
                        clanId: { $in: activeClanTags }
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
                                    { $gte: [{ $ifNull: ["$likesCount", "$likeCount", 0] }, 50] },
                                    { $gte: [{ $ifNull: ["$commentsCount", 0] }, 20] },
                                    { $gte: [{ $ifNull: ["$hypePoints", "$hypeCount", 0] }, 100] }
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

                // ⚡️ Bucket 1: Newest Explore (2-5 Days)
                Post.find({
                    ...basePoolQuery,
                    createdAt: { $gte: fiveDaysAgo, $lt: fortyEightHoursAgo }
                })
                    .sort({ createdAt: -1 })
                    .limit(Math.min(exploreNewSize * 3, 200))
                    .select("_id")
                    .lean(),

                // ⚡️ Bucket 2: Middle Explore (5-9 Days)
                Post.find({
                    ...basePoolQuery,
                    createdAt: { $gte: nineDaysAgo, $lt: fiveDaysAgo }
                })
                    .sort({ createdAt: -1 })
                    .limit(Math.min(exploreMidSize * 3, 150))
                    .select("_id")
                    .lean(),

                // ⚡️ Bucket 3: Oldest Explore (9-14 Days)
                Post.find({
                    ...basePoolQuery,
                    createdAt: { $gte: exploreCutoff, $lt: nineDaysAgo }
                })
                    .sort({ createdAt: -1 })
                    .limit(Math.min(exploreOldSize * 3, 150))
                    .select("_id")
                    .lean()
            ]);

            console.log("Feed candidate pooling:", Date.now() - poolingStartedAt, "ms");

            // Store pool lengths for diagnostics
            exploreSourceLens.new = exploreNewSource.length;
            exploreSourceLens.mid = exploreMidSource.length;
            exploreSourceLens.old = exploreOldSource.length;

            // ⚡️ Javascript-side Seeded Shuffle per Hour
            const feedWindow = Math.floor(Date.now() / (60 * 60 * 1000));
            const exploreSeed = hashString(`${deviceId || viewerId || userCountry}-${feedWindow}`);

            // Shuffle each bucket independently using offset seeds to prevent correlation
            const exploreNewPool = seededShuffle(exploreNewSource, exploreSeed).slice(0, exploreNewSize);
            const exploreMidPool = seededShuffle(exploreMidSource, exploreSeed + 1).slice(0, exploreMidSize);
            const exploreOldPool = seededShuffle(exploreOldSource, exploreSeed + 2).slice(0, exploreOldSize);

            // Merge and do one final shuffle so they aren't chunked together in the feed
            const explorePool = seededShuffle(
                [...exploreNewPool, ...exploreMidPool, ...exploreOldPool],
                exploreSeed + 3
            );

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

            // Track specific bucket metrics
            exploreNewPool.forEach(p => {
                const id = p._id.toString();
                exploreCandidateIdSet.add(id);
                addCandidate(p._id, "explore", "2_5_days", 1);
            });

            exploreMidPool.forEach(p => {
                const id = p._id.toString();
                exploreCandidateIdSet.add(id);
                addCandidate(p._id, "explore", "5_9_days", 1);
            });

            exploreOldPool.forEach(p => {
                const id = p._id.toString();
                exploreCandidateIdSet.add(id);
                addCandidate(p._id, "explore", "9_14_days", 1);
            });

            const mergedIds = [
                ...freshPool, ...authorPool, ...clanPool, ...trendingPool, ...interestPool, ...explorePool
            ].map(p => p._id.toString());

            const uniqueIdStrings = [...new Set(mergedIds)];

            // Only discovery-only posts receive explore decay/bonus and consume explore quota.
            // Stronger sources such as clan, author, interest, or trending take precedence.
            exploreOnlyCandidateIds = [...exploreCandidateIdSet].filter(id =>
                Boolean(getExploreBucket(id, candidateMap))
            );

            const uniqueCandidateIds = uniqueIdStrings
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));

            // Sync the gathered unique IDs to the query, preserving block rules
            if (query.$and) {
                query.$and.push({ _id: { $in: uniqueCandidateIds } });
            } else {
                query = { _id: { $in: uniqueCandidateIds } };
            }

            total = uniqueCandidateIds.length;
        }


        // ============================================================================
        // ⚡️ LIGHTWEIGHT AGGREGATION & SCORING PIPELINE
        // ============================================================================
        let posts;

        if (sessionPageRankedRows) {
            const fullFetchStartedAt = Date.now();

            posts = await fetchFullPostsInOrder(
                sessionPageRankedRows,
                deviceId
            );

            console.log(
                "Feed session page fetch:",
                Date.now() - fullFetchStartedAt,
                "ms"
            );
        } else if (targetAuthor) {
            const rankingStartedAt = Date.now();

            const rankedPageRows = await Post.aggregate([
                { $match: query },
                {
                    $project: {
                        createdAt: 1,
                        resurrectedAt: 1,
                        boostedUntil: 1
                    }
                },
                {
                    $addFields: {
                        effectiveDate: {
                            $max: [
                                "$createdAt",
                                { $ifNull: ["$resurrectedAt", "$createdAt"] }
                            ]
                        },
                        isActiveBoost: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: ["$boostedUntil", null] },
                                        { $gt: ["$boostedUntil", now] }
                                    ]
                                },
                                1,
                                0
                            ]
                        }
                    }
                },
                {
                    $sort: {
                        isActiveBoost: -1,
                        effectiveDate: -1
                    }
                },
                { $skip: skip },
                { $limit: limit },
                { $project: { _id: 1 } }
            ]);

            console.log(
                "Feed author ranking:",
                Date.now() - rankingStartedAt,
                "ms"
            );

            const fullFetchStartedAt = Date.now();
            posts = await fetchFullPostsInOrder(rankedPageRows, deviceId);

            console.log(
                "Feed final post fetch:",
                Date.now() - fullFetchStartedAt,
                "ms"
            );
        } else {
            const CONFIG = {
                likeWeight: 2.0,
                commentWeight: 4.0,
                hypeBaseWeight: 10.0,
                hypeDecayRate: 0.15,

                freshnessBoost: 20,
                freshnessWindow: 3,

                // Slow source-specific decay + small bonus + guaranteed explore quota.
                normalHalfLifeHours: 24,
                clanHalfLifeHours: 72,
                exploreHalfLifeHours: 120,

                normalGravityPower: 1.15,
                clanGravityPower: 1.0,
                exploreGravityPower: 1.0,

                exploreBonus: 2,

                staticPrefBonus: 3,
                staticLocalBonus: 4,
                clanBonus: 20,
                affinityMultiplier: 1.0,

                tierFollowerMultiplier: 1.5,
                postBoostMultiplier: 3.0,
                boostIgnitionScore: 25,
                trendingThreshold: TRENDING_THRESHOLD
            };

            const lightweightPipeline = [
                { $match: query },

                // Carry only ranking fields through the expensive scoring stages.
                {
                    $project: {
                        createdAt: 1,
                        resurrectedAt: 1,
                        boostedUntil: 1,

                        authorUserId: 1,
                        authorId: 1,
                        clanId: 1,
                        country: 1,
                        category: 1,
                        interests: 1,

                        likesCountForRanking: {
                            $ifNull: ["$likesCount", "$likeCount", 0]
                        },
                        commentsCountForRanking: {
                            $ifNull: ["$commentsCount", 0]
                        },
                        hypePointsCountForRanking: {
                            $ifNull: ["$hypePoints", "$hypeCount", 0]
                        }
                    }
                },

                {
                    $addFields: {
                        effectiveDate: {
                            $max: [
                                "$createdAt",
                                { $ifNull: ["$resurrectedAt", "$createdAt"] }
                            ]
                        },
                        isExploreCandidate: {
                            $in: [
                                { $toString: "$_id" },
                                exploreOnlyCandidateIds
                            ]
                        }
                    }
                },

                {
                    $addFields: {
                        ageInHours: {
                            $max: [
                                0.5,
                                {
                                    $divide: [
                                        { $subtract: [now, "$effectiveDate"] },
                                        3600000
                                    ]
                                }
                            ]
                        },
                        isActiveBoost: {
                            $cond: [
                                {
                                    $and: [
                                        { $ne: ["$boostedUntil", null] },
                                        { $gt: ["$boostedUntil", now] }
                                    ]
                                },
                                true,
                                false
                            ]
                        },
                        isViewerConnectedToClan: {
                            $in: ["$clanId", activeClanTags]
                        }
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
                                            vars: {
                                                cleanTag: {
                                                    $toLower: {
                                                        $trim: {
                                                            input: "$$rawTag"
                                                        }
                                                    }
                                                }
                                            },
                                            in: {
                                                $let: {
                                                    vars: {
                                                        dynamicScore: {
                                                            $ifNull: [
                                                                {
                                                                    $getField: {
                                                                        field: "$$cleanTag",
                                                                        input: {
                                                                            $literal: safeAffinity
                                                                        }
                                                                    }
                                                                },
                                                                0
                                                            ]
                                                        },
                                                        isStaticMatch: {
                                                            $in: [
                                                                "$$cleanTag",
                                                                userInterests
                                                            ]
                                                        }
                                                    },
                                                    in: {
                                                        $cond: [
                                                            {
                                                                $gt: [
                                                                    "$$dynamicScore",
                                                                    0
                                                                ]
                                                            },
                                                            "$$dynamicScore",
                                                            {
                                                                $cond: [
                                                                    "$$isStaticMatch",
                                                                    CONFIG.staticPrefBonus,
                                                                    0
                                                                ]
                                                            }
                                                        ]
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        },

                        authorAffinityScore: {
                            $ifNull: [
                                {
                                    $getField: {
                                        field: {
                                            $toString: {
                                                $ifNull: [
                                                    "$authorUserId",
                                                    "$authorId"
                                                ]
                                            }
                                        },
                                        input: {
                                            $literal: safeAuthorAffinity
                                        }
                                    }
                                },
                                0
                            ]
                        },

                        countryAffinityScore: {
                            $let: {
                                vars: {
                                    dynCountry: {
                                        $ifNull: [
                                            {
                                                $getField: {
                                                    field: {
                                                        $ifNull: [
                                                            "$country",
                                                            "Global"
                                                        ]
                                                    },
                                                    input: {
                                                        $literal: safeCountryAffinity
                                                    }
                                                }
                                            },
                                            0
                                        ]
                                    },
                                    isStaticCountry: {
                                        $eq: ["$country", userCountry]
                                    }
                                },
                                in: {
                                    $cond: [
                                        { $gt: ["$$dynCountry", 0] },
                                        "$$dynCountry",
                                        {
                                            $cond: [
                                                "$$isStaticCountry",
                                                CONFIG.staticLocalBonus,
                                                0
                                            ]
                                        }
                                    ]
                                }
                            }
                        },

                        decayedHypeWeight: {
                            $divide: [
                                CONFIG.hypeBaseWeight,
                                {
                                    $max: [
                                        1,
                                        {
                                            $multiply: [
                                                "$ageInHours",
                                                CONFIG.hypeDecayRate
                                            ]
                                        }
                                    ]
                                }
                            ]
                        },

                        // Verified-tier and partner-clan bonuses remain disabled.
                        clanTierBonus: { $literal: 0 },
                        partnerClanBonusVal: { $literal: 0 }
                    }
                },

                {
                    $addFields: {
                        decayHalfLifeHours: {
                            $switch: {
                                branches: [
                                    {
                                        case: "$isExploreCandidate",
                                        then: CONFIG.exploreHalfLifeHours
                                    },
                                    {
                                        case: "$isViewerConnectedToClan",
                                        then: CONFIG.clanHalfLifeHours
                                    }
                                ],
                                default: CONFIG.normalHalfLifeHours
                            }
                        },

                        gravityPowerForPost: {
                            $switch: {
                                branches: [
                                    {
                                        case: "$isExploreCandidate",
                                        then: CONFIG.exploreGravityPower
                                    },
                                    {
                                        case: "$isViewerConnectedToClan",
                                        then: CONFIG.clanGravityPower
                                    }
                                ],
                                default: CONFIG.normalGravityPower
                            }
                        }
                    }
                },

                {
                    $addFields: {
                        engagementScore: {
                            $multiply: [
                                {
                                    $add: [
                                        {
                                            $cond: [
                                                "$isActiveBoost",
                                                CONFIG.boostIgnitionScore,
                                                0
                                            ]
                                        },
                                        {
                                            $multiply: [
                                                {
                                                    $ifNull: [
                                                        "$likesCountForRanking",
                                                        0
                                                    ]
                                                },
                                                CONFIG.likeWeight
                                            ]
                                        },
                                        {
                                            $multiply: [
                                                {
                                                    $ifNull: [
                                                        "$commentsCountForRanking",
                                                        0
                                                    ]
                                                },
                                                CONFIG.commentWeight
                                            ]
                                        },
                                        {
                                            $multiply: [
                                                {
                                                    $sqrt: {
                                                        $ifNull: [
                                                            "$hypePointsCountForRanking",
                                                            0
                                                        ]
                                                    }
                                                },
                                                "$decayedHypeWeight"
                                            ]
                                        }
                                    ]
                                },
                                {
                                    $cond: [
                                        "$isActiveBoost",
                                        CONFIG.postBoostMultiplier,
                                        1
                                    ]
                                }
                            ]
                        },

                        relevanceBonus: {
                            $add: [
                                {
                                    $multiply: [
                                        "$tagAffinityTotal",
                                        CONFIG.affinityMultiplier
                                    ]
                                },
                                {
                                    $multiply: [
                                        "$authorAffinityScore",
                                        CONFIG.affinityMultiplier
                                    ]
                                },
                                {
                                    $multiply: [
                                        "$countryAffinityScore",
                                        CONFIG.affinityMultiplier
                                    ]
                                },
                                {
                                    $cond: [
                                        "$isViewerConnectedToClan",
                                        CONFIG.clanBonus,
                                        0
                                    ]
                                },
                                {
                                    $cond: [
                                        "$isViewerConnectedToClan",
                                        {
                                            $multiply: [
                                                "$clanTierBonus",
                                                CONFIG.tierFollowerMultiplier
                                            ]
                                        },
                                        "$clanTierBonus"
                                    ]
                                },
                                "$partnerClanBonusVal"
                            ]
                        },

                        noveltyScore: {
                            $cond: [
                                {
                                    $lt: [
                                        "$ageInHours",
                                        CONFIG.freshnessWindow
                                    ]
                                },
                                CONFIG.freshnessBoost,
                                0
                            ]
                        }
                    }
                },

                {
                    $addFields: {
                        decayDenominator: {
                            $pow: [
                                {
                                    $add: [
                                        1,
                                        {
                                            $divide: [
                                                "$ageInHours",
                                                "$decayHalfLifeHours"
                                            ]
                                        }
                                    ]
                                },
                                "$gravityPowerForPost"
                            ]
                        }
                    }
                },

                {
                    $addFields: {
                        finalScore: {
                            $add: [
                                {
                                    $divide: [
                                        {
                                            $add: [
                                                "$engagementScore",
                                                "$relevanceBonus",
                                                "$noveltyScore"
                                            ]
                                        },
                                        "$decayDenominator"
                                    ]
                                },
                                {
                                    $cond: [
                                        "$isExploreCandidate",
                                        CONFIG.exploreBonus,
                                        0
                                    ]
                                }
                            ]
                        }
                    }
                },

                {
                    $sort: {
                        finalScore: -1,
                        effectiveDate: -1
                    }
                }
            ];

            const rankingStartedAt = Date.now();
            let rankedPosts = await Post.aggregate(lightweightPipeline);

            console.log(
                "Feed lightweight aggregation ranking:",
                Date.now() - rankingStartedAt,
                "ms"
            );

            // Diversity still runs before the source-aware feed composition.
            if (rankedPosts.length > 0) {
                rankedPosts = typeof applyDiversityPass === "function"
                    ? applyDiversityPass(rankedPosts, 2)
                    : rankedPosts;
            }

            const mixedPosts = buildBucketAwareExploreFeed(
                rankedPosts,
                candidateMap,
                limit,
                0.30
            );

            let pageRankedRows;

            if (isPersonalizedFeedRequest) {
                const snapshotRows = mixedPosts.slice(
                    0,
                    FEED_SESSION_SNAPSHOT_SIZE
                );

                const sessionId =
                    createFeedSessionId();

                const sessionNowMs = Date.now();
                const sessionNow =
                    new Date(sessionNowMs);

                const {
                    expiresAt,
                    maxExpiresAt
                } = getSessionExpiryDates(
                    sessionNowMs
                );

                const entries = snapshotRows.map(
                    post => {
                        const postId =
                            post._id.toString();

                        return {
                            postId: post._id,
                            sources:
                                candidateMap.get(postId)
                                    ?.sources || []
                        };
                    }
                );

                await FeedSession.create({
                    sessionId,
                    viewerKey: feedViewerKey,
                    scopeKey: feedScopeKey,
                    deviceId: deviceId || null,
                    viewerId: viewerId || null,
                    algorithmVersion:
                        FEED_ALGORITHM_VERSION,
                    entries,
                    highestServedOffset:
                        Math.min(
                            limit,
                            entries.length
                        ),
                    createdAt: sessionNow,
                    lastAccessedAt: sessionNow,
                    expiresAt,
                    maxExpiresAt
                });

                // A manual refresh creates a new snapshot.
                // Remove older snapshots for the same viewer so repeated
                // refreshes cannot accumulate large session documents.
                if (deviceId || viewerId) {
                    await FeedSession.deleteMany({
                        viewerKey: feedViewerKey,
                        scopeKey: feedScopeKey,
                        algorithmVersion:
                            FEED_ALGORITHM_VERSION,
                        sessionId: { $ne: sessionId }
                    });
                }

                responseFeedSessionId =
                    sessionId;

                responseNextCursor =
                    Math.min(
                        limit,
                        entries.length
                    );

                responseHasMore =
                    responseNextCursor <
                    entries.length;

                responseFeedSessionExpiresAt =
                    expiresAt;

                responseFeedScopeKey =
                    feedScopeKey;

                total = entries.length;
                pageRankedRows =
                    snapshotRows.slice(0, limit);
            } else {
                pageRankedRows =
                    mixedPosts.slice(
                        skip,
                        skip + limit
                    );
            }

            const explorePostsOnPage = pageRankedRows.filter(post =>
                Boolean(getExploreBucket(post._id.toString(), candidateMap))
            ).length;

            const exploreBucketCounts = {
                new: 0,
                mid: 0,
                old: 0
            };

            for (const post of pageRankedRows) {
                const bucket = getExploreBucket(
                    post._id.toString(),
                    candidateMap
                );

                if (bucket) {
                    exploreBucketCounts[bucket]++;
                }
            }

            console.log("Feed candidate diagnostics:", {
                page,
                pageSize: pageRankedRows.length,
                explorePostsOnPage,
                explorePercentage: pageRankedRows.length
                    ? Math.round(
                        (explorePostsOnPage / pageRankedRows.length) * 100
                    )
                    : 0,
                exploreBucketsOnPage: exploreBucketCounts,
                totalUniqueCandidates: total,
                totalExploreSourceCandidates: exploreCandidateIdSet.size,
                totalExploreQuotaCandidates: exploreOnlyCandidateIds.length,
                exploreSourceSizes: exploreSourceLens
            });

            const fullFetchStartedAt = Date.now();
            posts = await fetchFullPostsInOrder(pageRankedRows, deviceId);

            console.log(
                "Feed final post fetch:",
                Date.now() - fullFetchStartedAt,
                "ms"
            );
        }

        // ============================================================================
        // 📦 COMPACT POPULATION
        // ============================================================================
        const populationStartedAt = Date.now();

        let userMap = {};
        let clanMap = {};

        try {
            const uniqueAuthorIds = [
                ...new Set(
                    posts
                        .map(post => (post.authorUserId || post.authorId)?.toString())
                        .filter(Boolean)
                )
            ];

            const uniqueClanTags = [
                ...new Set(
                    posts
                        .map(post => post.clanId?.toString())
                        .filter(Boolean)
                )
            ];

            const authorObjectIds = uniqueAuthorIds
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));

            const clanObjectIds = uniqueClanTags
                .filter(id => mongoose.Types.ObjectId.isValid(id))
                .map(id => new mongoose.Types.ObjectId(id));

            const [users, clans] = await Promise.all([
                authorObjectIds.length > 0
                    ? MobileUser.aggregate([
                        {
                            $match: {
                                _id: { $in: authorObjectIds }
                            }
                        },
                        {
                            $project: {
                                username: 1,
                                "profilePic.url": 1,
                                lastStreak: 1,
                                previousRank: 1,
                                peakLevel: 1,
                                currentRankLevel: 1,
                                aura: 1,
                                equippedTitle: 1,
                                nameLockedUntil: 1,

                                // Feed cards only render equipped cosmetics.
                                inventory: {
                                    $filter: {
                                        input: {
                                            $concatArrays: [
                                                {
                                                    $cond: [
                                                        { $isArray: "$inventory" },
                                                        "$inventory",
                                                        []
                                                    ]
                                                },
                                                {
                                                    $cond: [
                                                        { $isArray: "$specialInventory" },
                                                        "$specialInventory",
                                                        []
                                                    ]
                                                }
                                            ]
                                        },
                                        as: "item",
                                        cond: {
                                            $eq: ["$$item.isEquipped", true]
                                        }
                                    }
                                }
                            }
                        }
                    ])
                    : Promise.resolve([]),

                uniqueClanTags.length > 0
                    ? Clan.aggregate([
                        {
                            $match: {
                                $or: [
                                    { tag: { $in: uniqueClanTags } },
                                    { _id: { $in: clanObjectIds } }
                                ]
                            }
                        },
                        {
                            $project: {
                                tag: 1,
                                name: 1,
                                displayName: 1,
                                rank: 1,
                                totalPoints: 1,
                                followerCount: 1,
                                isInWar: 1,
                                verifiedUntil: 1,
                                verifiedClan: 1,
                                primeLevel: 1,
                                nameLockedUntil: 1,
                                "activeCustomizations.verifiedTier": 1,
                                "activeCustomizations.verifiedBadgeXml": 1,
                                activeGlowColor: 1,

                                // Clan headers also use equipped cosmetics only.
                                specialInventory: {
                                    $filter: {
                                        input: {
                                            $cond: [
                                                { $isArray: "$specialInventory" },
                                                "$specialInventory",
                                                []
                                            ]
                                        },
                                        as: "item",
                                        cond: {
                                            $eq: ["$$item.isEquipped", true]
                                        }
                                    }
                                }
                            }
                        }
                    ])
                    : Promise.resolve([])
            ]);

            const getEquippedItemCategory = (item) =>
                String(
                    item?.category
                    || item?.asset?.category
                    || ""
                ).trim().toUpperCase();

            const compactEquippedItem = (item) => {
                if (!item || typeof item !== "object") {
                    return null;
                }

                const asset =
                    item.asset
                        && typeof item.asset === "object"
                        ? item.asset
                        : {};

                const visualConfig =
                    item.visualConfig
                    || asset.visualConfig
                    || item.displayConfig
                    || asset.displayConfig
                    || null;

                const displayConfig =
                    item.displayConfig
                    || asset.displayConfig
                    || item.visualConfig
                    || asset.visualConfig
                    || null;

                return {
                    _id:
                        item._id?.toString?.()
                        || item._id
                        || asset._id?.toString?.()
                        || asset._id
                        || null,
                    itemId:
                        item.itemId
                        || item.assetId
                        || item.shopAssetId
                        || asset.itemId
                        || asset.assetId
                        || asset.shopAssetId
                        || null,
                    name:
                        item.name
                        || asset.name
                        || null,
                    category:
                        item.category
                        || asset.category
                        || null,
                    rarity:
                        item.rarity
                        || asset.rarity
                        || null,
                    url:
                        item.url
                        || item.imageUrl
                        || item.assetUrl
                        || item.mediaUrl
                        || asset.url
                        || asset.imageUrl
                        || asset.assetUrl
                        || asset.mediaUrl
                        || null,
                    imageUrl:
                        item.imageUrl
                        || asset.imageUrl
                        || null,
                    assetUrl:
                        item.assetUrl
                        || asset.assetUrl
                        || null,
                    mediaUrl:
                        item.mediaUrl
                        || asset.mediaUrl
                        || null,
                    lottieUrl:
                        item.lottieUrl
                        || asset.lottieUrl
                        || null,
                    svgXml:
                        item.svgXml
                        || asset.svgXml
                        || null,
                    svgCode:
                        item.svgCode
                        || asset.svgCode
                        || visualConfig?.svgCode
                        || displayConfig?.svgCode
                        || null,
                    visualConfig,
                    visualData:
                        item.visualData
                        || asset.visualData
                        || null,
                    displayConfig,
                    isAnimated:
                        Boolean(
                            item.isAnimated
                            || asset.isAnimated
                            || visualConfig?.isAnimated
                            || displayConfig?.isAnimated
                            || item.visualData?.isAnimated
                            || asset.visualData?.isAnimated
                        ),
                    isEquipped: true
                };
            };

            users.forEach(user => {
                const userId = user._id.toString();
                const rankInfo = typeof resolveUserRankServer === "function"
                    ? resolveUserRankServer(user.currentRankLevel || 1)
                    : { rankName: "Rookie" };

                const auraInfo = typeof getAuraVisualsServer === "function"
                    ? getAuraVisualsServer(user.previousRank || 0)
                    : null;

                const equippedInventory = Array.isArray(user.inventory)
                    ? user.inventory
                        .map(compactEquippedItem)
                        .filter(Boolean)
                    : [];

                const findEquippedCategory = (...categories) => {
                    const allowedCategories = new Set(
                        categories.map(category =>
                            String(category).toUpperCase()
                        )
                    );

                    return equippedInventory.find(item =>
                        allowedCategories.has(
                            getEquippedItemCategory(item)
                        )
                    ) || null;
                };

                const equippedGlow =
                    findEquippedCategory(
                        "GLOW",
                        "NAME_GLOW"
                    );

                const equippedBadges =
                    equippedInventory
                        .filter(item =>
                            getEquippedItemCategory(item)
                            === "BADGE"
                        )
                        .slice(0, 3);

                const equippedWatermark =
                    findEquippedCategory("WATERMARK");

                const equippedAvatarVfx =
                    findEquippedCategory("AVATAR_VFX");

                const equippedAvatar =
                    findEquippedCategory("AVATAR");

                userMap[userId] = {
                    _id: userId,
                    userId,
                    name: user.username,
                    username: user.username,
                    image: user.profilePic?.url || null,
                    streak: user.lastStreak || 0,
                    rank: user.previousRank || 0,
                    peakLevel: user.peakLevel || 0,

                    // Feed components consume dedicated cosmetic fields.
                    // Keep the legacy array empty so no complete inventory
                    // or unrelated equipped consumables enter every post.
                    inventory: [],

                    rankLevel: user.currentRankLevel || 1,
                    aura: user.aura || 0,
                    displayRank: rankInfo.rankName,
                    auraVisuals: auraInfo,
                    equippedGlow,
                    equippedBadges,
                    equippedWatermark,
                    equippedAvatarVfx,
                    avatarVfx: equippedAvatarVfx,
                    equippedAvatar,
                    equippedTitle: user.equippedTitle || null,
                    nameLockedUntil: user.nameLockedUntil || null
                };
            });


            clans.forEach(clan => {
                const compactSpecialInventory =
                    Array.isArray(clan.specialInventory)
                        ? clan.specialInventory
                            .map(compactEquippedItem)
                            .filter(Boolean)
                        : [];

                const enrichedClan = {
                    ...clan,
                    _id: clan._id.toString(),
                    specialInventory:
                        compactSpecialInventory,
                    displayRank: typeof resolveClanDisplayRank === "function"
                        ? resolveClanDisplayRank(clan.totalPoints || 0)
                        : "Rank 1"
                };

                if (clan.tag) {
                    clanMap[clan.tag] = enrichedClan;
                }

                clanMap[clan._id.toString()] = enrichedClan;
            });
        } catch (populationError) {
            console.error("Bulk Population Error:", populationError);
        }

        console.log(
            "Feed population:",
            Date.now() - populationStartedAt,
            "ms"
        );

        // ============================================================================
        // 📦 EXPLICIT FEED-CARD SERIALIZATION
        // ============================================================================
        const serializationStartedAt = Date.now();

        const serializedPosts = posts.map(post => {
            const postId = post._id.toString();
            const authorKey = (post.authorUserId || post.authorId)?.toString();
            const clanKey = post.clanId?.toString();

            const normalizedMessage = typeof normalizePostContent === "function"
                ? normalizePostContent(post.message)
                : post.message;

            const feedMessage = (post.message || "")
                .replace(
                    /s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs,
                    "$1$2$3$4$5$6$8$10"
                )
                .replace(/\n+/g, " ")
                .trim();

            const likesCount = post.likesCount ?? 0;
            const commentsCount = post.commentsCount ?? 0;
            const discussionCount = post.discussionCount ?? 0;
            const hypePoints = post.hypePoints ?? 0;
            const hypeCount = post.hypeCount ?? 0;
            const viewsCount = post.viewsCount ?? 0;
            const sharesCount = post.sharesCount ?? 0;

            const viewerPollVote = post.viewerPollVote || null;
            const hasVoted = Boolean(viewerPollVote);
            const userVotedOptions = viewerPollVote?.selectedOptions || [];

            const isTrending = hypePoints >= TRENDING_THRESHOLD;
            const isBoosted = Boolean(
                post.boostedUntil
                && new Date(post.boostedUntil).getTime() > now.getTime()
            );
            const isResurrected = Boolean(
                post.resurrectedAt
                && new Date(post.resurrectedAt) > fortyEightHoursAgo
            );
            const isFollowingClan = Boolean(
                clanKey
                && followedClanTags.includes(clanKey)
            );

            const candidateSources =
                candidateMap.get(postId)?.sources || [];

            const serializedPoll = post.poll
                ? {
                    ...post.poll,
                    hasVoted,
                    userVotedOptions
                }
                : post.poll;

            return {
                _id: postId,
                slug: post.slug || null,

                title: post.title,
                message: normalizedMessage,
                feedExcerpt: feedMessage.length > 150
                    ? `${feedMessage.slice(0, 150)}...`
                    : feedMessage,

                createdAt: post.createdAt,
                updatedAt: post.updatedAt,
                resurrectedAt: post.resurrectedAt || null,
                boostedUntil: post.boostedUntil || null,

                authorUserId: post.authorUserId?.toString?.()
                    || post.authorUserId
                    || null,
                authorId: post.authorId || null,
                authorName: post.authorName || "Anonymous",
                clanId: clanKey || null,

                category: post.category || "News",
                interests: Array.isArray(post.interests)
                    ? post.interests
                    : [],
                country: post.country || "Global",

                status: post.status || "approved",
                rejectionReason:
                    isOwnAuthorFeed
                        && post.status === "rejected"
                        ? post.rejectionReason || ""
                        : null,

                mediaUrl: post.mediaUrl || null,
                mediaType: post.mediaType || null,
                media: Array.isArray(post.media)
                    ? post.media
                    : [],

                poll: serializedPoll,
                hasVoted,
                userVotedOptions,

                likesCount,
                commentsCount,
                discussionCount,

                hypePoints,
                hypeCount,
                hypePointsCount: hypePoints,

                views: viewsCount,
                viewsCount,
                formattedViews: typeof formatViewsServer === "function"
                    ? formatViewsServer(viewsCount)
                    : viewsCount,

                shares: sharesCount,
                sharesCount,
                formattedShares: typeof formatViewsServer === "function"
                    ? formatViewsServer(sharesCount)
                    : sharesCount,

                hasLiked: Boolean(post.hasLiked),
                hasViewed: Boolean(post.hasViewed),

                isTrending,
                isBoosted,
                isResurrected,
                isFollowingClan,

                candidateSources,
                authorData: userMap[authorKey] || null,
                clanData: clanMap[clanKey] || null
            };
        });

        console.log(
            "Feed serialization:",
            Date.now() - serializationStartedAt,
            "ms"
        );

        const responseStartedAt = Date.now();

        const responsePayload = {
            posts: serializedPosts,
            total,
            page: responseFeedSessionId
                ? Math.floor(
                    (
                        Math.max(
                            0,
                            Number(responseNextCursor) -
                            serializedPosts.length
                        )
                    ) / limit
                ) + 1
                : page,
            limit,
            hasMore: responseHasMore !== null
                ? responseHasMore
                : skip + serializedPosts.length < total,
            feedSessionId:
                responseFeedSessionId,
            nextCursor:
                responseNextCursor,
            feedSessionExpiresAt:
                responseFeedSessionExpiresAt,
            feedScopeKey:
                responseFeedScopeKey,
            feedMode: isFollowingFeedRequest
                ? "following"
                : "forYou",
            isOwnAuthorFeed
        };

        const responseText =
            JSON.stringify(responsePayload);

        console.log(
            "Feed response payload:",
            responseText.length,
            "characters"
        );

        const response = new NextResponse(
            responseText,
            {
                status: 200,
                headers: {
                    "Content-Type":
                        "application/json; charset=utf-8",
                    "Cache-Control":
                        "private, no-store, max-age=0",
                    "X-Content-Type-Options":
                        "nosniff"
                }
            }
        );

        console.log(
            "Feed response construction:",
            Date.now() - responseStartedAt,
            "ms"
        );

        console.log(
            "Total feed request:",
            Date.now() - requestStartedAt,
            "ms"
        );

        return response;
    } catch (err) {
        console.error("GET Feed Error:", err)
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

import {
    buildR2UploadPlan,
    normalizeMediaDescriptors,
    rebuildR2UploadPlanForPost
} from "@/app/lib/r2UploadPipeline.server";

// --------------------------------------------------------------------
// POST: Create or resume a post
// --------------------------------------------------------------------
export async function POST(req) {
    await connectDB();

    try {
        const body = await req.json();
        const token = req.cookies.get("token")?.value;

        const {
            title,
            message,
            mediaUrl,
            mediaType,
            media,
            hasPoll,
            pollMultiple,
            pollOptions,
            category,
            useR2,
            mediaPending,
            totalFiles,
            requestId
        } = body;

        const fingerprint =
            req.headers.get("x-user-deviceId") ||
            req.headers.get("x-device-id");

        await logEvent(
            null,
            "POST_REQUEST_RECEIVED",
            "Initial POST request hit server",
            {
                requestId,
                fingerprint,
                totalFiles
            }
        );

        if (
            typeof title !== "string" ||
            !title.trim() ||
            typeof message !== "string" ||
            !message.trim()
        ) {
            return addCorsHeaders(
                NextResponse.json(
                    {
                        message:
                            "Title and message are required."
                    },
                    { status: 400 }
                )
            );
        }

        const requestedTotalFiles = Math.max(
            0,
            Number(totalFiles) || 0
        );

        let mediaDescriptors = [];

        if (mediaPending) {
            try {
                mediaDescriptors =
                    normalizeMediaDescriptors(media || []);
            } catch (error) {
                return addCorsHeaders(
                    NextResponse.json(
                        {
                            message:
                                error?.message ||
                                "Invalid media descriptors."
                        },
                        { status: 400 }
                    )
                );
            }

            if (
                requestedTotalFiles !==
                mediaDescriptors.length
            ) {
                return addCorsHeaders(
                    NextResponse.json(
                        {
                            message:
                                "totalFiles does not match the media descriptor array."
                        },
                        { status: 400 }
                    )
                );
            }

            if (requestedTotalFiles < 1) {
                return addCorsHeaders(
                    NextResponse.json(
                        {
                            message:
                                "mediaPending requires at least one media descriptor."
                        },
                        { status: 400 }
                    )
                );
            }

            if (!useR2) {
                return addCorsHeaders(
                    NextResponse.json(
                        {
                            message:
                                "This app build must use the R2 upload pipeline."
                        },
                        { status: 400 }
                    )
                );
            }
        }

        // ------------------------------------------------------------
        // 1. Resolve country metadata
        // ------------------------------------------------------------
        let country =
            req.headers.get("x-user-country");

        if (!country || country === "Unknown") {
            const forwarded =
                req.headers.get("x-forwarded-for");

            const ip = forwarded
                ? forwarded.split(",")[0].trim()
                : "127.0.0.1";

            const geo = geoip.lookup(ip);
            country = geo?.country || "Global";
        }

        const clanId =
            body.clanId ||
            (
                category?.startsWith("Clan:") ||
                    category?.startsWith("Clan-")
                    ? body.clanId || null
                    : null
            );

        // ------------------------------------------------------------
        // 2. Resolve authentication context
        // ------------------------------------------------------------
        let userDoc = null;
        let isMobile = false;

        if (token) {
            try {
                const verified = verifyToken(token);
                userDoc = await userModel.findById(
                    verified.id
                );
            } catch (_) { }
        }

        if (!userDoc && fingerprint) {
            userDoc = await MobileUser.findOne({
                deviceId: fingerprint
            });

            if (userDoc) {
                isMobile = true;
            }
        }

        if (!userDoc) {
            return addCorsHeaders(
                NextResponse.json(
                    { message: "Unauthorized" },
                    { status: 401 }
                )
            );
        }

        const safeRequestId =
            typeof requestId === "string" &&
                requestId.trim()
                ? requestId.trim()
                : null;

        const resumeExistingSubmission =
            async (existingPost) => {
                await logEvent(
                    existingPost._id,
                    "DUPLICATE_POST_DETECTED",
                    "Returning resumable context for the same logical submission.",
                    { requestId: safeRequestId }
                );

                if (
                    ["approved", "rejected"].includes(
                        existingPost.status
                    )
                ) {
                    return addCorsHeaders(
                        NextResponse.json(
                            {
                                message:
                                    "This submission was already finalized.",
                                post: existingPost,
                                alreadyFinalized: true,
                                signData: []
                            },
                            { status: 200 }
                        )
                    );
                }

                if (
                    Number(
                        existingPost.totalFilesExpected ||
                        0
                    ) > 0
                ) {
                    const resumedPlan =
                        await rebuildR2UploadPlanForPost(
                            existingPost,
                            mediaDescriptors
                        );

                    existingPost.media =
                        resumedPlan.media;
                    existingPost.mediaUrl =
                        resumedPlan.media[0]?.url ??
                        null;
                    existingPost.mediaType =
                        resumedPlan.media[0]?.type ??
                        null;
                    existingPost.totalFilesExpected =
                        resumedPlan.media.length;
                    existingPost.uploadStatus =
                        "pending";
                    existingPost.moderationStatus =
                        "pending";
                    existingPost.status = "pending";
                    await existingPost.save();

                    return addCorsHeaders(
                        NextResponse.json(
                            {
                                message:
                                    "Resuming existing media upload.",
                                post: existingPost,
                                signData:
                                    resumedPlan.signData,
                                resumed: true
                            },
                            { status: 200 }
                        )
                    );
                }

                if (
                    existingPost.moderationStatus ===
                    "processing"
                ) {
                    return addCorsHeaders(
                        NextResponse.json(
                            {
                                message:
                                    "This post is already being processed.",
                                post: existingPost,
                                processing: true,
                                signData: []
                            },
                            { status: 202 }
                        )
                    );
                }

                if (
                    existingPost.moderationStatus ===
                    "failed"
                ) {
                    return addCorsHeaders(
                        NextResponse.json(
                            {
                                message:
                                    "This post was already accepted and is awaiting review.",
                                post: existingPost,
                                processing: false,
                                signData: []
                            },
                            { status: 200 }
                        )
                    );
                }

                const evaluation =
                    await finalizeAndPublishPost(
                        existingPost._id,
                        isMobile,
                        country,
                        fingerprint,
                        false
                    );

                return addCorsHeaders(
                    NextResponse.json(
                        {
                            message:
                                evaluation.message,
                            post: evaluation.post,
                            isFirstPost:
                                evaluation.isFirstPost,
                            auraStats:
                                evaluation.auraStats,
                            resumed: true,
                            signData: []
                        },
                        { status: 200 }
                    )
                );
            };

        // ------------------------------------------------------------
        // 3. Idempotency lookup
        // ------------------------------------------------------------
        if (safeRequestId) {
            const existingPost =
                await Post.findOne({
                    requestId: safeRequestId,
                    authorUserId: userDoc._id
                });

            if (existingPost) {
                return resumeExistingSubmission(
                    existingPost
                );
            }
        }

        // ------------------------------------------------------------
        // 4. Legacy/non-pending media normalization
        // ------------------------------------------------------------
        const primaryMediaUrl =
            !mediaPending
                ? mediaUrl ||
                (
                    Array.isArray(media) &&
                        media.length > 0
                        ? media[0]?.url
                        : null
                )
                : null;

        const primaryMediaType =
            !mediaPending
                ? mediaType ||
                (
                    Array.isArray(media) &&
                        media.length > 0
                        ? media[0]?.type
                        : "image"
                )
                : null;

        const finalLegacyMediaArray =
            !mediaPending &&
                Array.isArray(media)
                ? media
                    .map((item, index) => ({
                        url:
                            typeof item?.url ===
                                "string"
                                ? item.url
                                : null,
                        type:
                            item?.type === "video"
                                ? "video"
                                : "image",
                        order:
                            Number.isFinite(
                                Number(item?.order)
                            )
                                ? Number(item.order)
                                : index,
                        r2Key:
                            typeof item?.r2Key ===
                                "string"
                                ? item.r2Key
                                : null,
                        mimeType:
                            typeof item?.mimeType ===
                                "string"
                                ? item.mimeType
                                : null,
                        extension:
                            typeof item?.extension ===
                                "string"
                                ? item.extension
                                : null,
                        expectedSize:
                            Number.isFinite(
                                Number(
                                    item?.expectedSize
                                )
                            )
                                ? Number(
                                    item.expectedSize
                                )
                                : 0
                    }))
                    .filter((item) => item.url)
                : primaryMediaUrl
                    ? [
                        {
                            url: primaryMediaUrl,
                            type:
                                primaryMediaType ||
                                "image",
                            order: 0
                        }
                    ]
                    : [];

        // ------------------------------------------------------------
        // 5. Generate slug
        // ------------------------------------------------------------
        const newMessage = removeEmptyLines(
            normalizePostContent(message)
        );

        const authorPrefix = String(
            userDoc.username ||
            "author"
        )
            .toLowerCase()
            .replace(/[^a-z0-9]/g, "");

        let cleanedTitle = title
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, "")
            .trim()
            .replace(/\s+/g, "-");

        if (cleanedTitle.length > 80) {
            cleanedTitle = cleanedTitle
                .substring(0, 80)
                .split("-")
                .slice(0, -1)
                .join("-");
        }

        let baseSlug =
            cleanedTitle.length > 0
                ? `${authorPrefix}-${cleanedTitle}`
                : `${authorPrefix}-transmission`;

        let slug = baseSlug;
        let slugAttempt = 0;

        while (
            await Post.exists({ slug })
        ) {
            slugAttempt += 1;

            if (slugAttempt > 20) {
                throw new Error(
                    "Unable to generate a unique post slug."
                );
            }

            const shortHash = Math.random()
                .toString(36)
                .substring(2, 8);

            slug = `${baseSlug}-${shortHash}`;
        }

        const finalStatus = mediaPending
            ? "pending"
            : isMobile
                ? "pending"
                : "approved";

        // ------------------------------------------------------------
        // 6. Create the logical post
        // ------------------------------------------------------------
        let newPost;

        try {
            newPost = await Post.create({
                authorUserId: userDoc._id,
                authorId: fingerprint,
                authorName: userDoc.username,
                title: title.trim(),
                slug,
                message: newMessage,

                // Never store local device URIs.
                mediaUrl: mediaPending
                    ? null
                    : primaryMediaUrl,
                mediaType: mediaPending
                    ? null
                    : primaryMediaType,
                media: mediaPending
                    ? []
                    : finalLegacyMediaArray,

                status: finalStatus,
                uploadStatus: mediaPending
                    ? "pending"
                    : "uploaded",
                moderationStatus: mediaPending
                    ? "pending"
                    : isMobile
                        ? "pending"
                        : "approved",

                requestId: safeRequestId,

                poll: hasPoll
                    ? {
                        pollMultiple:
                            Boolean(pollMultiple),
                        options:
                            Array.isArray(
                                pollOptions
                            ) &&
                                pollOptions.length >= 2
                                ? pollOptions
                                    .map((option) => ({
                                        text:
                                            typeof option ===
                                                "string"
                                                ? option.trim()
                                                : String(
                                                    option?.text ||
                                                    ""
                                                ).trim(),
                                        votes: 0
                                    }))
                                    .filter(
                                        (option) =>
                                            option.text
                                    )
                                : []
                    }
                    : null,

                category,
                clanId,
                country,
                totalFilesExpected:
                    mediaPending
                        ? requestedTotalFiles
                        : finalLegacyMediaArray.length
            });
        } catch (error) {
            const duplicateRequest =
                safeRequestId &&
                error?.code === 11000 &&
                (
                    error?.keyPattern?.requestId ||
                    error?.keyValue?.requestId
                );

            if (duplicateRequest) {
                const existingPost =
                    await Post.findOne({
                        requestId:
                            safeRequestId,
                        authorUserId:
                            userDoc._id
                    });

                if (existingPost) {
                    return resumeExistingSubmission(
                        existingPost
                    );
                }
            }

            throw error;
        }

        await logEvent(
            newPost._id,
            "POST_CREATED",
            "Post initialized",
            {
                requestId: safeRequestId,
                mediaPending:
                    Boolean(mediaPending),
                totalFiles:
                    requestedTotalFiles,
                title: title.trim(),
                isMobile
            }
        );

        // ------------------------------------------------------------
        // 7. R2 pending-media path
        // ------------------------------------------------------------
        if (mediaPending) {
            try {
                const plan =
                    await buildR2UploadPlan({
                        postId:
                            newPost._id,
                        descriptors:
                            mediaDescriptors,
                        keyPrefix: "file"
                    });

                newPost.media = plan.media;
                newPost.mediaUrl =
                    plan.media[0]?.url ?? null;
                newPost.mediaType =
                    plan.media[0]?.type ?? null;
                newPost.totalFilesExpected =
                    plan.media.length;
                newPost.uploadStatus = "pending";
                newPost.moderationStatus =
                    "pending";
                await newPost.save();

                await logEvent(
                    newPost._id,
                    "PRESIGNED_URL_GENERATED",
                    "R2 upload plan persisted",
                    {
                        count:
                            plan.signData.length
                    }
                );

                return addCorsHeaders(
                    NextResponse.json(
                        {
                            message:
                                "Post initialized. Awaiting media assets.",
                            post: newPost,
                            signData:
                                plan.signData
                        },
                        { status: 201 }
                    )
                );
            } catch (error) {
                newPost.uploadStatus =
                    "failed";
                newPost.moderationStatus =
                    "pending";

                await newPost
                    .save()
                    .catch(() => undefined);

                await logEvent(
                    newPost._id,
                    "PRESIGNED_URL_FAILED",
                    "R2 upload plan generation failed; submission can be resumed.",
                    {
                        error:
                            error?.message,
                        requestId:
                            safeRequestId
                    }
                );

                return addCorsHeaders(
                    NextResponse.json(
                        {
                            message:
                                "Upload initialization failed. Retry to resume this same post.",
                            retryable: true,
                            resumable: true,
                            postId:
                                newPost._id
                        },
                        { status: 503 }
                    )
                );
            }
        }

        // ------------------------------------------------------------
        // 8. Text-only/legacy path
        // ------------------------------------------------------------
        const evaluation =
            await finalizeAndPublishPost(
                newPost._id,
                isMobile,
                country,
                fingerprint,
                false
            );

        return addCorsHeaders(
            NextResponse.json(
                {
                    message:
                        evaluation.message,
                    post:
                        evaluation.post,
                    isFirstPost:
                        evaluation.isFirstPost,
                    auraStats:
                        evaluation.auraStats
                },
                { status: 201 }
            )
        );
    } catch (error) {
        console.error(
            "POST error:",
            error
        );

        return addCorsHeaders(
            NextResponse.json(
                {
                    message:
                        error?.message ||
                        "Server error"
                },
                { status: 500 }
            )
        );
    }
}

/**
 * 🛰️ CENTRALIZED LIFE-CYCLE PROCESSING ENGINE
 *
 * Media-bearing posts must reach this function through the /finalize route.
 * That route verifies every R2 object with HeadObject before setting
 * uploadStatus to "finalizing".
 */

cloudinary.config({
    cloud_name:
        process.env.CLOUDINARY_CLOUD_NAME ||
        "dxqsvqhgl",
    api_key:
        process.env.CLOUDINARY_API_KEY,
    api_secret:
        process.env.CLOUDINARY_API_SECRET
});

async function claimPostPublicationEffects(
    postId
) {
    return Post.findOneAndUpdate(
        {
            _id: postId,
            status: "approved",
            rewardsGrantedAt: null
        },
        {
            $set: {
                rewardsGrantedAt:
                    new Date()
            }
        },
        { new: true }
    );
}

export async function finalizeAndPublishPost(
    postId,
    isMobile,
    country,
    fingerprint,
    isEdit = false,
    options = {}
) {
    const lockAlreadyAcquired =
        Boolean(
            options?.lockAlreadyAcquired
        );

    let moderationFinished = false;

    await logEvent(
        postId,
        "FINALIZE_CALLED",
        "Finalize Engine execution started",
        {
            isMobile,
            isEdit,
            lockAlreadyAcquired
        }
    );

    try {
        let post =
            await Post.findById(postId);

        if (!post) {
            await logEvent(
                postId,
                "FINALIZE_FAILED",
                "Target post context not found"
            );

            throw new Error(
                "Target post context not found."
            );
        }

        // A completed new post should never be moderated or rewarded twice.
        if (
            !isEdit &&
            ["approved", "rejected"].includes(
                post.status
            )
        ) {
            return {
                message:
                    "Post was already finalized.",
                post,
                isFirstPost: false,
                auraStats: null,
                alreadyFinalized: true
            };
        }

        // Text-only and edit-without-new-media calls acquire their lock here.
        // Media calls arrive with a lock from the /finalize route.
        if (!lockAlreadyAcquired) {
            const lockQuery = {
                _id: postId,
                moderationStatus: {
                    $ne: "processing"
                }
            };

            if (!isEdit) {
                lockQuery.status = {
                    $in: [
                        "pending",
                        "pending_media"
                    ]
                };
            }

            const lockedPost =
                await Post.findOneAndUpdate(
                    lockQuery,
                    {
                        $set: {
                            moderationStatus:
                                "processing",
                            moderationStatusChangedAt:
                                new Date()
                        }
                    },
                    { new: true }
                );

            if (!lockedPost) {
                const currentPost =
                    await Post.findById(
                        postId
                    );

                if (
                    currentPost &&
                    ["approved", "rejected"].includes(
                        currentPost.status
                    )
                ) {
                    return {
                        message:
                            "Post was already finalized.",
                        post:
                            currentPost,
                        isFirstPost:
                            false,
                        auraStats: null,
                        alreadyFinalized:
                            true
                    };
                }

                return {
                    message:
                        "Post finalization is already in progress.",
                    post:
                        currentPost || post,
                    isFirstPost:
                        false,
                    auraStats: null,
                    processing: true
                };
            }

            post = lockedPost;
        } else if (
            post.moderationStatus !==
            "processing"
        ) {
            post.moderationStatus =
                "processing";
            await post.save();
        }

        const expectsMedia =
            Number(
                post.totalFilesExpected || 0
            ) > 0;

        if (
            expectsMedia &&
            ![
                "finalizing",
                "uploaded"
            ].includes(post.uploadStatus)
        ) {
            post.moderationStatus =
                "pending";
            post.status = isEdit
                ? "pending_media"
                : "pending";
            await post.save();

            await logEvent(
                postId,
                "FINALIZE_FAILED",
                "Finalize engine called before verified media was ready.",
                {
                    uploadStatus:
                        post.uploadStatus,
                    totalFilesExpected:
                        post.totalFilesExpected
                }
            );

            return {
                message:
                    "Media is not ready for moderation yet.",
                post,
                isFirstPost: false,
                auraStats: null,
                mediaNotReady: true
            };
        }

        if (!expectsMedia) {
            post.uploadStatus =
                "uploaded";
        }

        // Normalize ordering and remove duplicate URLs.
        if (
            Array.isArray(post.media) &&
            post.media.length > 0
        ) {
            post.media.sort(
                (a, b) =>
                    (a?.order || 0) -
                    (b?.order || 0)
            );

            const uniqueUrls =
                new Set();

            post.media =
                post.media.filter(
                    (item) => {
                        if (
                            !item ||
                            !item.url ||
                            uniqueUrls.has(
                                item.url
                            )
                        ) {
                            return false;
                        }

                        uniqueUrls.add(
                            item.url
                        );
                        return true;
                    }
                );

            post.mediaUrl =
                post.media[0]?.url ?? null;
            post.mediaType =
                post.media[0]?.type ?? null;
        }

        // R2 remains the source of truth.
        // Do not synchronously copy videos to Cloudinary in this request.
        let userDoc =
            await userModel.findById(
                post.authorUserId
            );

        if (!userDoc && fingerprint) {
            userDoc =
                await MobileUser.findOne({
                    deviceId:
                        fingerprint
                });
        }

        let finalStatus = isMobile
            ? "pending"
            : "approved";

        let rejectionReason = "";
        let expiresAt = null;
        let aiInterests = [];

        if (isMobile) {
            if (
                post.category ===
                "Polls" &&
                (
                    !post.poll ||
                    !Array.isArray(
                        post.poll.options
                    ) ||
                    post.poll.options.length <
                    2
                )
            ) {
                finalStatus =
                    "rejected";
                rejectionReason =
                    "Polls require a valid configuration with at least 2 options.";
                expiresAt =
                    new Date(
                        Date.now() +
                        12 *
                        60 *
                        60 *
                        1000
                    );
                post.moderationStatus =
                    "rejected";
            } else {
                await logEvent(
                    postId,
                    "AI_STARTED",
                    "Sending post context to AI Moderator"
                );

                const ai =
                    await runAIModerator(
                        post.title,
                        post.message,
                        post.clanId,
                        post.category,
                        post.mediaUrl,
                        post.mediaType,
                        post.poll
                    );

                await logEvent(
                    postId,
                    "AI_COMPLETED",
                    "AI Moderation returned",
                    {
                        action:
                            ai?.action,
                        reason:
                            ai?.reason
                    }
                );

                aiInterests =
                    Array.isArray(
                        ai?.interests
                    )
                        ? ai.interests
                        : [];

                if (
                    ai?.action ===
                    "approve"
                ) {
                    finalStatus =
                        "approved";
                    rejectionReason =
                        ai?.reason || "";
                    post.moderationStatus =
                        "approved";
                } else if (
                    ai?.action ===
                    "reject"
                ) {
                    finalStatus =
                        "rejected";
                    rejectionReason =
                        ai?.reason ||
                        "Rejected by moderation.";
                    post.moderationStatus =
                        "rejected";
                    expiresAt =
                        new Date(
                            Date.now() +
                            12 *
                            60 *
                            60 *
                            1000
                        );
                } else {
                    finalStatus =
                        "pending";
                    rejectionReason =
                        ai?.reason ||
                        "Awaiting manual review.";
                    post.moderationStatus =
                        "failed";
                }
            }
        } else {
            post.moderationStatus =
                "approved";
        }

        post.status = finalStatus;
        post.rejectionReason =
            rejectionReason || null;
        post.expiresAt =
            expiresAt || null;
        post.interests =
            aiInterests;
        post.uploadStatus =
            "uploaded";

        await post.save();
        moderationFinished = true;

        let isFirstPost = false;
        let auraStats = null;

        // ------------------------------------------------------------
        // Exactly-once new-post publication effects
        // ------------------------------------------------------------
        if (
            !isEdit &&
            finalStatus ===
            "approved" &&
            userDoc
        ) {
            const publicationClaim =
                await claimPostPublicationEffects(
                    postId
                );

            if (publicationClaim) {
                try {
                    const approvedPostCount =
                        await Post.countDocuments({
                            authorUserId:
                                userDoc._id,
                            status:
                                "approved"
                        });

                    userDoc.totalPosts =
                        approvedPostCount;
                    isFirstPost =
                        approvedPostCount ===
                        1;

                    await checkTitleUnlocks(
                        userDoc,
                        "totalPosts",
                        approvedPostCount
                    );

                    const hour =
                        new Date().getHours();

                    if (
                        hour >= 1 &&
                        hour <= 4
                    ) {
                        await MobileUser.findByIdAndUpdate(
                            userDoc._id,
                            {
                                $addToSet: {
                                    unlockedTitles:
                                    {
                                        name:
                                            "Night Owl",
                                        tier:
                                            "COMMON"
                                    }
                                }
                            }
                        );
                    }

                    await userDoc.save();

                    const auraReward =
                        isFirstPost
                            ? 50
                            : 15;

                    const auraResult =
                        await awardAura(
                            userDoc._id,
                            auraReward
                        );

                    if (
                        auraResult &&
                        auraResult.newRank
                    ) {
                        auraStats = {
                            earned:
                                auraReward,
                            currentAura:
                                auraResult
                                    .user
                                    .aura,
                            pointsNeeded:
                                Math.max(
                                    0,
                                    (
                                        auraResult
                                            .newRank
                                            .nextRankReq ||
                                        12000
                                    ) -
                                    auraResult
                                        .user
                                        .aura
                                )
                        };
                    }
                } catch (auraError) {
                    console.error(
                        "Aura execution fault:",
                        auraError
                    );

                    await logEvent(
                        postId,
                        "PUBLICATION_EFFECT_FAILED",
                        "Aura/user publication effect failed after claim.",
                        {
                            error:
                                auraError?.message
                        }
                    );
                }

                if (post.clanId) {
                    try {
                        const approvedClanPosts =
                            await Post.countDocuments({
                                clanId:
                                    post.clanId,
                                status:
                                    "approved"
                            });

                        await Clan.findOneAndUpdate(
                            {
                                tag:
                                    post.clanId
                            },
                            {
                                $set: {
                                    "stats.totalPosts":
                                        approvedClanPosts
                                }
                            }
                        );

                        await awardClanPoints(
                            post,
                            50,
                            "create"
                        );
                    } catch (clanError) {
                        console.error(
                            "Clan processing fault:",
                            clanError
                        );

                        await logEvent(
                            postId,
                            "PUBLICATION_EFFECT_FAILED",
                            "Clan publication effect failed after claim.",
                            {
                                error:
                                    clanError?.message
                            }
                        );
                    }
                }

                // Web newsletter/global push path.
                if (!isMobile) {
                    try {
                        const subscribers =
                            await Newsletter.find(
                                {},
                                "email"
                            );

                        if (
                            subscribers.length >
                            0
                        ) {
                            const transporter =
                                nodemailer.createTransport(
                                    {
                                        service:
                                            "gmail",
                                        auth: {
                                            user:
                                                process
                                                    .env
                                                    .MAILEREMAIL,
                                            pass:
                                                process
                                                    .env
                                                    .MAILERPASS
                                        }
                                    }
                                );

                            await transporter.sendMail(
                                {
                                    from:
                                        `"Oreblogda" <${process.env.MAILEREMAIL}>`,
                                    to:
                                        "Subscribers",
                                    bcc:
                                        subscribers.map(
                                            (
                                                subscriber
                                            ) =>
                                                subscriber.email
                                        ),
                                    subject:
                                        `📰 New Post from ${userDoc?.username}`,
                                    html:
                                        `<h2>${post.title}</h2><p>${post.message.substring(0, 200)}...</p><a href="${process.env.SITE_URL}/post/${post.slug}">Read More</a>`
                                }
                            );
                        }
                    } catch (newsletterError) {
                        console.error(
                            "Newsletter fault:",
                            newsletterError
                        );
                    }

                    try {
                        await notifyAllMobileUsersAboutPost(
                            post,
                            userDoc?.username
                        );
                    } catch (_) { }
                }

                if (post.clanId) {
                    try {
                        const clan =
                            await Clan.findOne({
                                tag:
                                    post.clanId
                            }).select("name");

                        const followers =
                            await ClanFollower.find(
                                {
                                    clanTag:
                                        post.clanId
                                }
                            ).populate({
                                path:
                                    "userId",
                                select:
                                    "pushToken"
                            });

                        const tokens =
                            followers.flatMap(
                                (follower) => {
                                    const token =
                                        follower
                                            .userId
                                            ?.pushToken;

                                    return token
                                        ? [token]
                                        : [];
                                }
                            );

                        if (
                            tokens.length >
                            0
                        ) {
                            await sendPillParallel(
                                tokens,
                                `${clan?.name || post.clanId} Transmission 🚩`,
                                `${userDoc?.username || "Someone"} posted: ${post.title}`,
                                {
                                    type:
                                        "open_post",
                                    postId:
                                        post._id.toString(),
                                    clanTag:
                                        post.clanId,
                                    screen:
                                        `/post/${post._id.toString()}`,
                                    mediaUrl:
                                        post.mediaUrl,
                                    authorPfp:
                                        userDoc
                                            ?.profilePic
                                            ?.url
                                },
                                {
                                    type:
                                        "clan_post",
                                    targetAudience:
                                        "clan",
                                    targetId:
                                        post.clanId,
                                    priority:
                                        3,
                                    link:
                                        `/post/${post._id.toString()}`,
                                    expiresInHours:
                                        6
                                }
                            );
                        }
                    } catch (clanAlertError) {
                        console.error(
                            "Clan alert fault:",
                            clanAlertError
                        );
                    }
                }

                await logEvent(
                    postId,
                    "POST_PUBLISHED",
                    "Post successfully broadcasted and published"
                );
            }
        }

        // ------------------------------------------------------------
        // Manual-review and rejection notices
        // ------------------------------------------------------------
        if (
            finalStatus ===
            "pending"
        ) {
            const adminTokens = [
                "cUxM1ev3RBucmAXg7LklVv:APA91bEqsCxOVL9wzS-ag9DRvEJjNBUnhmiZ7hyreQ54mUGxH9x3CraM27SVZuPIyUG4HRx8IODPYGkD24MJqYiNSTKoBVrV19CLMs-ZcUiNa-plrUta6D0"
            ];

            for (
                const token of
                adminTokens
            ) {
                try {
                    await sendPushNotification(
                        token,
                        isEdit
                            ? "Edited post needs review!"
                            : "New post!",
                        "A post is awaiting your approval.",
                        {
                            postId:
                                post._id.toString(),
                            mediaUrl:
                                post.mediaUrl,
                            authorPfp:
                                userDoc
                                    ?.profilePic
                                    ?.url
                        }
                    );
                } catch (_) { }
            }

            try {
                const transporter =
                    nodemailer.createTransport(
                        {
                            service:
                                "gmail",
                            auth: {
                                user:
                                    process.env
                                        .MAILEREMAIL,
                                pass:
                                    process.env
                                        .MAILERPASS
                            }
                        }
                    );

                await transporter.sendMail({
                    from:
                        `"Oreblogda" <${process.env.MAILEREMAIL}>`,
                    to: "Admins",
                    bcc: [
                        "kayteedberserker@gmail.com",
                        "fredrickokwu@gmail.com"
                    ],
                    subject: isEdit
                        ? "📰 Edited Post Awaiting Approval"
                        : "📰 New Post Awaiting Approval",
                    html:
                        `View it <a href="${process.env.SITE_URL}/authordiary/approvalpage">here</a>.`
                });
            } catch (_) { }
        }

        if (
            finalStatus ===
            "rejected" &&
            userDoc?.pushToken
        ) {
            try {
                await sendPillParallel(
                    [
                        userDoc.pushToken
                    ],
                    "Post Rejected ⚠️",
                    `Your post "${String(post.title).slice(0, 20)}..." was not approved. Reason: ${rejectionReason}`,
                    {
                        type:
                            "open_diary",
                        status:
                            "rejected",
                        reason:
                            rejectionReason,
                        postId:
                            post._id.toString(),
                        screen:
                            "/authordiary",
                        mediaUrl:
                            post.mediaUrl,
                        authorPfp:
                            userDoc
                                ?.profilePic
                                ?.url
                    },
                    {
                        type:
                            "post_rejection",
                        targetAudience:
                            "user",
                        link:
                            "/authordiary",
                        targetId:
                            userDoc._id.toString(),
                        singleUser:
                            true,
                        priority:
                            10,
                        expiresInHours:
                            12
                    }
                );
            } catch (error) {
                console.error(
                    "Rejection notice fault:",
                    error
                );
            }
        }

        const finalPost =
            await Post.findById(postId);

        await logEvent(
            postId,
            "FINALIZE_SUCCESS",
            "Finalize execution successfully finished",
            {
                finalStatus,
                isEdit
            }
        );

        return {
            message:
                finalStatus ===
                    "approved"
                    ? isEdit
                        ? "Post updated successfully"
                        : "Post created successfully"
                    : finalStatus ===
                        "rejected"
                        ? "Post rejected by AI"
                        : "Post submitted for approval",
            post:
                finalPost || post,
            isFirstPost,
            auraStats
        };
    } catch (error) {
        if (
            !moderationFinished &&
            postId
        ) {
            await Post.findByIdAndUpdate(
                postId,
                {
                    $set: {
                        moderationStatus:
                            "pending",
                        uploadStatus:
                            "uploaded"
                    }
                }
            ).catch(
                () => undefined
            );
        }

        await logEvent(
            postId,
            "FINALIZE_FAILED",
            "Finalize engine crashed",
            {
                error:
                    error?.message,
                isEdit
            }
        );

        throw error;
    }
}

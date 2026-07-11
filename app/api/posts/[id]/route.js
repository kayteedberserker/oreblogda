import { awardAura } from "@/app/lib/auraManager";
import { awardClanPoints } from "@/app/lib/clanService";
import { sendPillParallel } from "@/app/lib/messagePillService";
import connectDB from "@/app/lib/mongodb";
import Clan from "@/app/models/ClanModel";
import MobileUser from "@/app/models/MobileUserModel";
import Post from "@/app/models/PostModel";
import crypto from "crypto";
import { NextResponse } from "next/server";

// ----------------------
// 🛡️ SECURITY: Request Signature Verification
// ----------------------
function verifyRequestSignature(req, body) {
    const signature = req.headers.get("x-oreblogda-signature");
    const SECRET = process.env.APP_INTERNAL_SECRET;

    if (!SECRET) return true;
    if (!signature) return false;

    const expectedSignature = crypto
        .createHmac("sha256", SECRET)
        .update(JSON.stringify(body))
        .digest("hex");

    return signature === expectedSignature;
}

// ----------------------
// 🌐 UTILITY: Get Client IP
// ----------------------
function getClientIp(req) {
    const xfwd = req.headers.get("x-forwarded-for");
    const cf = req.headers.get("cf-connecting-ip");
    const xr = req.headers.get("x-real-ip");

    let ip = (xfwd && xfwd.split(",")[0].trim()) || cf || xr;
    if (!ip) ip = "unknown";
    if (ip.includes("::ffff:")) ip = ip.split("::ffff:").pop();
    return ip;
}

// ----------------------
// 🤖 UTILITY: Bot Detection
// ----------------------
const isBotRequest = async (req, ip) => {
    if (!ip || ip === "unknown") return false;
    const botKeywords = [
        "facebookexternalhit", "Facebot", "Facebook", "Google", "Googlebot", "Bingbot", "Twitterbot",
        "LinkedInBot", "Slackbot", "Discordbot", "Pingdom", "AhrefsBot", "SemrushBot",
        "MJ12bot", "Baiduspider", "YandexBot"
    ];
    const userAgent = req.headers.get("user-agent") || "";
    const isBotUA = botKeywords.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));
    const botIPPrefixes = [
        "66.102.", "66.249.", "64.233.", "34.", "65.0", "74.125.", "142.250.", "172.217.",
        "209.85.", "216.58.", "31.13.", "66.220.", "69.171.", "15.206.", "52.66.", "13.",
        "43.", "3.", "157.240.", "173.252.", "18.", "17.", "::1", "198.7.237.", "102.67.", "204.", "137.184."
    ];
    const isBotIP = botIPPrefixes.some(prefix => ip.startsWith(prefix));
    return isBotUA || isBotIP;
};

// ----------------------
// 🛠️ HELPERS: Server-side UI logic
// ----------------------
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
    return { level: tier.level, rankName: `${tier.icon} ${tier.title}` };
}

function calculateDiscussionCount(comments) {
    if (!Array.isArray(comments)) return 0;
    let count = 0;
    comments.forEach(c => {
        const replies = c.replies || [];
        if (replies.length >= 5) { count++; return; }
        const authors = new Set();
        const getId = (item) => item.authorUserId || item.authorFingerprint || item.name;
        authors.add(getId(c));
        replies.forEach(r => authors.add(getId(r)));
        if (authors.size >= 3) count++;
    });
    return count;
}

// ----------------------
// Helper for CORS
// ----------------------
function addCorsHeaders(response) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    response.headers.set("Access-Control-Allow-Methods", "GET,PATCH,OPTIONS");
    response.headers.set("Access-Control-Allow-Headers", "Content-Type,Authorization,x-oreblogda-signature");
    return response;
}

export async function OPTIONS() {
    return addCorsHeaders(new NextResponse(null, { status: 204 }));
}

// 🏆 Title Thresholds Mapping
const TITLE_THRESHOLDS = {
    totalLikes: [
        { limit: 100, name: "Appreciated", tier: "COMMON" },
        { limit: 2500, name: "Crowd Favorite", tier: "RARE" },
        { limit: 10000, name: "Golden Soul", tier: "EPIC" },
        { limit: 100000, name: "The People's Choice", tier: "LEGENDARY" }
    ],
    totalViews: [
        { limit: 10000, name: "Visible One", tier: "RARE" },
        { limit: 100000, name: "Viral Spec", tier: "EPIC" },
        { limit: 1000000, name: "Omnipresent", tier: "LEGENDARY" }
    ],
    totalShares: [
        { limit: 50, name: "Messenger", tier: "COMMON" },
        { limit: 500, name: "Trendsetter", tier: "RARE" },
        { limit: 2000, name: "Signal Booster", tier: "EPIC" },
        { limit: 5000, name: "Broadcast Master", tier: "LEGENDARY" }
    ]
};

// 🛠 Helper to check and award titles
async function checkTitleUnlocks(user, field, currentCount) {
    const thresholds = TITLE_THRESHOLDS[field];
    if (!thresholds) return null;

    // Find the highest title they just qualified for
    const earnedTitle = [...thresholds].reverse().find(t => currentCount >= t.limit);

    if (earnedTitle) {
        // Check if they already have this title to avoid duplicate notifications
        const alreadyHas = user.unlockedTitles?.some(t => t.name === earnedTitle.name);

        if (!alreadyHas) {
            await MobileUser.findByIdAndUpdate(user._id, {
                $addToSet: { unlockedTitles: earnedTitle }
            });

            // 🔔 Using your notification stack for the unlock
            if (user.pushToken) {
                const titleMsg = `🏆 NEW TITLE UNLOCKED: "${earnedTitle.name}"!`;

                await sendPillParallel(
                    [user.pushToken],
                    "Title Earned",
                    titleMsg,
                    { type: "achievement" },
                    {
                        type: 'achievement',
                        targetAudience: 'user',
                        targetId: user._id.toString(),
                        singleUser: true,
                        priority: 3
                    }
                );
            }

            return earnedTitle;
        }
    }
    return null;
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

// ----------------------
// GET: Fetch single post (Enriched for PostCard)
// ----------------------
export async function GET(req, { params }) {
    try {
        await connectDB();
        const resolvedParams = await params;
        const { id } = resolvedParams;
        if (!id) return addCorsHeaders(NextResponse.json({ message: "Post identifier required" }, { status: 400 }));

        // Get deviceId from headers for hasLiked check
        const deviceId = req.headers.get("x-user-deviceId") || "";

        // ⚡️ CONFIGURATION: Set global baseline point requirement for trending status evaluation
        const TRENDING_THRESHOLD = 1000;

        // 1. Fetch the post
        let post;
        if (id.includes("-")) {
            post = await Post.findOne({ slug: id }).lean();
        } else {
            post = await Post.findById(id).lean();
        }

        if (!post) return addCorsHeaders(NextResponse.json({ message: "Post not found" }, { status: 404 }));

        // 2. Fetch related data (Author Post Count, Author Details, Clan Details)
        const authorId = post.authorUserId || post.authorId;
        const clanTag = post.clanTag || post.clanId;

        let authorData = null;
        let clanData = null;
        let authorPostCount = 0;

        // Run these fetches in parallel for maximum speed
        const promises = [];

        if (authorId) {
            promises.push(
                Post.countDocuments({ $or: [{ authorId }, { authorUserId: authorId }] })
                    .then(count => { authorPostCount = count; }),
                MobileUser.findById(authorId).lean()
                    .then(u => {
                        if (u) {
                            const inv = Array.isArray(u.inventory) ? u.inventory : (Array.isArray(u.specialInventory) ? u.specialInventory : []);
                            const rankInfo = resolveUserRankServer(u.currentRankLevel || 1);
                            const auraInfo = getAuraVisualsServer(u.previousRank || 0);

                            authorData = {
                                name: u.username,
                                image: u.profilePic?.url || null,
                                streak: u.lastStreak || 0,
                                rank: u.previousRank || 0,
                                peakLevel: u.peakLevel || 0,
                                aura: u.aura || 0,
                                inventory: inv,
                                rankLevel: u.currentRankLevel || 1,
                                displayRank: rankInfo.rankName,
                                auraVisuals: auraInfo,
                                equippedGlow: inv.find(i => (i.category === 'GLOW' || i.category === 'NAME_GLOW') && i.isEquipped) || null,
                                equippedBadges: inv.filter(i => i.category === 'BADGE' && i.isEquipped).slice(0, 3) || [],
                                equippedTitle: u.equippedTitle || null // ⚡️ ADDED: Synchronized field to map properly to frontend TitleTag components
                            };
                        }
                    }
                    )
            );
        }

        if (clanTag) {
            promises.push(
                Clan.findOne({ $or: [{ tag: clanTag }] }).lean()
                    .then(c => {
                        if (c) {
                            // ⚡️ RESOLVE CLAN DISPLAY RANK VIA POINT THRESHOLDS
                            clanData = {
                                ...c,
                                displayRank: resolveClanDisplayRank(c.totalPoints || 0)
                            };
                        }
                    })
            );
        }

        // Wait for all related data to fetch
        await Promise.all(promises);

        // Clean message for the feed excerpt
        const feedMessage = post.message
            ? post.message
                .replace(/s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs, "$1$2$3$4$5$6$8$10")
                .replace(/\n+/g, ' ')
                .trim()
            : "";

        // 3. Package and return
        // ⚡️ CHECK IF USER HAS LIKED THIS POST
        const postLikes = post.likes || [];
        const hasLiked = deviceId ? postLikes.some(like => like?.fingerprint == deviceId || like === deviceId) : false;

        // Compute hasViewed & poll vote status
        const hasViewed = post.viewsFingerprints?.includes(deviceId) || false;

        let pollVoteStatus = null;

        if (post.poll && post.voters?.length > 0) {
            const voterMatch = post.voters.find(v =>
                v.fingerprint === deviceId || v === deviceId  // Legacy string support
            );

            pollVoteStatus = {
                hasVoted: !!voterMatch,
                userVotedOptions: voterMatch?.selectedOptions || []
            };
        }

        // ⚡️ ADDED: Compute structured dynamic Hype information 
        const finalHypeCount = Array.isArray(post.hypePoints) ? post.hypePoints.length : (post.hypePoints || 0);
        const isTrending = finalHypeCount >= TRENDING_THRESHOLD;

        const responseData = {
            ...post,
            authorPostCount,
            authorData,
            clanData,
            feedExcerpt: feedMessage.length > 150 ? feedMessage.slice(0, 150) + "..." : feedMessage,
            formattedViews: formatViewsServer(post.viewsCount ?? post.views ?? 0),
            likesCount: post.likesCount ?? post.likeCount ?? (post.likes?.length || 0),
            commentsCount: post.comments?.length || 0,
            hypePointsCount: finalHypeCount,
            isTrending,
            discussionCount: calculateDiscussionCount(post.comments || []),
            hasLiked,
            hasViewed,
            poll: post.poll ? {
                ...post.poll,
                ...pollVoteStatus
            } : post.poll
        };

        return addCorsHeaders(NextResponse.json(responseData));

    } catch (err) {
        console.error("Single Post Fetch Error:", err);
        return addCorsHeaders(NextResponse.json({ message: "Server error", error: err.message }, { status: 500 }));
    }
}

// 🚀 SCALING: In-memory IP Cache to save rate limits
const ipCache = new Map();

// ----------------------
// 🧠 UNIFIED HELPER: Telemetry, Affinity, Decay, & Optimization
// ----------------------
async function processTelemetryAndAffinity(fingerprint, post, candidateSources, action, weight) {
    if (!fingerprint || !post) return;

    try {
        const user = await MobileUser.findOne({ deviceId: fingerprint })
            .select('affinityScores authorAffinity countryAffinity feedLearning');
        if (!user) return;

        // --- A. AFFINITY UPDATES (Dynamic Ranking Signal) ---
        // We still update these dynamically because they govern what the user SEES (Ranking)
        const tagWeight = weight;
        const authorWeight = Math.round(weight * 0.5);
        const countryWeight = Math.round(weight * 0.25);

        let affinityScores = user.affinityScores ? (user.affinityScores instanceof Map ? Object.fromEntries(user.affinityScores) : user.affinityScores) : {};
        let authorAffinity = user.authorAffinity ? (user.authorAffinity instanceof Map ? Object.fromEntries(user.authorAffinity) : user.authorAffinity) : {};
        let countryAffinity = user.countryAffinity ? (user.countryAffinity instanceof Map ? Object.fromEntries(user.countryAffinity) : user.countryAffinity) : {};

        const updateAndTrim = (obj, key, addWeight, limit) => {
            if (!key) return obj;
            const sanitizedKey = key.replace(/\./g, '_').replace(/\$/g, '');
            if (!sanitizedKey) return obj;

            const current = typeof obj[sanitizedKey] === "number" ? obj[sanitizedKey] : 0;
            obj[sanitizedKey] = current + addWeight;

            if (Object.keys(obj).length > limit + 10) {
                const sortedEntries = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, limit);
                return Object.fromEntries(sortedEntries);
            }
            return obj;
        };

        if (post.interests && Array.isArray(post.interests)) {
            post.interests.forEach(tag => {
                if (tag) affinityScores = updateAndTrim(affinityScores, tag.trim().toLowerCase(), tagWeight, 50);
            });
        }
        const targetAuthor = post.authorUserId ? post.authorUserId.toString() : post.authorId;
        if (targetAuthor && targetAuthor !== fingerprint) {
            authorAffinity = updateAndTrim(authorAffinity, targetAuthor, authorWeight, 30);
        }
        if (post.country && post.country !== "Global" && post.country !== "Unknown") {
            countryAffinity = updateAndTrim(countryAffinity, post.country, countryWeight, 10);
        }

        // --- B. TELEMETRY INCREMENTS (🌟 UPDATED: FIXED POOL CONFIDENCE) ---
        // We use static confidence to govern how the algorithm LEARNS (Attribution)
        const actionMap = {
            'view': 'impressions', 'like': 'likes', 'share': 'shares',
            'vote': 'votes', 'watch_complete': 'watch_complete',
            'skip': 'skips', 'not_interested': 'skips',
            'comment': 'comments',
            'hype': 'votes'
        };
        const metric = actionMap[action];
        const validPools = ['fresh', 'author', 'clan', 'interest', 'trending', 'explore'];
        const incUpdates = {};

        if (metric && Array.isArray(candidateSources) && candidateSources.length > 0) {

            // 1. Extract Unique Pool Types (Prevents double-counting if a post had 2 interest tags)
            const uniqueTypes = [...new Set(candidateSources.map(s => s.type).filter(t => validPools.includes(t)))];

            if (uniqueTypes.length > 0) {
                // 2. Static Pool Confidence Tiers
                const POOL_CONFIDENCE = {
                    explore: 1,
                    fresh: 1,
                    clan: 2,
                    trending: 4,
                    interest: 4,
                    author: 4
                }

                let totalConfidence = 0;

                // 3. Map to confidence scores and sum them up
                const scoredSources = uniqueTypes.map(type => {
                    const conf = POOL_CONFIDENCE[type] || 1;
                    totalConfidence += conf;
                    return { type, conf };
                });

                // 4. Normalize to 1.0 and increment
                scoredSources.forEach(source => {
                    const normalizedFraction = parseFloat((source.conf / totalConfidence).toFixed(3));

                    if (!isNaN(normalizedFraction) && normalizedFraction > 0) {
                        incUpdates[`feedLearning.sourceStats.${source.type}.${metric}`] = normalizedFraction;
                    }
                });
            }
        }

        // --- C. OPTIMIZATION & DECAY CHECK ---
        let setUpdates = { affinityScores, authorAffinity, countryAffinity };

        if (user.feedLearning) {
            const lastOpt = user.feedLearning.lastOptimizedAt || new Date(0);
            const stats = user.feedLearning.sourceStats || {};

            let totalImpressions = 0;
            validPools.forEach(pool => { totalImpressions += (stats[pool]?.impressions || 0); });

            // Exactly 1 impression is distributed, so we increment the total by 1
            if (metric === 'impressions' && Object.keys(incUpdates).length > 0) {
                totalImpressions += 1;
            }

            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (Date.now() - lastOpt.getTime() >= twentyFourHours && totalImpressions >= 100) {
                // 1. DECAY OLD AFFINITIES
                const decayMap = (mapObj, factor = 0.98) => {
                    for (let key in mapObj) {
                        mapObj[key] = Math.max(0.1, Number((mapObj[key] * factor).toFixed(2)));
                        if (mapObj[key] < 1) delete mapObj[key];
                    }
                };
                decayMap(setUpdates.affinityScores);
                decayMap(setUpdates.authorAffinity);
                decayMap(setUpdates.countryAffinity);

                // 2. RATE-BASED POOL SCORING
                let totalScore = 0;
                const rawScores = {};

                validPools.forEach(pool => {
                    const s = stats[pool] || {};
                    const imp = (s.impressions || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.impressions`] || 0);
                    let score = 0;

                    if (imp < 20) {
                        score = 50;
                    } else {
                        const likeRate = ((s.likes || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.likes`] || 0)) / imp;
                        const voteRate = ((s.votes || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.votes`] || 0)) / imp;
                        const watchRate = ((s.watch_complete || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.watch_complete`] || 0)) / imp;
                        const commentRate = ((s.comments || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.comments`] || 0)) / imp;
                        const shareRate = ((s.shares || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.shares`] || 0)) / imp;
                        const skipRate = ((s.skips || 0) + (incUpdates[`feedLearning.sourceStats.${pool}.skips`] || 0)) / imp;

                        score = 10 + (likeRate * 50) + (voteRate * 50) + (watchRate * 80) +
                            (commentRate * 100) + (shareRate * 150) + (skipRate * -60);
                    }

                    rawScores[pool] = Math.max(10, score);
                    totalScore += rawScores[pool];
                });

                // 3. Exact Normalization (Fixing the edge case)
                const newWeights = {};

                // Set initial pure ratio
                validPools.forEach(pool => newWeights[pool] = rawScores[pool] / totalScore);

                // Enforce the clamping boundaries
                let clampedTotal = 0;
                validPools.forEach(pool => {
                    newWeights[pool] = Math.max(0.05, Math.min(0.45, newWeights[pool]));
                    clampedTotal += newWeights[pool];
                });

                // Divide by the new clamped boundary sum to safely guarantee exact 1.0 distribution
                validPools.forEach(pool => {
                    newWeights[pool] = parseFloat((newWeights[pool] / clampedTotal).toFixed(3));
                });

                setUpdates["feedLearning.poolWeights"] = newWeights;
                setUpdates["feedLearning.lastOptimizedAt"] = new Date();

                // 4. RESET STATS
                Object.keys(incUpdates).forEach(key => delete incUpdates[key]);
                validPools.forEach(pool => {
                    setUpdates[`feedLearning.sourceStats.${pool}.impressions`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.likes`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.votes`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.watch_complete`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.comments`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.shares`] = 0;
                    setUpdates[`feedLearning.sourceStats.${pool}.skips`] = 0;
                });
                console.log(`[ML] Epoch closed. Re-optimized pools & decayed affinities for ${fingerprint}:`, newWeights);
            }
        }

        // --- D. EXECUTE SINGLE ATOMIC UPDATE ---
        const updateOperation = { $set: setUpdates };
        if (Object.keys(incUpdates).length > 0) {
            updateOperation.$inc = incUpdates;
        }

        await MobileUser.updateOne({ _id: user._id }, updateOperation);

    } catch (err) {
        console.error("❌ Unified Telemetry Error:", err);
    }
}

import Report from "@/app/models/ReportModel";

// ----------------------
// PATCH: Handle Likes, Views, Shares, Votes, Reports
// ----------------------
export async function PATCH(req, { params }) {
    await connectDB();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    try {
        const body = await req.json();
        const { action, payload, candidateSources = [] } = body;
        console.log(candidateSources, "is the candidate source")
        const fingerprint = req.headers.get("x-user-deviceId") || req.headers.get("x-device-id");
        const ip = getClientIp(req);
        const isBot = await isBotRequest(req, ip);

        if (action === "report") {
            console.log("tried to report")
            const { reason } = payload || {};
            if (!reason) return addCorsHeaders(NextResponse.json({ message: "Report reason is required" }, { status: 400 }));

            const post = await Post.findById(id);
            if (!post) return addCorsHeaders(NextResponse.json({ message: "Post not found" }, { status: 404 }));

            // Prevent duplicate reports from the same device
            if (post.reportedBy && post.reportedBy.includes(fingerprint)) {
                return addCorsHeaders(NextResponse.json({ message: "You have already reported this transmission." }, { status: 400 }));
            }

            // 1. Log the report for admin review
            try {
                await Report.create({
                    targetId: id,
                    targetType: "post",
                    reporterFingerprint: fingerprint,
                    reason: reason
                });
            } catch (err) {
                // If it fails due to a unique index duplicate (just in case), ignore and continue suppressing
            }

            // 2. Update Post metrics
            const updatedPost = await Post.findByIdAndUpdate(
                id,
                {
                    $inc: { reportCount: 1 },
                    $push: { reportedBy: fingerprint }
                },
                { new: true }
            );

            // 3. Telemetry Impact: Hit the post with a massive negative affinity so the algorithm buries it for them
            if (updatedPost && fingerprint && !isBot) {
                processTelemetryAndAffinity(fingerprint, updatedPost, candidateSources, "report", -150);
            }

            return addCorsHeaders(NextResponse.json({ message: "Report submitted successfully." }, { status: 200 }));
        }

        if (action === "vote") {
            const { selectedOptions } = payload;
            const hasVoted = await Post.findOne({ _id: id, $or: [{ "voters": fingerprint }, { "voters.fingerprint": fingerprint }] });

            if (hasVoted) return addCorsHeaders(NextResponse.json({ message: "Already voted or post missing" }, { status: 400 }));

            const incUpdates = {};
            for (const index of selectedOptions) incUpdates[`poll.options.${index}.votes`] = 1;

            const updatedPost = await Post.findByIdAndUpdate(
                id, { $push: { voters: { fingerprint, selectedOptions } }, $inc: incUpdates }, { new: true }
            );

            if (!updatedPost) return addCorsHeaders(NextResponse.json({ message: "Post not found" }, { status: 404 }));

            // ⚡️ Fire and Forget Telemetry
            processTelemetryAndAffinity(fingerprint, updatedPost, candidateSources, "vote", 5);

            if (updatedPost.authorId !== fingerprint) {
                const author = await MobileUser.findOne({ deviceId: updatedPost.authorId });
                if (author) {
                    await awardAura(author._id, 5);
                    await awardClanPoints(updatedPost, 10);
                    const msg = `Someone voted on your post: "${updatedPost.title.substring(0, 15)}..."`;

                    if (author.pushToken) {
                        await sendPillParallel(
                            [author.pushToken], `New Vote! ✅ on post: "${updatedPost.title.substring(0, 10)}..."`, msg,
                            { postId: updatedPost._id.toString(), type: "post_detail", mediaUrl: updatedPost.mediaUrl, authorPfp: author.profilePic?.url },
                            { type: 'post_vote', targetAudience: 'user', targetId: author._id.toString(), singleUser: true, link: `/post/${updatedPost.slug}`, priority: 2 }
                        );
                    }
                }
            }
            return addCorsHeaders(NextResponse.json({ message: "Vote added" }, { status: 200 }));
        }

        if (action === "like") {
            const updatedPost = await Post.findOneAndUpdate(
                { _id: id, "likes.fingerprint": { $ne: fingerprint } },
                { $inc: { likeCount: 1 }, $push: { likes: { $each: [{ fingerprint, date: new Date() }], $slice: -600 } } },
                { new: true }
            );

            if (!updatedPost) return addCorsHeaders(NextResponse.json({ message: "Already liked" }, { status: 400 }));

            // ⚡️ Fire and Forget Telemetry
            processTelemetryAndAffinity(fingerprint, updatedPost, candidateSources, "like", 10);

            if (updatedPost.authorId !== fingerprint) {
                const author = await MobileUser.findOneAndUpdate(
                    { deviceId: updatedPost.authorId }, { $inc: { totalLikes: 1 } }, { new: true }
                );

                if (author) {
                    await awardAura(author._id, 5);
                    await awardClanPoints(updatedPost, 10, 'like');
                    await checkTitleUnlocks(author, "totalLikes", author.totalLikes || 0);

                    if (author.pushToken) {
                        await sendPillParallel(
                            [author.pushToken], `New Like on post: "${updatedPost.title.substring(0, 10)}..."`, `Someone liked your post: "${updatedPost.title.substring(0, 15)}..."`,
                            { postId: updatedPost._id.toString(), type: "post_detail", mediaUrl: updatedPost.mediaUrl, authorPfp: author.profilePic?.url },
                            { type: 'post_like', targetAudience: 'user', targetId: author._id.toString(), singleUser: true, link: `/post/${updatedPost.slug}`, priority: 2 }
                        );
                    }

                    const milestones = [5, 10, 25, 50, 100];
                    if (milestones.includes(updatedPost.likes.length) && author.pushToken) {
                        await sendPillParallel(
                            [author.pushToken], `Going Viral!"`, `🔥 Trending! Your post reached ${updatedPost.likes.length} likes!`,
                            { postId: updatedPost._id.toString(), type: "post_detail", mediaUrl: updatedPost.mediaUrl, authorPfp: author.profilePic?.url },
                            { type: 'event', targetAudience: 'user', targetId: author._id.toString(), singleUser: true, link: `/post/${updatedPost.slug}`, priority: 2 }
                        );
                    }
                }
            }
            return addCorsHeaders(NextResponse.json(updatedPost, { status: 200 }));
        }

        if (action === "share") {
            const updatedPost = await Post.findByIdAndUpdate(id, { $inc: { shares: 1 } }, { new: true });

            if (updatedPost) {
                processTelemetryAndAffinity(fingerprint, updatedPost, candidateSources, "share", 15);
            }

            if (updatedPost && updatedPost.authorId !== fingerprint) {
                const author = await MobileUser.findOneAndUpdate(
                    { deviceId: updatedPost.authorId }, { $inc: { totalShares: 1 } }, { new: true }
                );
                if (author) {
                    await awardAura(author._id, 3);
                    await awardClanPoints(updatedPost, 20, 'share');
                    await checkTitleUnlocks(author, "totalShares", author.totalShares || 0);
                }
            }
            return addCorsHeaders(NextResponse.json(updatedPost, { status: 200 }));
        }

        if (action === "view") {
            let country = "Unknown", city = "Unknown", timezone = "Unknown";

            if (!isBot && fingerprint) {
                // 🚀 NATIVE IP CACHE (Prevents DB thrashing and API limits)
                const nowMs = Date.now();
                if (ipCache.has(ip) && (nowMs - ipCache.get(ip).timestamp < 24 * 60 * 60 * 1000)) {
                    const cached = ipCache.get(ip);
                    country = cached.country; city = cached.city; timezone = cached.timezone;
                } else {
                    try {
                        const geoRes = await fetch(`https://ipinfo.io/${ip}/json`);
                        const geoData = await geoRes.json();
                        country = geoData.country || "Unknown"; city = geoData.city || "Unknown"; timezone = geoData.timezone || "Unknown";
                        ipCache.set(ip, { country, city, timezone, timestamp: nowMs });
                        if (ipCache.size > 10000) ipCache.clear(); // Safe eviction
                    } catch (err) { console.log("Geo lookup failed"); }
                }

                const updatedPost = await Post.findOneAndUpdate(
                    { _id: id, viewsFingerprints: { $ne: fingerprint } },
                    {
                        $inc: { views: 1 },
                        $push: {
                            viewsFingerprints: { $each: [fingerprint], $slice: -500 },
                            viewsData: { $each: [{ visitorId: fingerprint, ip, country, city, timezone, timestamp: new Date() }], $slice: -100 }
                        }
                    },
                    { new: true }
                );

                if (updatedPost) {
                    processTelemetryAndAffinity(fingerprint, updatedPost, candidateSources, "view", 1);
                    const author = await MobileUser.findOneAndUpdate(
                        { deviceId: updatedPost.authorId }, { $inc: { totalViews: 1 } }, { new: true }
                    );

                    if (author) {
                        if (updatedPost.views % 5 === 0) {
                            await awardAura(author._id, 2);
                            await awardClanPoints(updatedPost, 5, 'view');
                        }
                        await checkTitleUnlocks(author, "totalViews", author.totalViews || 0);
                    }
                    return addCorsHeaders(NextResponse.json(updatedPost, { status: 200 }));
                }
            }

            const post = await Post.findById(id);
            processTelemetryAndAffinity(fingerprint, post, candidateSources, "view", 0);
            return addCorsHeaders(NextResponse.json(post, { status: 200 }));
        }

        if (action === "watch_complete") {
            const post = await Post.findById(id);
            if (post && fingerprint && !isBot) {
                processTelemetryAndAffinity(fingerprint, post, candidateSources, "watch_complete", 8);
            }
            return addCorsHeaders(NextResponse.json({ message: "Watch logged" }, { status: 200 }));
        }

        if (action === "skip") {
            const post = await Post.findById(id);
            if (post && fingerprint && !isBot) {
                processTelemetryAndAffinity(fingerprint, post, candidateSources, "skip", -6);
            }
            return addCorsHeaders(NextResponse.json({ message: "Skip logged" }, { status: 200 }));
        }

        if (action === "not_interested") {
            const post = await Post.findById(id);
            if (post && fingerprint && !isBot) {
                processTelemetryAndAffinity(fingerprint, post, candidateSources, "not_interested", -100);
            }
            return addCorsHeaders(NextResponse.json({ message: "Preference updated" }, { status: 200 }));
        }

        return addCorsHeaders(NextResponse.json({ message: "Invalid action" }, { status: 400 }));

    } catch (err) {
        console.error("PATCH error:", err);
        return addCorsHeaders(NextResponse.json({ message: "Server error", error: err.message }, { status: 500 }));
    }
}

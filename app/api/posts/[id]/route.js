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

// =====================================================
// COMMENT COUNT HELPERS
//
// commentsCount:
//   Every top-level comment + every nested reply.
//
// discussionCount:
//   Number of top-level threads with:
//   - at least 5 nested replies, and
//   - at least 2 distinct participants across the root + replies.
// =====================================================

const DISCUSSION_MIN_REPLIES = 5;
const DISCUSSION_MIN_PARTICIPANTS = 2;

function getCommentParticipantKey(comment) {
    if (!comment) {
        return null;
    }

    if (comment.authorFingerprint) {
        return `device:${comment.authorFingerprint}`;
    }

    const userId = comment.authorUserId?._id || comment.authorUserId;
    if (userId) {
        return `user:${userId.toString()}`;
    }

    if (comment.authorId) {
        return `legacy:${comment.authorId.toString()}`;
    }

    const normalizedName =
        typeof comment.name === "string"
            ? comment.name.trim().toLowerCase()
            : "";

    return normalizedName
        ? `name:${normalizedName}`
        : null;
}

function countAllCommentMessages(comments) {
    if (!Array.isArray(comments) || comments.length === 0) {
        return 0;
    }

    let total = 0;

    for (const comment of comments) {
        total += 1;
        total += countAllCommentMessages(comment?.replies || []);
    }

    return total;
}

function countRepliesAndCollectParticipants(replies, participants) {
    if (!Array.isArray(replies) || replies.length === 0) {
        return 0;
    }

    let replyCount = 0;

    for (const reply of replies) {
        replyCount += 1;

        const participantKey = getCommentParticipantKey(reply);
        if (participantKey) {
            participants.add(participantKey);
        }

        replyCount += countRepliesAndCollectParticipants(
            reply?.replies || [],
            participants
        );
    }

    return replyCount;
}

function countQualifiedDiscussionThreads(topLevelComments) {
    if (
        !Array.isArray(topLevelComments)
        || topLevelComments.length === 0
    ) {
        return 0;
    }

    let discussionCount = 0;

    for (const rootComment of topLevelComments) {
        const participants = new Set();

        const rootParticipantKey =
            getCommentParticipantKey(rootComment);

        if (rootParticipantKey) {
            participants.add(rootParticipantKey);
        }

        const replyCount =
            countRepliesAndCollectParticipants(
                rootComment?.replies || [],
                participants
            );

        if (
            replyCount >= DISCUSSION_MIN_REPLIES
            && participants.size >= DISCUSSION_MIN_PARTICIPANTS
        ) {
            discussionCount += 1;
        }
    }

    return discussionCount;
}

function buildAuthorLookup(post) {
    const conditions = [];

    if (post.authorUserId) {
        conditions.push({ _id: post.authorUserId });
    }

    if (post.authorId) {
        conditions.push({ deviceId: post.authorId });
    }

    return conditions.length > 0
        ? { $or: conditions }
        : null;
}

function buildAuthorPostQuery(post) {
    const conditions = [];

    if (post.authorUserId) {
        conditions.push({ authorUserId: post.authorUserId });
    }

    if (post.authorId) {
        conditions.push({ authorId: post.authorId });
    }

    return conditions.length > 0
        ? { $or: conditions }
        : null;
}

function buildClanLookup(clanValue) {
    if (!clanValue) {
        return null;
    }

    const conditions = [
        { tag: clanValue }
    ];

    if (mongoose.Types.ObjectId.isValid(clanValue)) {
        conditions.push({
            _id: new mongoose.Types.ObjectId(clanValue)
        });
    }

    return { $or: conditions };
}

// ----------------------
// GET: Fetch single post (Enriched for PostCard)
// ----------------------
export async function GET(req, { params }) {
    const requestStartedAt = Date.now();

    try {
        const connectionStartedAt = Date.now();
        await connectDB();

        console.log(
            "Single post DB connection:",
            Date.now() - connectionStartedAt,
            "ms"
        );

        const { id } = await params;

        if (!id) {
            return addCorsHeaders(
                NextResponse.json(
                    { message: "Post identifier required" },
                    { status: 400 }
                )
            );
        }

        const deviceId =
            req.headers.get("x-user-deviceId")
            || req.headers.get("x-device-id")
            || "";

        const TRENDING_THRESHOLD = 1000;

        const postFetchStartedAt = Date.now();

        const post = id.includes("-")
            ? await Post.findOne({ slug: id }).lean()
            : mongoose.Types.ObjectId.isValid(id)
                ? await Post.findById(id).lean()
                : null;

        console.log(
            "Single post document fetch:",
            Date.now() - postFetchStartedAt,
            "ms"
        );

        if (!post) {
            return addCorsHeaders(
                NextResponse.json(
                    { message: "Post not found" },
                    { status: 404 }
                )
            );
        }

        // The single-post route already needs the complete comments tree.
        // Calculate the live values directly from that tree.
        const topLevelComments =
            Array.isArray(post.comments)
                ? post.comments
                : [];

        const commentsCount =
            countAllCommentMessages(topLevelComments);

        const discussionCount =
            countQualifiedDiscussionThreads(topLevelComments);

        // Repair old/stale counters only when necessary.
        // Under normal operation the Post model pre-save middleware keeps
        // these synchronized whenever the comment route calls post.save().
        const countersAreStale =
            Number(post.commentsCount || 0) !== commentsCount
            || Number(post.discussionCount || 0) !== discussionCount;

        if (countersAreStale) {
            const counterRepairStartedAt = Date.now();

            await Post.updateOne(
                { _id: post._id },
                {
                    $set: {
                        commentsCount,
                        discussionCount
                    }
                }
            );

            console.log(
                "Single post counter self-repair:",
                Date.now() - counterRepairStartedAt,
                "ms",
                {
                    postId: post._id.toString(),
                    previousCommentsCount:
                        Number(post.commentsCount || 0),
                    commentsCount,
                    previousDiscussionCount:
                        Number(post.discussionCount || 0),
                    discussionCount
                }
            );
        }

        const authorLookup = buildAuthorLookup(post);
        const authorPostQuery = buildAuthorPostQuery(post);
        const clanValue = post.clanTag || post.clanId;
        const clanLookup = buildClanLookup(clanValue);

        const relatedStartedAt = Date.now();

        const [
            authorPostCount,
            authorUser,
            clanDocument
        ] = await Promise.all([
            authorPostQuery
                ? Post.countDocuments({
                    ...authorPostQuery,
                    status: "approved"
                })
                : Promise.resolve(0),

            authorLookup
                ? MobileUser.findOne(authorLookup)
                    .select(
                        "username profilePic lastStreak previousRank "
                        + "peakLevel aura inventory specialInventory "
                        + "currentRankLevel equippedTitle"
                    )
                    .lean()
                : Promise.resolve(null),

            clanLookup
                ? Clan.findOne(clanLookup).lean()
                : Promise.resolve(null)
        ]);

        console.log(
            "Single post enrichment:",
            Date.now() - relatedStartedAt,
            "ms"
        );

        let authorData = null;

        if (authorUser) {
            const inventory =
                Array.isArray(authorUser.inventory)
                    ? authorUser.inventory
                    : Array.isArray(authorUser.specialInventory)
                        ? authorUser.specialInventory
                        : [];

            const rankInfo =
                resolveUserRankServer(
                    authorUser.currentRankLevel || 1
                );

            const auraInfo =
                getAuraVisualsServer(
                    authorUser.previousRank || 0
                );

            authorData = {
                name: authorUser.username,
                image: authorUser.profilePic?.url || null,
                streak: authorUser.lastStreak || 0,
                rank: authorUser.previousRank || 0,
                peakLevel: authorUser.peakLevel || 0,
                aura: authorUser.aura || 0,
                inventory,
                rankLevel:
                    authorUser.currentRankLevel || 1,
                displayRank: rankInfo.rankName,
                auraVisuals: auraInfo,
                equippedGlow:
                    inventory.find(item =>
                        (
                            item.category === "GLOW"
                            || item.category === "NAME_GLOW"
                        )
                        && item.isEquipped
                    ) || null,
                equippedBadges:
                    inventory
                        .filter(item =>
                            item.category === "BADGE"
                            && item.isEquipped
                        )
                        .slice(0, 3),
                equippedTitle:
                    authorUser.equippedTitle || null
            };
        }

        const clanData = clanDocument
            ? {
                ...clanDocument,
                displayRank:
                    resolveClanDisplayRank(
                        clanDocument.totalPoints || 0
                    )
            }
            : null;

        const feedMessage = post.message
            ? post.message
                .replace(
                    /s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs,
                    "$1$2$3$4$5$6$8$10"
                )
                .replace(/\n+/g, " ")
                .trim()
            : "";

        const postLikes =
            Array.isArray(post.likes)
                ? post.likes
                : [];

        const hasLiked = Boolean(
            deviceId
            && postLikes.some(like =>
                like === deviceId
                || like?.fingerprint === deviceId
                || like?.deviceId === deviceId
            )
        );

        const hasViewed = Boolean(
            deviceId
            && Array.isArray(post.viewsFingerprints)
            && post.viewsFingerprints.includes(deviceId)
        );

        let pollVoteStatus = {
            hasVoted: false,
            userVotedOptions: []
        };

        if (
            deviceId
            && post.poll
            && Array.isArray(post.voters)
        ) {
            const voterMatch = post.voters.find(voter =>
                voter === deviceId
                || voter?.fingerprint === deviceId
            );

            pollVoteStatus = {
                hasVoted: Boolean(voterMatch),
                userVotedOptions:
                    voterMatch?.selectedOptions || []
            };
        }

        const likesCount =
            post.likesCount
            ?? post.likeCount
            ?? postLikes.length
            ?? 0;

        const hypePoints =
            Number(post.hypePoints || 0);

        const hypeCount =
            Number(post.hypeCount || 0);

        const viewsCount =
            post.viewsCount
            ?? post.views
            ?? 0;

        const sharesCount =
            post.sharesCount
            ?? post.shares
            ?? 0;

        const isTrending =
            hypePoints >= TRENDING_THRESHOLD;

        const responseData = {
            ...post,

            // Replace possibly stale stored values with live values.
            commentsCount,
            discussionCount,

            authorPostCount,
            authorData,
            clanData,

            feedExcerpt:
                feedMessage.length > 150
                    ? `${feedMessage.slice(0, 150)}...`
                    : feedMessage,

            formattedViews:
                formatViewsServer(viewsCount),

            likesCount,
            hypePoints,
            hypeCount,
            hypePointsCount: hypePoints,
            viewsCount,
            sharesCount,

            isTrending,
            hasLiked,
            hasViewed,

            poll: post.poll
                ? {
                    ...post.poll,
                    ...pollVoteStatus
                }
                : post.poll
        };

        const responseStartedAt = Date.now();

        const response = addCorsHeaders(
            NextResponse.json(responseData)
        );

        console.log(
            "Single post response construction:",
            Date.now() - responseStartedAt,
            "ms"
        );

        console.log(
            "Total single post request:",
            Date.now() - requestStartedAt,
            "ms",
            {
                commentsCount,
                discussionCount,
                repairedCounters: countersAreStale
            }
        );

        return response;

    } catch (err) {
        console.error("Single Post Fetch Error:", err);

        const status =
            err?.name === "CastError"
                ? 400
                : 500;

        return addCorsHeaders(
            NextResponse.json(
                {
                    message:
                        status === 400
                            ? "Invalid post identifier"
                            : "Server error",
                    error: err.message
                },
                { status }
            )
        );
    }
}

// 🚀 SCALING: In-memory IP Cache to save rate limits
const ipCache = new Map();

// ----------------------
// 🧠 UNIFIED HELPER: Telemetry, Affinity, Decay, & Optimization
// ----------------------
async function processTelemetryAndAffinity(
    fingerprint,
    post,
    candidateSources,
    action,
    weight
) {
    if (!fingerprint || !post) return;

    try {
        const user = await MobileUser.findOne({ deviceId: fingerprint })
            .select("_id affinityScores authorAffinity countryAffinity feedLearning")
            .lean();

        if (!user) return;

        const tagWeight = Number(weight) || 0;
        const authorWeight = Math.round(tagWeight * 0.5);
        const countryWeight = Math.round(tagWeight * 0.25);

        let affinityScores = user.affinityScores
            ? (
                user.affinityScores instanceof Map
                    ? Object.fromEntries(user.affinityScores)
                    : { ...user.affinityScores }
            )
            : {};

        let authorAffinity = user.authorAffinity
            ? (
                user.authorAffinity instanceof Map
                    ? Object.fromEntries(user.authorAffinity)
                    : { ...user.authorAffinity }
            )
            : {};

        let countryAffinity = user.countryAffinity
            ? (
                user.countryAffinity instanceof Map
                    ? Object.fromEntries(user.countryAffinity)
                    : { ...user.countryAffinity }
            )
            : {};

        const updateAndTrim = (obj, key, addWeight, limit) => {
            if (!key || !Number.isFinite(addWeight) || addWeight === 0) {
                return obj;
            }

            const sanitizedKey = String(key)
                .replace(/\./g, "_")
                .replace(/\$/g, "");

            if (!sanitizedKey) return obj;

            const current = typeof obj[sanitizedKey] === "number"
                ? obj[sanitizedKey]
                : 0;

            const nextValue = current + addWeight;

            // Negative feedback removes learned affinity rather than leaving a
            // negative value that the GET ranker currently treats as a fallback.
            if (nextValue <= 0) {
                delete obj[sanitizedKey];
            } else {
                obj[sanitizedKey] = Math.min(5000, nextValue);
            }

            if (Object.keys(obj).length > limit + 10) {
                return Object.fromEntries(
                    Object.entries(obj)
                        .sort((a, b) => b[1] - a[1])
                        .slice(0, limit)
                );
            }

            return obj;
        };

        if (Array.isArray(post.interests)) {
            post.interests.forEach(tag => {
                if (tag) {
                    affinityScores = updateAndTrim(
                        affinityScores,
                        tag.trim().toLowerCase(),
                        tagWeight,
                        50
                    );
                }
            });
        }

        const postAuthorUserId = post.authorUserId?.toString();
        const postAuthorDeviceId = post.authorId?.toString();
        const isOwnPost =
            postAuthorDeviceId === fingerprint
            || postAuthorUserId === user._id?.toString();

        const targetAuthor = postAuthorUserId || postAuthorDeviceId;
        if (targetAuthor && !isOwnPost) {
            authorAffinity = updateAndTrim(
                authorAffinity,
                targetAuthor,
                authorWeight,
                30
            );
        }

        if (
            post.country
            && post.country !== "Global"
            && post.country !== "Unknown"
        ) {
            countryAffinity = updateAndTrim(
                countryAffinity,
                post.country,
                countryWeight,
                10
            );
        }

        const actionMap = {
            view: "impressions",
            like: "likes",
            share: "shares",
            vote: "votes",
            watch_complete: "watch_complete",
            skip: "skips",
            not_interested: "skips",
            comment: "comments",
            hype: "votes"
        };

        const metric = actionMap[action];
        const validPools = [
            "fresh",
            "author",
            "clan",
            "interest",
            "trending",
            "explore"
        ];
        const incUpdates = {};

        if (
            metric
            && Array.isArray(candidateSources)
            && candidateSources.length > 0
        ) {
            const uniqueTypes = [
                ...new Set(
                    candidateSources
                        .slice(0, 20)
                        .map(source => source?.type)
                        .filter(type => validPools.includes(type))
                )
            ];

            if (uniqueTypes.length > 0) {
                const POOL_CONFIDENCE = {
                    explore: 1,
                    fresh: 1,
                    clan: 2,
                    trending: 4,
                    interest: 4,
                    author: 4
                };

                const scoredSources = uniqueTypes.map(type => ({
                    type,
                    confidence: POOL_CONFIDENCE[type] || 1
                }));

                const totalConfidence = scoredSources.reduce(
                    (sum, source) => sum + source.confidence,
                    0
                );

                let assignedFraction = 0;

                scoredSources.forEach((source, index) => {
                    const isLast = index === scoredSources.length - 1;
                    const normalizedFraction = isLast
                        ? Number((1 - assignedFraction).toFixed(3))
                        : Number(
                            (
                                source.confidence / totalConfidence
                            ).toFixed(3)
                        );

                    assignedFraction += normalizedFraction;

                    if (
                        Number.isFinite(normalizedFraction)
                        && normalizedFraction > 0
                    ) {
                        incUpdates[
                            `feedLearning.sourceStats.${source.type}.${metric}`
                        ] = normalizedFraction;
                    }
                });
            }
        }

        const setUpdates = {
            affinityScores,
            authorAffinity,
            countryAffinity
        };

        if (user.feedLearning) {
            const lastOptimizedAt = new Date(
                user.feedLearning.lastOptimizedAt || 0
            );
            const stats = user.feedLearning.sourceStats || {};

            let totalImpressions = 0;
            validPools.forEach(pool => {
                totalImpressions += stats[pool]?.impressions || 0;
            });

            if (
                metric === "impressions"
                && Object.keys(incUpdates).length > 0
            ) {
                totalImpressions += 1;
            }

            const twentyFourHours = 24 * 60 * 60 * 1000;

            if (
                Date.now() - lastOptimizedAt.getTime() >= twentyFourHours
                && totalImpressions >= 100
            ) {
                const decayMap = (mapObject, factor = 0.98) => {
                    for (const key of Object.keys(mapObject)) {
                        mapObject[key] = Number(
                            (mapObject[key] * factor).toFixed(2)
                        );

                        if (mapObject[key] < 1) {
                            delete mapObject[key];
                        }
                    }
                };

                decayMap(setUpdates.affinityScores);
                decayMap(setUpdates.authorAffinity);
                decayMap(setUpdates.countryAffinity);

                let totalScore = 0;
                const rawScores = {};

                validPools.forEach(pool => {
                    const sourceStats = stats[pool] || {};
                    const impressions =
                        (sourceStats.impressions || 0)
                        + (
                            incUpdates[
                            `feedLearning.sourceStats.${pool}.impressions`
                            ] || 0
                        );

                    let score;

                    if (impressions < 20) {
                        score = 50;
                    } else {
                        const rate = metricName =>
                            (
                                (sourceStats[metricName] || 0)
                                + (
                                    incUpdates[
                                    `feedLearning.sourceStats.${pool}.${metricName}`
                                    ] || 0
                                )
                            ) / impressions;

                        score =
                            10
                            + rate("likes") * 50
                            + rate("votes") * 50
                            + rate("watch_complete") * 80
                            + rate("comments") * 100
                            + rate("shares") * 150
                            - rate("skips") * 60;
                    }

                    rawScores[pool] = Math.max(10, score);
                    totalScore += rawScores[pool];
                });

                const newWeights = {};
                validPools.forEach(pool => {
                    newWeights[pool] = rawScores[pool] / totalScore;
                });

                let clampedTotal = 0;
                validPools.forEach(pool => {
                    newWeights[pool] = Math.max(
                        0.05,
                        Math.min(0.45, newWeights[pool])
                    );
                    clampedTotal += newWeights[pool];
                });

                let assignedWeight = 0;
                validPools.forEach((pool, index) => {
                    const isLast = index === validPools.length - 1;
                    const normalizedWeight = isLast
                        ? Number((1 - assignedWeight).toFixed(3))
                        : Number(
                            (
                                newWeights[pool] / clampedTotal
                            ).toFixed(3)
                        );

                    newWeights[pool] = normalizedWeight;
                    assignedWeight += normalizedWeight;
                });

                setUpdates["feedLearning.poolWeights"] = newWeights;
                setUpdates["feedLearning.lastOptimizedAt"] = new Date();

                Object.keys(incUpdates).forEach(key => {
                    delete incUpdates[key];
                });

                validPools.forEach(pool => {
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.impressions`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.likes`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.votes`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.watch_complete`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.comments`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.shares`
                    ] = 0;
                    setUpdates[
                        `feedLearning.sourceStats.${pool}.skips`
                    ] = 0;
                });

                console.log(
                    `[ML] Epoch closed for ${fingerprint}:`,
                    newWeights
                );
            }
        }

        const updateOperation = { $set: setUpdates };

        if (Object.keys(incUpdates).length > 0) {
            updateOperation.$inc = incUpdates;
        }

        await MobileUser.updateOne(
            { _id: user._id },
            updateOperation
        );
    } catch (err) {
        console.error("❌ Unified Telemetry Error:", err);
    }
}

import Report from "@/app/models/ReportModel";
import mongoose from "mongoose";

const INTERACTION_POST_FIELDS = [
    "_id",
    "authorId",
    "authorUserId",
    "title",
    "slug",
    "mediaUrl",
    "clanId",
    "interests",
    "country",
    "likesCount",
    "likeCount",
    "commentsCount",
    "discussionCount",
    "hypePoints",
    "hypeCount",
    "shares",
    "views",
    "poll"
].join(" ");

function getRequestFingerprint(req, body = {}) {
    return (
        req.headers.get("x-user-deviceId")
        || req.headers.get("x-device-id")
        || body.fingerprint
        || body.deviceId
        || ""
    );
}

function getAuthorQuery(post) {
    if (post?.authorUserId) {
        return { _id: post.authorUserId };
    }

    if (post?.authorId) {
        return { deviceId: post.authorId };
    }

    return null;
}

function getNonSelfAuthorQuery(post, fingerprint) {
    const authorQuery = getAuthorQuery(post);

    if (!authorQuery) return null;

    if (post?.authorId && post.authorId.toString() === fingerprint) {
        return null;
    }

    if (post?.authorUserId) {
        return {
            ...authorQuery,
            deviceId: { $ne: fingerprint }
        };
    }

    return authorQuery;
}

function buildCompactInteractionResponse(post, extra = {}) {
    if (!post) return extra;

    return {
        _id: post._id?.toString(),
        likesCount: post.likesCount ?? post.likeCount ?? 0,
        commentsCount: post.commentsCount ?? 0,
        discussionCount: post.discussionCount ?? 0,
        hypePoints: post.hypePoints ?? 0,
        hypeCount: post.hypeCount ?? 0,
        shares: post.shares ?? 0,
        views: post.views ?? 0,
        viewsCount: post.views ?? 0,
        ...extra
    };
}

async function findTelemetryPost(id) {
    return Post.findById(id)
        .select(
            "_id authorId authorUserId interests country clanId"
        )
        .lean();
}

// ----------------------
// PATCH: Handle Likes, Views, Shares, Votes, Reports
// ----------------------
export async function PATCH(req, { params }) {
    const connectionStartedAt = Date.now();

    try {
        await connectDB();

        console.log(
            "Post PATCH DB connection:",
            Date.now() - connectionStartedAt,
            "ms"
        );

        const { id } = await params;
        const body = await req.json();
        const {
            action,
            payload = {},
            candidateSources = []
        } = body;

        const fingerprint = getRequestFingerprint(req, body);
        const safeCandidateSources = Array.isArray(candidateSources)
            ? candidateSources.slice(0, 20)
            : [];

        const ip = getClientIp(req);
        const isBot = await isBotRequest(req, ip);

        if (action === "report") {
            const reason = payload?.reason?.trim();

            if (!fingerprint) {
                return addCorsHeaders(
                    NextResponse.json(
                        { message: "Authentication required" },
                        { status: 401 }
                    )
                );
            }

            if (!reason) {
                return addCorsHeaders(
                    NextResponse.json(
                        { message: "Report reason is required" },
                        { status: 400 }
                    )
                );
            }

            const updatedPost = await Post.findOneAndUpdate(
                {
                    _id: id,
                    reportedBy: { $ne: fingerprint }
                },
                {
                    $inc: { reportCount: 1 },
                    $addToSet: { reportedBy: fingerprint }
                },
                { new: true }
            ).select(INTERACTION_POST_FIELDS);

            if (!updatedPost) {
                const postExists = await Post.exists({ _id: id });

                return addCorsHeaders(
                    NextResponse.json(
                        {
                            message: postExists
                                ? "You have already reported this transmission."
                                : "Post not found"
                        },
                        { status: postExists ? 400 : 404 }
                    )
                );
            }

            try {
                await Report.create({
                    targetId: id,
                    targetType: "post",
                    reporterFingerprint: fingerprint,
                    reason
                });
            } catch (reportError) {
                console.error(
                    "Report ledger write failed:",
                    reportError
                );
            }

            if (!isBot) {
                await processTelemetryAndAffinity(
                    fingerprint,
                    updatedPost,
                    safeCandidateSources,
                    "report",
                    -150
                );
            }

            return addCorsHeaders(
                NextResponse.json(
                    { message: "Report submitted successfully." },
                    { status: 200 }
                )
            );
        }

        if (action === "vote") {
            if (!fingerprint) {
                return addCorsHeaders(
                    NextResponse.json(
                        { message: "Authentication required" },
                        { status: 401 }
                    )
                );
            }

            const selectedOptions = [
                ...new Set(
                    Array.isArray(payload?.selectedOptions)
                        ? payload.selectedOptions
                            .map(Number)
                            .filter(Number.isInteger)
                        : []
                )
            ];

            const pollPost = await Post.findById(id)
                .select("poll")
                .lean();

            if (!pollPost) {
                return addCorsHeaders(
                    NextResponse.json(
                        { message: "Post not found" },
                        { status: 404 }
                    )
                );
            }

            const optionCount = pollPost.poll?.options?.length || 0;

            if (
                optionCount === 0
                || selectedOptions.length === 0
                || selectedOptions.some(
                    index => index < 0 || index >= optionCount
                )
            ) {
                return addCorsHeaders(
                    NextResponse.json(
                        { message: "Invalid poll selection" },
                        { status: 400 }
                    )
                );
            }

            if (
                !pollPost.poll?.pollMultiple
                && selectedOptions.length > 1
            ) {
                return addCorsHeaders(
                    NextResponse.json(
                        { message: "This poll accepts one option only" },
                        { status: 400 }
                    )
                );
            }

            const incUpdates = {};
            selectedOptions.forEach(index => {
                incUpdates[`poll.options.${index}.votes`] = 1;
            });

            const updatedPost = await Post.findOneAndUpdate(
                {
                    _id: id,
                    $nor: [
                        { voters: fingerprint },
                        { "voters.fingerprint": fingerprint }
                    ]
                },
                {
                    $push: {
                        voters: {
                            fingerprint,
                            selectedOptions
                        }
                    },
                    $inc: incUpdates
                },
                { new: true }
            ).select(INTERACTION_POST_FIELDS);

            if (!updatedPost) {
                return addCorsHeaders(
                    NextResponse.json(
                        { message: "Already voted" },
                        { status: 400 }
                    )
                );
            }

            await processTelemetryAndAffinity(
                fingerprint,
                updatedPost,
                safeCandidateSources,
                "vote",
                5
            );

            const authorQuery = getNonSelfAuthorQuery(
                updatedPost,
                fingerprint
            );
            if (authorQuery) {
                const author = await MobileUser.findOne(authorQuery)
                    .select("_id deviceId pushToken profilePic");

                if (
                    author
                    && author.deviceId !== fingerprint
                ) {
                    await Promise.all([
                        awardAura(author._id, 5),
                        awardClanPoints(updatedPost, 10, "vote")
                    ]);

                    if (author.pushToken) {
                        const shortTitle =
                            updatedPost.title?.substring(0, 15)
                            || "your post";

                        await sendPillParallel(
                            [author.pushToken],
                            `New Vote! ✅ on post: "${shortTitle}"`,
                            `Someone voted on your post: "${shortTitle}"`,
                            {
                                postId: updatedPost._id.toString(),
                                type: "post_detail",
                                mediaUrl: updatedPost.mediaUrl,
                                authorPfp: author.profilePic?.url
                            },
                            {
                                type: "post_vote",
                                targetAudience: "user",
                                targetId: author._id.toString(),
                                singleUser: true,
                                link: `/post/${updatedPost.slug}`,
                                priority: 2
                            }
                        );
                    }
                }
            }

            return addCorsHeaders(
                NextResponse.json(
                    {
                        message: "Vote added",
                        selectedOptions
                    },
                    { status: 200 }
                )
            );
        }

        if (action === "like") {
            if (!fingerprint) {
                return addCorsHeaders(
                    NextResponse.json(
                        { message: "Authentication required" },
                        { status: 401 }
                    )
                );
            }

            const newLike = {
                deviceId: fingerprint,
                fingerprint,
                date: new Date()
            };

            const updatedPost = await Post.findOneAndUpdate(
                {
                    _id: id,

                    // New embedded-document formats.
                    "likes.fingerprint": { $ne: fingerprint },
                    "likes.deviceId": { $ne: fingerprint },

                    // Legacy likes may be stored as raw fingerprint strings.
                    // Use $expr so Mongoose does not try to cast the UUID
                    // string into a likeSchema subdocument.
                    $expr: {
                        $not: [
                            {
                                $in: [
                                    fingerprint,
                                    { $ifNull: ["$likes", []] }
                                ]
                            }
                        ]
                    }
                },
                {
                    $inc: {
                        likesCount: 1,
                        likeCount: 1
                    },
                    // Do not truncate this array while it is still the
                    // source of truth for duplicate-like checks and hasLiked.
                    // Move likes to a separate collection before introducing
                    // retention limits.
                    $push: {
                        likes: newLike
                    }
                },
                { new: true }
            ).select(INTERACTION_POST_FIELDS);

            if (!updatedPost) {
                return addCorsHeaders(
                    NextResponse.json(
                        { message: "Already liked" },
                        { status: 400 }
                    )
                );
            }

            await processTelemetryAndAffinity(
                fingerprint,
                updatedPost,
                safeCandidateSources,
                "like",
                10
            );

            const authorQuery = getNonSelfAuthorQuery(
                updatedPost,
                fingerprint
            );
            if (authorQuery) {
                const author = await MobileUser.findOneAndUpdate(
                    authorQuery,
                    { $inc: { totalLikes: 1 } },
                    { new: true }
                );

                if (author) {
                    await Promise.all([
                        awardAura(author._id, 5),
                        awardClanPoints(updatedPost, 10, "like"),
                        checkTitleUnlocks(
                            author,
                            "totalLikes",
                            author.totalLikes || 0
                        )
                    ]);

                    if (author.pushToken) {
                        const shortTitle =
                            updatedPost.title?.substring(0, 15)
                            || "your post";

                        await sendPillParallel(
                            [author.pushToken],
                            `New Like on post: "${shortTitle}"`,
                            `Someone liked your post: "${shortTitle}"`,
                            {
                                postId: updatedPost._id.toString(),
                                type: "post_detail",
                                mediaUrl: updatedPost.mediaUrl,
                                authorPfp: author.profilePic?.url
                            },
                            {
                                type: "post_like",
                                targetAudience: "user",
                                targetId: author._id.toString(),
                                singleUser: true,
                                link: `/post/${updatedPost.slug}`,
                                priority: 2
                            }
                        );
                    }

                    const milestones = [5, 10, 25, 50, 100];
                    const likesCount =
                        updatedPost.likesCount
                        ?? updatedPost.likeCount
                        ?? 0;

                    if (
                        milestones.includes(likesCount)
                        && author.pushToken
                    ) {
                        await sendPillParallel(
                            [author.pushToken],
                            "Going Viral!",
                            `🔥 Trending! Your post reached ${likesCount} likes!`,
                            {
                                postId: updatedPost._id.toString(),
                                type: "post_detail",
                                mediaUrl: updatedPost.mediaUrl,
                                authorPfp: author.profilePic?.url
                            },
                            {
                                type: "event",
                                targetAudience: "user",
                                targetId: author._id.toString(),
                                singleUser: true,
                                link: `/post/${updatedPost.slug}`,
                                priority: 2
                            }
                        );
                    }
                }
            }

            return addCorsHeaders(
                NextResponse.json(
                    buildCompactInteractionResponse(
                        updatedPost,
                        { hasLiked: true }
                    ),
                    { status: 200 }
                )
            );
        }

        if (action === "share") {
            const updatedPost = await Post.findByIdAndUpdate(
                id,
                { $inc: { shares: 1 } },
                { new: true }
            ).select(INTERACTION_POST_FIELDS);

            if (!updatedPost) {
                return addCorsHeaders(
                    NextResponse.json(
                        { message: "Post not found" },
                        { status: 404 }
                    )
                );
            }

            if (fingerprint && !isBot) {
                await processTelemetryAndAffinity(
                    fingerprint,
                    updatedPost,
                    safeCandidateSources,
                    "share",
                    15
                );
            }

            const authorQuery = fingerprint
                ? getNonSelfAuthorQuery(updatedPost, fingerprint)
                : getAuthorQuery(updatedPost);
            if (authorQuery) {
                const author = await MobileUser.findOneAndUpdate(
                    authorQuery,
                    { $inc: { totalShares: 1 } },
                    { new: true }
                );

                if (author) {
                    await Promise.all([
                        awardAura(author._id, 3),
                        awardClanPoints(updatedPost, 20, "share"),
                        checkTitleUnlocks(
                            author,
                            "totalShares",
                            author.totalShares || 0
                        )
                    ]);
                }
            }

            return addCorsHeaders(
                NextResponse.json(
                    buildCompactInteractionResponse(updatedPost),
                    { status: 200 }
                )
            );
        }

        if (action === "view") {
            if (!fingerprint || isBot) {
                return addCorsHeaders(
                    NextResponse.json(
                        {
                            message: "View ignored",
                            counted: false
                        },
                        { status: 200 }
                    )
                );
            }

            const updatedPost = await Post.findOneAndUpdate(
                {
                    _id: id,
                    viewsFingerprints: { $ne: fingerprint }
                },
                {
                    $inc: { views: 1 },
                    $push: {
                        viewsFingerprints: {
                            $each: [fingerprint],
                            $slice: -500
                        }
                    }
                },
                { new: true }
            ).select(INTERACTION_POST_FIELDS);

            if (!updatedPost) {
                const postExists = await Post.exists({ _id: id });

                return addCorsHeaders(
                    NextResponse.json(
                        postExists
                            ? {
                                message: "View already counted",
                                counted: false,
                                hasViewed: true
                            }
                            : { message: "Post not found" },
                        { status: postExists ? 200 : 404 }
                    )
                );
            }

            let country = "Unknown";
            let city = "Unknown";
            let timezone = "Unknown";
            const nowMs = Date.now();

            if (
                ip
                && ipCache.has(ip)
                && nowMs - ipCache.get(ip).timestamp
                < 24 * 60 * 60 * 1000
            ) {
                const cached = ipCache.get(ip);
                country = cached.country;
                city = cached.city;
                timezone = cached.timezone;
            } else if (ip) {
                try {
                    const geoResponse = await fetch(
                        `https://ipinfo.io/${ip}/json`,
                        {
                            signal: AbortSignal.timeout(1500)
                        }
                    );
                    const geoData = await geoResponse.json();

                    country = geoData.country || "Unknown";
                    city = geoData.city || "Unknown";
                    timezone = geoData.timezone || "Unknown";

                    ipCache.set(ip, {
                        country,
                        city,
                        timezone,
                        timestamp: nowMs
                    });

                    if (ipCache.size > 10000) {
                        ipCache.clear();
                    }
                } catch (geoError) {
                    console.log("Geo lookup failed");
                }
            }

            const authorQuery = getNonSelfAuthorQuery(
                updatedPost,
                fingerprint
            );

            const [, author] = await Promise.all([
                Post.updateOne(
                    { _id: id },
                    {
                        $push: {
                            viewsData: {
                                $each: [
                                    {
                                        visitorFingerprint: fingerprint,
                                        visitorId: fingerprint,
                                        ip,
                                        country,
                                        city,
                                        timezone,
                                        timestamp: new Date()
                                    }
                                ],
                                $slice: -100
                            }
                        }
                    }
                ),
                authorQuery
                    ? MobileUser.findOneAndUpdate(
                        authorQuery,
                        { $inc: { totalViews: 1 } },
                        { new: true }
                    )
                    : Promise.resolve(null),
                processTelemetryAndAffinity(
                    fingerprint,
                    updatedPost,
                    safeCandidateSources,
                    "view",
                    1
                )
            ]);

            if (author) {
                if ((updatedPost.views || 0) % 5 === 0) {
                    await Promise.all([
                        awardAura(author._id, 2),
                        awardClanPoints(updatedPost, 5, "view")
                    ]);
                }

                await checkTitleUnlocks(
                    author,
                    "totalViews",
                    author.totalViews || 0
                );
            }

            return addCorsHeaders(
                NextResponse.json(
                    buildCompactInteractionResponse(
                        updatedPost,
                        {
                            counted: true,
                            hasViewed: true
                        }
                    ),
                    { status: 200 }
                )
            );
        }

        if (
            action === "watch_complete"
            || action === "skip"
            || action === "not_interested"
        ) {
            if (!fingerprint || isBot) {
                return addCorsHeaders(
                    NextResponse.json(
                        { message: "Telemetry ignored" },
                        { status: 200 }
                    )
                );
            }

            const post = await findTelemetryPost(id);

            if (!post) {
                return addCorsHeaders(
                    NextResponse.json(
                        { message: "Post not found" },
                        { status: 404 }
                    )
                );
            }

            const actionWeights = {
                watch_complete: 8,
                skip: -6,
                not_interested: -100
            };

            await processTelemetryAndAffinity(
                fingerprint,
                post,
                safeCandidateSources,
                action,
                actionWeights[action]
            );

            const messages = {
                watch_complete: "Watch logged",
                skip: "Skip logged",
                not_interested: "Preference updated"
            };

            return addCorsHeaders(
                NextResponse.json(
                    { message: messages[action] },
                    { status: 200 }
                )
            );
        }

        return addCorsHeaders(
            NextResponse.json(
                { message: "Invalid action" },
                { status: 400 }
            )
        );
    } catch (err) {
        console.error("PATCH error:", err);

        const status = err?.name === "CastError" ? 400 : 500;

        return addCorsHeaders(
            NextResponse.json(
                {
                    message:
                        status === 400
                            ? "Invalid post id"
                            : "Server error",
                    error: err.message
                },
                { status }
            )
        );
    }
}

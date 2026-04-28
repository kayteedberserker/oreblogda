import { awardAura } from "@/app/lib/auraManager";
import { awardClanPoints } from "@/app/lib/clanService";
import { sendPillParallel } from "@/app/lib/messagePillService";
import connectDB from "@/app/lib/mongodb";
import { sendPushNotification } from "@/app/lib/pushNotifications";
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
    if (!rank || rank > 10 || rank <= 0) return { color: '#1e293b', label: 'OPERATIVE', icon: 'target' };
    switch (rank) {
        case 1: return { color: '#fbbf24', label: 'MONARCH', icon: 'crown' };
        case 2: return { color: '#ef4444', label: 'YONKO', icon: 'flare' };
        case 3: return { color: '#a855f7', label: 'KAGE', icon: 'moon-waxing-crescent' };
        case 4: return { color: '#3b82f6', label: 'SHOGUN', icon: 'shield-star' };
        case 5: return { color: '#e0f2fe', label: 'ESPADA 0', icon: 'skull' };
        case 6: return { color: '#cbd5e1', label: 'ESPADA 1', icon: 'sword-cross' };
        case 7: return { color: '#94a3b8', label: 'ESPADA 2', icon: 'sword-cross' };
        case 8: return { color: '#64748b', label: 'ESPADA 3', icon: 'sword-cross' };
        case 9: return { color: '#475569', label: 'ESPADA 4', icon: 'sword-cross' };
        case 10: return { color: '#334155', label: 'ESPADA 5', icon: 'sword-cross' };
        default: return { color: '#1e293b', label: 'OPERATIVE', icon: 'target' };
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
                const titleMsg = `🏆 NEW TITLE UNLOCKED: You are now a "${earnedTitle.name}"!`;

                await sendPushNotification(
                    user.pushToken,
                    "New Achievement! 🎖",
                    titleMsg,
                    { type: "achievement" }
                );

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

// ----------------------
// PATCH: Handle Likes, Views, Shares, Votes
// ----------------------
export async function PATCH(req, { params }) {
    await connectDB();
    const resolvedParams = await params;
    const { id } = resolvedParams;

    try {
        const body = await req.json();

        const { action, payload, fingerprint } = body;
        const ip = getClientIp(req);
        const isBot = await isBotRequest(req, ip);

        // --- 1. VOTE LOGIC ---
        if (action === "vote") {
            const { selectedOptions } = payload; // Array of indices

            const post = await Post.findOneAndUpdate(
                { _id: id, voters: { $ne: fingerprint } },
                { $addToSet: { voters: fingerprint } },
                { new: true }
            );

            if (!post) {
                return addCorsHeaders(NextResponse.json({ message: "Already voted or post missing" }, { status: 400 }));
            }

            if (post.poll && Array.isArray(post.poll.options)) {
                for (const index of selectedOptions) {
                    if (post.poll.options[index]) {
                        await Post.updateOne(
                            { _id: id },
                            { $inc: { [`poll.options.${index}.votes`]: 1 } }
                        );
                    }
                }
            }

            // ✨ AURA LOGIC: +5 for Voting
            if (post.authorId !== fingerprint) {
                const author = await MobileUser.findOne({ deviceId: post.authorId });

                if (author) {
                    // ⚡️ Replaced manual $inc with centralized Aura Manager
                    await awardAura(author._id, 5);

                    // 🛡️ CLAN: Only if the post is a Clan Post
                    await awardClanPoints(post, 10);
                    const msg = `Someone voted on your post: "${post.title.substring(0, 15)}..."`;

                    if (author.pushToken) {
                        // 🔔 GROUPING ADDED: Uses "vote_<PostID>" so votes stack
                        await sendPushNotification(
                            author.pushToken,
                            "New Vote! ✅",
                            msg,
                            { postId: post._id.toString(), type: "post_detail" },
                            `vote_${post._id}`
                        );
                    }
                }
            }

            return addCorsHeaders(NextResponse.json({ message: "Vote added" }, { status: 200 }));
        }

        // --- 2. LIKE LOGIC ---
        if (action === "like") {
            const updatedPost = await Post.findOneAndUpdate(
                {
                    _id: id,
                    "likes.fingerprint": { $ne: fingerprint } // Still check fingerprints for dupes
                },
                {
                    $inc: { likeCount: 1 }, // Increment total count
                    $push: {
                        likes: {
                            $each: [{ fingerprint, date: new Date() }],
                            $slice: -600 // Keep only the 600 most recent likes
                        }
                    }
                },
                { new: true }
            );

            if (!updatedPost) {
                return addCorsHeaders(NextResponse.json({ message: "Already liked" }, { status: 400 }));
            }

            // ✨ AURA & CLAN LOGIC
            if (updatedPost.authorId !== fingerprint) {
                // ⚡️ INCREMENT STATS: Incrementing author's total global likes
                const author = await MobileUser.findOneAndUpdate(
                    { deviceId: updatedPost.authorId },
                    { $inc: { totalLikes: 1 } },
                    { new: true }
                );

                if (author) {
                    // ⚡️ Centralized Aura Manager
                    await awardAura(author._id, 5);
                    await awardClanPoints(updatedPost, 10, 'like');

                    // 🏆 TITLE LOGIC: Check for Like Milestone
                    await checkTitleUnlocks(author, "totalLikes", author.totalLikes || 0);

                    // Handle Notifications
                    const msg = `Someone liked your post: "${updatedPost.title.substring(0, 15)}..."`;

                    if (author.pushToken) {
                        const tokens = [author.pushToken];
                        await sendPillParallel(
                            tokens,
                            `New Like on post: "${updatedPost.title.substring(0, 10)}..."`,
                            msg,
                            { postId: updatedPost._id.toString(), type: "post_detail" },
                            {
                                type: 'post_like',
                                targetAudience: 'user',
                                targetId: author._id.toString(),
                                singleUser: true,
                                link: `/post/${updatedPost.slug}`,
                                priority: 2
                            }
                        );
                    }

                    // Milestone Notifications (Trending)
                    const milestones = [5, 10, 25, 50, 100];
                    if (milestones.includes(updatedPost.likes.length)) {
                        const mMsg = `🔥 Trending! Your post reached ${updatedPost.likes.length} likes!`;

                        if (author.pushToken) {
                            await sendPushNotification(
                                author.pushToken,
                                "Going Viral!",
                                mMsg,
                                { postId: updatedPost._id.toString(), type: "post_detail" },
                                `milestone_${updatedPost._id}`
                            );
                        }
                    }
                }
            }

            return addCorsHeaders(NextResponse.json(updatedPost, { status: 200 }));
        }

        // --- 3. SHARE LOGIC ---
        if (action === "share") {
            const updatedPost = await Post.findByIdAndUpdate(id, { $inc: { shares: 1 } }, { new: true });

            // ✨ AURA LOGIC: +3 for Sharing
            if (updatedPost && updatedPost.authorId !== fingerprint) {
                // ⚡️ INCREMENT STATS: Incrementing author's total global likes
                const author = await MobileUser.findOneAndUpdate(
                    { deviceId: updatedPost.authorId },
                    { $inc: { totalShares: 1 } },
                    { new: true }
                );
                if (author) {
                    // ⚡️ Centralized Aura Manager
                    await awardAura(author._id, 3);
                    await awardClanPoints(updatedPost, 20, 'share');

                    // 🏆 TITLE LOGIC: Check for Share Milestone
                    await checkTitleUnlocks(author, "totalShares", author.totalShares || 0);
                }
            }

            return addCorsHeaders(NextResponse.json(updatedPost, { status: 200 }));
        }

        // --- 4. VIEW LOGIC ---
        if (action === "view") {
            let country = "Unknown", city = "Unknown", timezone = "Unknown";

            if (!isBot && fingerprint) {
                try {
                    const geoRes = await fetch(`https://ipinfo.io/${ip}/json`);
                    const geoData = await geoRes.json();
                    country = geoData.country || "Unknown";
                    city = geoData.city || "Unknown";
                    timezone = geoData.timezone || "Unknown";
                } catch (err) { console.log("Geo lookup failed"); }

                const updatedPost = await Post.findOneAndUpdate(
                    { _id: id, viewsFingerprints: { $ne: fingerprint } },
                    {
                        $inc: { views: 1 },
                        $push: {
                            viewsFingerprints: {
                                $each: [fingerprint],
                                $slice: -500
                            },
                            viewsData: {
                                $each: [{
                                    visitorId: fingerprint,
                                    ip, country, city,
                                    timezone,
                                    timestamp: new Date()
                                }],
                                $slice: -100
                            }
                        }
                    },
                    { new: true }
                );

                if (updatedPost) {
                    // ⚡️ INCREMENT STATS: Incrementing author's total global likes
                    const author = await MobileUser.findOneAndUpdate(
                        { deviceId: updatedPost.authorId },
                        { $inc: { totalViews: 1 } },
                        { new: true }
                    );

                    if (author) {
                        // ✨ AURA LOGIC: +2 Aura for every 5 unique views
                        if (updatedPost.views % 5 === 0) {
                            // ⚡️ Centralized Aura Manager
                            await awardAura(author._id, 2);
                            await awardClanPoints(updatedPost, 5, 'view');
                        }

                        // 🏆 TITLE LOGIC: Check for View Milestone
                        await checkTitleUnlocks(author, "totalViews", author.totalViews || 0);
                    }

                    return addCorsHeaders(NextResponse.json(updatedPost, { status: 200 }));
                }
            }

            // Return the post if already viewed or bot
            const post = await Post.findById(id);
            return addCorsHeaders(NextResponse.json(post, { status: 200 }));
        }

        return addCorsHeaders(NextResponse.json({ message: "Invalid action" }, { status: 400 }));

    } catch (err) {
        console.error("PATCH error:", err);
        return addCorsHeaders(NextResponse.json({ message: "Server error", error: err.message }, { status: 500 }));
    }
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
                                equippedBadges: inv.filter(i => i.category === 'BADGE' && i.isEquipped).slice(0, 3) || []
                            };
                        }
                    })
            );
        }

        if (clanTag) {
            promises.push(
                Clan.findOne({ $or: [{ tag: clanTag }] }).lean()
                    .then(c => {
                        if (c) clanData = c;
                    })
            );
        }

        // Wait for all related data to fetch
        await Promise.all(promises);

        // Clean message for the feed excerpt
        const feedMessage = post.message
            .replace(/s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs, "$1$2$3$4$5$6$8$10")
            .replace(/\n+/g, ' ')
            .trim();

        // 3. Package and return
        const responseData = {
            ...post,
            authorPostCount,
            authorData,
            clanData,
            feedExcerpt: feedMessage.length > 150 ? feedMessage.slice(0, 150) + "..." : feedMessage,
            formattedViews: formatViewsServer(post.viewsCount ?? post.views ?? 0),
            likesCount: post.likeCount ?? (post.likes?.length || 0),
            commentsCount: post.comments?.length || 0,
            discussionCount: calculateDiscussionCount(post.comments || [])
        };

        return addCorsHeaders(NextResponse.json(responseData));

    } catch (err) {
        console.error("Single Post Fetch Error:", err);
        return addCorsHeaders(NextResponse.json({ message: "Server error", error: err.message }, { status: 500 }));
    }
}

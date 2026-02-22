import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import Notification from "@/app/models/NotificationModel";
import { sendPushNotification } from "@/app/lib/pushNotifications";
import MobileUser from "@/app/models/MobileUserModel";
import crypto from "crypto";
import { awardClanPoints } from "@/app/lib/clanService";

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

            // ✨ AURA LOGIC: +2 for Voting
            if (post.authorId !== fingerprint) {
                await MobileUser.updateOne(
                    { deviceId: post.authorId },
                    { $inc: { weeklyAura: 2 } }
                );
                // 🛡️ CLAN: Only if the post is a Clan Post
                await awardClanPoints(post, 2);
                const msg = `Someone voted on your post: "${post.title.substring(0, 15)}..."`;
                await Notification.create({ recipientId: post.authorId, senderName: "Someone", type: "like", postId: post._id, message: msg });
                const author = await MobileUser.findOne({ deviceId: post.authorId });
                if (author?.pushToken) {
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
                await MobileUser.updateOne(
                    { deviceId: updatedPost.authorId },
                    { $inc: { weeklyAura: 5 } }
                );

                // One-Shot and stats logic
                await awardClanPoints(updatedPost, 10, 'like');

                // 3. Handle Notifications
                const msg = `Someone liked your post: "${updatedPost.title.substring(0, 15)}..."`;
                await Notification.create({
                    recipientId: updatedPost.authorId,
                    senderName: "Someone",
                    type: "like",
                    priority: "high",
                    postId: updatedPost._id,
                    message: msg
                });

                const author = await MobileUser.findOne({ deviceId: updatedPost.authorId });
                if (author?.pushToken) {
                    await sendPushNotification(
                        author.pushToken,
                        "New Like! ❤️",
                        msg,
                        { postId: updatedPost._id.toString(), type: "post_detail" },
                        `like_${updatedPost._id}`
                    );
                }

                // 4. Milestone Notifications (Trending)
                const milestones = [5, 10, 25, 50, 100];
                if (milestones.includes(updatedPost.likes.length)) {
                    const mMsg = `🔥 Trending! Your post reached ${updatedPost.likes.length} likes!`;
                    await Notification.create({
                        recipientId: updatedPost.authorId,
                        senderName: "System",
                        type: "trending",
                        postId: updatedPost._id,
                        message: mMsg
                    });

                    if (author?.pushToken) {
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

            return addCorsHeaders(NextResponse.json(updatedPost, { status: 200 }));
        }

        // --- 3. SHARE LOGIC ---
        if (action === "share") {
            const updatedPost = await Post.findByIdAndUpdate(id, { $inc: { shares: 1 } }, { new: true });

            // ✨ AURA LOGIC: +5 for Sharing
            if (updatedPost && updatedPost.authorId !== fingerprint) {
                await MobileUser.updateOne(
                    { deviceId: updatedPost.authorId },
                    { $inc: { weeklyAura: 10 } }
                );
                // 🛡️ CLAN: Only if the post is a Clan Post
                await awardClanPoints(updatedPost, 20, 'share');
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
                                // Keep only the last 500 fingerprints for server-side dupe check
                                viewsFingerprints: {
                                    $each: [fingerprint],
                                    $slice: -500
                                },
                                // Keep only the last 100 geo-data entries for recent analytics
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
                        // ✨ AURA LOGIC: +1 Aura for every 50 unique views
                        if (updatedPost.views % 5 === 0) {
                            await MobileUser.updateOne(
                                { deviceId: updatedPost.authorId },
                                { $inc: { weeklyAura: 5 } }
                            );

                            // 🛡️ CLAN: Points for views
                            // We pass 'view' as type to update clan stats
                            await awardClanPoints(updatedPost, 20, 'view');
                        }
                        return addCorsHeaders(NextResponse.json(updatedPost, { status: 200 }));
                    }
                }
            }

            // Return the post if already viewed or bot
            const post = await Post.findById(id);
            return addCorsHeaders(NextResponse.json(post, { status: 200 }));
        

        return addCorsHeaders(NextResponse.json({ message: "Invalid action" }, { status: 400 }));

    } catch (err) {
        console.error("PATCH error:", err);
        return addCorsHeaders(NextResponse.json({ message: "Server error", error: err.message }, { status: 500 }));
    }
}

// ----------------------
// GET: Fetch single post (Unchanged)
// ----------------------
export async function GET(req, { params }) {
    try {
        await connectDB();
        const resolvedParams = await params;
        const { id } = resolvedParams;
        if (!id) return addCorsHeaders(NextResponse.json({ message: "Post identifier required" }, { status: 400 }));

        let post;
        if (id.includes("-")) {
            post = await Post.findOne({ slug: id });
        } else {
            post = await Post.findById(id);
        }

        if (!post) return addCorsHeaders(NextResponse.json({ message: "Post not found" }, { status: 404 }));

        const postCount = await Post.countDocuments({ authorId: post.authorId });
        return addCorsHeaders(NextResponse.json({ ...post.toObject(), authorPostCount: postCount }));

    } catch (err) {
        return addCorsHeaders(NextResponse.json({ message: "Server error", error: err.message }, { status: 500 }));
    }
}

// PATCH — like, comment, vote, share, view
import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import Notification from "@/app/models/NotificationModel";
import { sendPushNotification } from "@/app/lib/pushNotifications"; // 👈 Added utility
import MobileUser from "@/app/models/MobileUserModel"; // 👈 Added for push lookup

function getClientIp(req) {
	const xfwd = req.headers?.get
		? req.headers.get("x-forwarded-for")
		: req.headers?.["x-forwarded-for"];

	const cf = req.headers?.get
		? req.headers.get("cf-connecting-ip")
		: req.headers?.["cf-connecting-ip"];

	const xr = req.headers?.get
		? req.headers.get("x-real-ip")
		: req.headers?.["x-real-ip"];

	let ip = (xfwd && xfwd.split(",")[0].trim()) || cf || xr;

	if (!ip && req.socket?.remoteAddress) {
		ip = req.socket.remoteAddress;
	}

	if (ip && ip.includes("::ffff:")) ip = ip.split("::ffff:").pop();
	return ip || "unknown";
}
export async function PATCH(req, { params }) {
    await connectDB();
    const theparam = await params;
    const { id } = theparam;

    try {
        const { action, payload, fingerprint } = await req.json();
        const post = await Post.findById(id);
        
        if (!post) {
            return NextResponse.json({ message: "Post not found" }, { status: 404 });
        }

        const ip = getClientIp(req);

        // =====================================================
        // ======================= VOTE ========================
        // =====================================================
        if (action === "vote") {
            const { selectedOptions } = payload;
            if (!post.poll || !Array.isArray(post.poll.options)) {
                return NextResponse.json({ message: "Poll not found" }, { status: 400 });
            }
            if (post.voters?.includes(fingerprint)) {
                return NextResponse.json({ message: "Already voted" }, { status: 400 });
            }
            const updatedOptions = post.poll.options.map((option, index) => {
                const o = option.toObject ? option.toObject() : option;
                return selectedOptions.includes(index)
                    ? { ...o, votes: (o.votes || 0) + 1 }
                    : o;
            });
            post.poll.options = updatedOptions;
            post.voters = [...(post.voters || []), fingerprint];
            post.markModified("poll");
            await post.save();
            return NextResponse.json({ message: "Vote added", post }, { status: 200 });
        }

        // =====================================================
        // ======================= LIKE ========================
        // =====================================================
        if (action === "like") {
            const alreadyLiked = post.likes.some(l => l.fingerprint === fingerprint);
            if (alreadyLiked) {
                return NextResponse.json({ message: "You have liked this post" }, { status: 400 });
            }

            post.likes.push({ fingerprint, date: new Date() });
            await post.save();

            // Notify author via Activity Feed and Push
            if (post.authorId !== fingerprint) {
                const message = `Someone liked your post: "${post.title.substring(0, 15)}..."`;
                
                await Notification.create({
                    recipientId: post.authorId,
                    senderName: "Someone",
                    type: "like",
                    postId: post._id,
                    message: message
                });

                // --- 🚀 SEND PUSH ---
                const author = await MobileUser.findOne({ _id: post.authorId });
                if (author?.pushToken) {
                    await sendPushNotification(author.pushToken, "New Like! ❤️", message);
                }
            }

            // Milestone Algorithm
            const milestones = [5, 10, 25, 50, 100];
            if (milestones.includes(post.likes.length)) {
                const milestoneMsg = `🔥 Trending! Your post reached ${post.likes.length} likes!`;
                await Notification.create({
                    recipientId: post.authorId,
                    senderName: "System",
                    type: "trending",
                    postId: post._id,
                    message: milestoneMsg
                });

                const author = await MobileUser.findOne({ _id: post.authorId });
                if (author?.pushToken) {
                    await sendPushNotification(author.pushToken, "Going Viral!", milestoneMsg);
                }
            }

            return NextResponse.json(post, { status: 200 });
        }

        // =====================================================
        // ===================== COMMENT =======================
        // =====================================================
        if (action === "comment") {
            const { name, text } = payload;
            const newComment = { 
                authorId: fingerprint, 
                name, text, date: new Date(), replies: [] 
            };
            post.comments.push(newComment);
            await post.save();

            if (post.authorId !== fingerprint) {
                const commentMsg = `${name} commented on your post.`;
                await Notification.create({
                    recipientId: post.authorId,
                    senderName: name,
                    type: "comment",
                    postId: post._id,
                    message: commentMsg
                });

                const author = await MobileUser.findOne({ _id: post.authorId });
                if (author?.pushToken) {
                    await sendPushNotification(author.pushToken, "New Comment 📝", commentMsg);
                }
            }
            return NextResponse.json(post, { status: 200 });
        }

        // =====================================================
        // ======================= SHARE =======================
        // =====================================================
        if (action === "share") {
            post.shares += 1;
            await post.save();
            return NextResponse.json(post, { status: 200 });
        }

        // =====================================================
        // ======================== VIEW =======================
        // =====================================================
        if (action === "view") {
            post.viewsIPs = post.viewsIPs || [];
            const isBotRequest = async (req, ip) => {
                if (!ip) return false;
                const botKeywords = ["facebookexternalhit", "Facebot", "Googlebot", "Bingbot", "Twitterbot", "LinkedInBot", "Slackbot", "Discordbot", "Pingdom", "AhrefsBot", "SemrushBot", "MJ12bot", "Baiduspider", "YandexBot"];
                const userAgent = req.headers.get("user-agent") || "";
                const isBotUA = botKeywords.some(bot => userAgent.toLowerCase().includes(bot.toLowerCase()));
                const botIPPrefixes = ["66.102.", "66.249.", "64.233.", "34.", "65.0", "74.125.", "142.250.", "172.217.", "209.85.", "216.58.", "31.13.", "66.220.", "69.171.", "15.206.", "52.66.", "13.", "43.", "3.", "157.240.", "173.252.", "18.", "17.", "::1", "198.7.237.195", "198.7.237.196", "198.7.237.197", "102.67.30.228","198.7.237.198", "204.", "198.7.237.199", "137.184.", " 50.18.", "54.", "35.", "23.27", "13.5", "196.49.26.134"];
                const isBotIP = botIPPrefixes.some(prefix => ip.startsWith(prefix));
                return isBotUA || isBotIP;
            };

            const isBot = await isBotRequest(req, ip);
            let country = "Unknown", city = "Unknown", timezone = "";
            try {
                const response = await fetch(`https://ipinfo.io/${ip}/json`);
                const data = await response.json();
                country = data.country || "Unknown";
                city = data.city || "Unknown";
                timezone = data.timezone || "Unknown";
            } catch (err) { console.log("Geo lookup failed:", err); }

            if (!isBot && !post.viewsIPs.includes(fingerprint) && fingerprint != null) {
                post.views += 1;
                post.viewsIPs.push(fingerprint);
                post.viewsData = post.viewsData || [];
                post.viewsData.push({
                    visitorId: fingerprint,
                    ip, country, city, timezone,
                    timestamp: new Date(),
                });
            }
            await post.save();
            return NextResponse.json(post, { status: 200 });
        }

        return NextResponse.json({ message: "Invalid action" }, { status: 400 });

    } catch (err) {
        console.error("PATCH error:", err);
        return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
    }
}






// GET: fetch single post by ID
export async function GET(req, { params }) {
	try {
		await connectDB();

		const resolvedParams = await params;  // ✅ unwrap the Promise
		const { id } = resolvedParams;
		if (!id) return NextResponse.json({ message: "Post Slug is required" }, { status: 400 });

		if (id.includes("-")) {
			const post = await Post.findOne({ slug: id });
			if (!post) return NextResponse.json({ message: "Post not found" }, { status: 404 });
			return NextResponse.json(post);
		} else {
			const post = await Post.findById(id);
			if (!post) return NextResponse.json({ message: "Post not found" }, { status: 404 });
			return NextResponse.json(post);
		}

	} catch (err) {
		console.error(err);
		return NextResponse.json({ message: "Server error", error: err.message }, { status: 500 });
	}
}



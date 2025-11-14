// PATCH — like, comment, vote, share, view
import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";


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
  const theparam = await params
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

      // Check duplicate vote using fingerprint only
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
      post.voters = [...(post.voters || []), fingerprint]; // store fingerprint only
      post.markModified("poll");
      await post.save();

      return NextResponse.json({ message: "Vote added", post }, { status: 200 });
    }

    // =====================================================
    // ======================= LIKE ========================
    // =====================================================
    if (action === "like") {
      if (post.likes.includes(fingerprint)) {
        return NextResponse.json({ message: "You have liked this post" }, { status: 400 });
      }

      post.likes.push(fingerprint); // store fingerprint only
      await post.save();
      return NextResponse.json(post, { status: 200 });
    }

    // =====================================================
    // ===================== COMMENT =======================
    // =====================================================
    if (action === "comment") {
      const { name, text } = payload;
      post.comments.push({ name, text, date: new Date() });
      await post.save();
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
      const ip = getClientIp(req);

      post.viewsIPs = post.viewsIPs || [];

      // ------- Bot Detector by IP --------
      const isLikelyBotIP = (ip) => {
        if (!ip) return false;
        const botPrefixes = [
          "66.102.", "66.249.", "64.233.", "74.125.", "142.250.",
          "172.217.", "209.85.", "216.58.",
          "31.13.", "66.220.", "69.171.", "157.240.",
          "40.", "52.", "104.",
          "3.", "18.", "34.", "44.", "54.",
          "104.16.", "104.17.", "172.64.",
          "17.", "::1"
        ];
        return botPrefixes.some(prefix => ip.startsWith(prefix));
      };

      // ------- Bot Detector by User-Agent --------
      const botKeywords = [
        "facebookexternalhit",
        "Facebot",
        "Googlebot",
        "Bingbot",
        "Twitterbot",
        "LinkedInBot",
        "Slackbot",
        "Discordbot",
      ];

      const userAgent = req.headers.get("user-agent") || "";
      const isBotUA = botKeywords.some(bot => userAgent.includes(bot));

      const isBot = isBotUA || isLikelyBotIP(ip);

      // ====== UNIQUE HUMAN VIEW LOGIC ======
      if (!isBot && !post.viewsIPs.includes(fingerprint)) {
        post.views += 1;
        post.viewsIPs.push(fingerprint);
      }

      // ====== NEW ANALYTICS LOGIC ======
      let country = "Unknown";
      let city = "Unknown";

      try {
        const response = await fetch(`https://ipinfo.io/${ip}/json`);
        const data = await response.json();

        country = data.country_name || "Unknown";
        city = data.city || "Unknown";
      } catch (err) {
        console.log("Geo lookup failed:", err);
      }

      // Ensure array exists
      post.viewsData = post.viewsData || [];

      // Add analytics entry
      post.viewsData.push({
        visitorId: fingerprint,
        ip,
        country,
        city,
        timestamp: new Date(),
      });

      // Save
      await post.save();
      return NextResponse.json(post, { status: 200 });
    }


    return NextResponse.json({ message: "Invalid action" }, { status: 400 });

  } catch (err) {
    console.error("PATCH /api/posts/[id] error:", err);
    return NextResponse.json(
      { message: "Server error", error: err.message },
      { status: 500 }
    );
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



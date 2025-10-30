// PATCH — like, comment, vote, share, view
import { NextResponse } from "next/server";
import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";


function getClientIp(req) {
  // req can be a Node IncomingMessage (pages/api) or a Fetch Request-like (App Router)
  // Try common headers first (x-forwarded-for, cf-connecting-ip, x-real-ip)
  const xfwd = req.headers?.get
    ? req.headers.get("x-forwarded-for")
    : req.headers?.["x-forwarded-for"];

  const cf = req.headers?.get ? req.headers.get("cf-connecting-ip") : req.headers?.["cf-connecting-ip"];
  const xr = req.headers?.get ? req.headers.get("x-real-ip") : req.headers?.["x-real-ip"];

  let ip = (xfwd && xfwd.split(",")[0].trim()) || cf || xr;

  // fallback for Node req.socket.remoteAddress (pages/api or Express)
  if (!ip && req.socket && req.socket.remoteAddress) {
    ip = req.socket.remoteAddress;
  }

  // Normalize IPv6-mapped IPv4 like "::ffff:127.0.0.1"
  if (ip && ip.includes("::ffff:")) ip = ip.split("::ffff:").pop();

  return ip || "unknown";
}
export async function PATCH(req, { params }) {
  await connectDB();
  const theparam = await params
  const { id } = theparam;

  try {
    const { action, payload } = await req.json();
    const post = await Post.findById(id);
    if (!post) {
      return NextResponse.json({ message: "Post not found" }, { status: 404 });
    }
    const ip = getClientIp(req)

    // ===== VOTE =====
    if (action === "vote") {
      const { selectedOptions } = payload;

      if (!post.poll || !Array.isArray(post.poll.options)) {
        return NextResponse.json({ message: "Poll not found" }, { status: 400 });
      }

      if (post.voters?.includes(ip)) {
        return NextResponse.json({ message: "Already voted" }, { status: 400 });
      }

      const updatedOptions = post.poll.options.map((option, index) => {
        const plainOption = option.toObject ? option.toObject() : option;
        if (selectedOptions.includes(index)) {
          return { ...plainOption, votes: (plainOption.votes || 0) + 1 };
        }
        return plainOption;
      });

      post.poll.options = updatedOptions;
      post.voters = [...(post.voters || []), ip];
      post.markModified("poll");
      await post.save();

      return NextResponse.json({ message: "Vote added", post }, { status: 200 });
    }

    // ===== LIKE =====
    if (action === "like") {
      if (post.likes.includes(ip)) {
        return NextResponse.json({ message: "You have liked this post" }, { status: 400 });
      }
      post.likes.push(ip);
      await post.save();
      return NextResponse.json(post, { status: 200 });
    }

    // ===== COMMENT =====
    if (action === "comment") {
      const { name, text } = payload;
      post.comments.push({ name, text, date: new Date() });
      await post.save();
      return NextResponse.json(post, { status: 200 });
    }

    // ===== SHARE =====
    if (action === "share") {
      post.shares += 1;
      await post.save();
      return NextResponse.json(post, { status: 200 });
    }

    // ===== VIEW =====
    if (action === "view") {
  post.viewsIPs = post.viewsIPs || [];

  // --- Function to detect likely bot/data center IPs ---
  const isLikelyBotIP = (ip) => {
    if (!ip) return false;

    const botPrefixes = [
      // Google
      "66.102.", "66.249.", "64.233.", "72.14.", "74.125.",
      "142.250.", "172.217.", "209.85.", "216.58.",

      // Meta / Facebook / Instagram
      "31.13.", "66.220.", "173.252", "38.154", "69.171.", "69.63.", "157.240.",

      // Microsoft / Bing / Azure
      "13.", "20.", "40.", "52.", "65.", "104.",

      // Amazon AWS
      "3.", "13.", "18.", "34.", "44.", "52.", "54.",

      // Cloudflare
      "104.16.", "104.17.", "104.18.", "104.19.", "104.20.",
      "104.21.", "104.22.", "104.23.", "104.24.", "104.25.",
      "104.26.", "104.27.", "172.64.", "172.65.", "172.66.",
      "172.67.", "172.68.", "188.114.", "188.115.",

      // Apple
      "17.",

      // OpenAI (ChatGPT, DALL·E)
      "23.96.", "40.83.", "52.149.", "52.230.", "52.237.", "104.41."
    ];

    return botPrefixes.some(prefix => ip.startsWith(prefix));
  };

  // --- User-Agent bot detection ---
  const botKeywords = [
    "facebookexternalhit", // Facebook link preview
    "Facebot",             // Facebook crawler
    "Googlebot",           // Google crawler
    "Bingbot",             // Bing crawler
    "Twitterbot",          // Twitter preview
    "LinkedInBot",         // LinkedIn preview
    "Slackbot",            // Slack preview
    "Discordbot",          // Discord embeds
  ];

  const userAgent = req.headers.get("user-agent") || "";
  const isBotUA = botKeywords.some(bot => userAgent.includes(bot));

  // --- Combine both checks ---
  const isBot = isBotUA || isLikelyBotIP(ip);

  // --- Only count if it’s not a bot and not a duplicate view ---
  if (!isBot && !post.viewsIPs.includes(ip)) {
    post.views += 1;
    post.viewsIPs.push(ip);
    await post.save();
  }

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
      const post = await Post.findOne({slug: id});
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



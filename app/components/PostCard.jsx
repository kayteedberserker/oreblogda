"use client";

import { useEffect, useState } from "react";
import React from "react";

import { FaHeart, FaRegHeart, FaShareAlt, FaComment, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { mutate } from "swr"; // ✅ Added SWR mutate support
import Poll from "./Poll";
import Image from "next/image";
import dynamic from "next/dynamic";

const ArticleAd = dynamic(() => import("./ArticleAd"), {
	ssr: false,
});
import FingerprintJS from "@fingerprintjs/fingerprintjs";
const getOptimizedCloudinaryUrl = (url) => {
	if (!url || !url.includes("cloudinary.com")) return url || "/default-avatar.png";
	// Using w_600 for sharpness and q_90 for high quality
	return url.replace("/upload/", "/upload/w_500,c_fill,g_face,f_auto,q_100/");
};
/**
 * Formats view counts into a gamey/short-hand string.
 * Examples: 85 -> 85, 125 -> 100+, 1150 -> 1.1k+, 12550 -> 12.5k+
 */
const formatViews = (views) => {
  if (!views || views < 0) return "0";

  // Case 1: Less than 100 - Show exact number
  if (views < 100) {
    return views.toString();
  }

  // Case 2: 100 to 999 - Show 100+, 200+, etc. (Hiding last two digits)
  if (views < 100) {
    return `${Math.floor(views / 100) * 100}+`;
  }

  // Case 3: 1,000 to 999,999 - Show 1k+, 1.1k+, 10k+, etc.
  if (views < 1000000) {
    const kValue = views / 1000;
    // We use .toFixed(1) to get one decimal, but remove it if it's .0
    const formattedK = kValue % 1 === 0 
      ? kValue.toFixed(0) 
      : kValue.toFixed(1);
    
    return `${formattedK}k+`;
  }

  // Case 4: Millions (Bonus)
  const mValue = views / 1000000;
  const formattedM = mValue % 1 === 0 
    ? mValue.toFixed(0) 
    : mValue.toFixed(1);
    
  return `${formattedM}m+`;
};
export default function PostCard({
	post,
	posts,
	setPosts,
	isFeed,
	hideComments = false,
	hideMedia,
	isSimilarPost = false,
	className,
	imgHeight
}) {
	const [liked, setLiked] = useState(false)

	useEffect(() => {
		const stored = localStorage.getItem(post._id);
		if (stored) setLiked(!!stored); // convert string to boolean
	}, [post._id]);
	const [likeAnim, setLikeAnim] = useState(false);
	const [burst, setBurst] = useState(false);
	const [commentName, setCommentName] = useState("");
	const [commentText, setCommentText] = useState("");
	const [showCommentInput, setShowCommentInput] = useState(false);
	const [showFullMessage, setShowFullMessage] = useState(false);
	const [lightbox, setLightbox] = useState({ open: false, src: null, type: null });

	const [totalLikes, setTotalLikes] = useState(post?.likes?.length || 0)
	const totalComments = post?.comments?.length || 0;
	const totalShares = post?.shares || 0;
	const totalViews = post?.views || 0;

	// ✅ Centralized re-render helper (local + SWR)
	const refreshPosts = async (updatedPost) => {
		if (setPosts) {
			setPosts((prev) =>
				Array.isArray(prev)
					? prev.map((p) => (p._id === updatedPost._id ? updatedPost : p))
					: updatedPost
			);
		}
		// ✅ Trigger SWR revalidation if using SWR in feed
		mutate("/api/posts");

	};

	let fpPromise;

	async function getFingerprint() {
		if (!fpPromise) fpPromise = FingerprintJS.load();
		const fp = await fpPromise;
		const result = await fp.get();
		return result.visitorId; // extremely strong fingerprint
	}


	// ✅ Handle view count once per user
	useEffect(() => {
		if (!post?._id) return;

		const viewed = JSON.parse(localStorage.getItem("viewedPosts") || "[]");

		if (!viewed.includes(post._id)) {
			// create async wrapper
			const sendView = async () => {
				const fingerprint = await getFingerprint(); // ✅ now we can await

				try {
					const res = await fetch(`/api/posts/${post._id}`, {
						method: "PATCH",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({ action: "view", fingerprint }),
					});

					const data = await res.json();
					refreshPosts(data);

					localStorage.setItem(
						"viewedPosts",
						JSON.stringify([...viewed, post._id])
					);
				} catch (err) {
				}
			};

			sendView(); // run async function
		}
	}, [post?._id]);



	const handleLike = async () => {
		if (liked) return;

		// Optimistic UI update
		setLiked(true);
		setLikeAnim(true);
		setBurst(true);
		setTotalLikes(prev => prev + 1); // <-- functional update for immediate UI change
		localStorage.setItem(post._id, true);

		setTimeout(() => setLikeAnim(false), 300);
		setTimeout(() => setBurst(false), 700);

		try {
			const res = await fetch(`/api/posts/${post._id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "like",
					fingerprint: await getFingerprint(),
				}),
			});

			const data = await res.json();

			if (data?.message.includes("You have liked this post")) {
				toast.warn("You have liked this post");
				localStorage.setItem(post._id, true);
				setTotalLikes(prev => prev - 1); // revert change
				setLiked(false);
				return;
			}

			refreshPosts(data); // if you want to refresh the post from backend
		} catch (err) {
			toast.error(err.message);
			setTotalLikes(prev => prev - 1); // revert change
			setLiked(false);
		}
	};


	const handleShare = async () => {
		try {
			await fetch(`/api/posts/${post._id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "share",
					fingerprint: await getFingerprint()
				})
			});

			refreshPosts({ ...post, shares: totalShares + 1 });
			navigator.clipboard.writeText(`${window.location.origin}/post/${post.slug}`);
			toast.success("Link copied!");
		} catch (err) {
			toast.error("Failed to share");
		}
	};



	const [author, setAuthor] = useState({ name: post.authorName, image: null });

	useEffect(() => {
		const fetchAuthor = async () => {
			try {
				const res = await fetch(`/api/users/${post.authorId}`);
				if (!res.ok) throw new Error("Failed to fetch author");
				const data = await res.json();

				setAuthor({ name: data.user?.username || post.authorName, image: data.user?.profilePic?.url });
			} catch (err) {
			}
		};

		if (post.authorId || post.authorUserId) fetchAuthor();
	}, [post.authorId, post.authorUserId, post.authorName]);

	const isLongMessage = post.message.length > 150;
	const displayMessage =
		showFullMessage || !isLongMessage
			? post.message
			: post.message.slice(0, 150) + "...";

	const openLightbox = (src, type) => setLightbox({ open: true, src, type });
	const closeLightbox = () => setLightbox({ open: false, src: null, type: null });

	useEffect(() => {
		if (!post?.mediaUrl) return;

		// TikTok script loader
		if (post.mediaUrl.includes("tiktok.com")) {
			if (!window.__tiktokScriptLoaded) {
				const script = document.createElement("script");
				script.src = "https://www.tiktok.com/embed.js";
				script.async = true;
				document.body.appendChild(script);
				window.__tiktokScriptLoaded = true;
			} else if (window.tiktokEmbedder?.processEmbeds) {
				window.tiktokEmbedder.processEmbeds();
			} else {
				setTimeout(() => {
					if (window.tiktokEmbedder?.processEmbeds) window.tiktokEmbedder.processEmbeds();
				}, 800);
			}
		}
	}, [post?.mediaUrl]);



	// ✅ --- HYBRID PARSER (Supports both Bracket & Parenthesis syntax) ---
	const parseMessageSections = (msg) => {
		if (!msg) return [];
		
		// Expanded Regex to catch BOTH formats
		const regex = /s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs;

		const parts = [];
		let lastIndex = 0;
		let match;

		while ((match = regex.exec(msg)) !== null) {
			if (match.index > lastIndex) {
				parts.push({ type: "text", content: msg.slice(lastIndex, match.index) });
			}

			if (match[1] || match[2]) {
				parts.push({ type: "section", content: match[1] || match[2] });
			} else if (match[3] || match[4]) {
				parts.push({ type: "heading", content: match[3] || match[4] });
			} else if (match[5] || match[6]) {
				parts.push({ type: "listItem", content: match[5] || match[6] });
			} else if (match[7] && match[8]) {
				// New Format Link
				parts.push({ type: "link", url: match[7], content: match[8] });
			} else if (match[9] && match[10]) {
				// Old Format Link
				parts.push({ type: "link", url: match[9], content: match[10] });
			} else if (match[0] === 'br()' || match[0] === '[br]') {
				parts.push({ type: "br" });
			}

			lastIndex = regex.lastIndex;
		}

		if (lastIndex < msg.length) {
			parts.push({ type: "text", content: msg.slice(lastIndex) });
		}

		return parts;
	};



	const renderMessage = () => {
		let maxLength = isSimilarPost ? 200 : 150;

		if (isFeed) {
			// Strip all tags for feed view
			const plainText = post.message.replace(/s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs, (match, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10) => {
				return p1 || p2 || p3 || p4 || p5 || p6 || p8 || p10 || '';
			});
			const truncated = plainText.length > maxLength ? plainText.slice(0, maxLength) + "..." : plainText;
			return <span style={{ whiteSpace: 'pre-wrap' }}>{truncated}</span>;
		}

		const parts = parseMessageSections(post.message);

		return parts.map((p, i) => {
			switch (p.type) {
				case "text":
					return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{p.content}</span>;

				case "br":
					return <br key={i} />;

				case "link":
					return (
						<a
							key={i}
							href={p.url}
							target="_blank"
							rel="noopener noreferrer"
							className="text-blue-500 underline font-bold"
						>
							{p.content}
						</a>
					);

				case "heading":
					return (
						<h2 key={i} className="text-xl font-bold my-2 uppercase tracking-tight">
							{p.content}
						</h2>
					);

				case "listItem":
					return (
						<li key={i} className="ml-10 md:ml-12 list-disc font-medium mb-1">
							{p.content}
						</li>
					);

				case "section":
					return (
						<div
							key={i}
							className="bg-gray-100 dark:bg-gray-800/60 p-4 my-4 rounded-xl border-l-4 border-blue-500 italic"
							style={{ whiteSpace: 'pre-wrap' }}
						>
							{p.content}
						</div>
					);

				default:
					return null;
			}
		});
	};

	const [idLink, setidLink] = useState()
	useEffect(() => {
		if (post.slug) {
			setidLink(post?.slug)
		} else {
			setidLink(post._id)
		}
	}, [idLink])


	// Helper function to insert ads after every N words
	// Insert ads into a message that might be a string or JSX
	function renderMessageWithAds(blocks, minWordsPerAd = 100) {
		if (!Array.isArray(blocks)) return blocks;

		let wordCount = 0;
		const output = [];
		let adInserted = false;
		let adCounter = 0; // Keep track of how many ads we've added for unique IDs

		const countWords = (text) =>
			typeof text === "string" ? text.trim().split(/\s+/).length : 0;

		blocks.forEach((block, i) => {
			// 1. Push block normally
			output.push(
				<React.Fragment key={`b-${i}`}>{block}</React.Fragment>
			);

			// 2. Count words inside block
			let blockWords = 0;
			if (typeof block === "string") {
				blockWords = countWords(block);
			} else if (React.isValidElement(block)) {
				const t = block.props.children;
				if (typeof t === "string") {
					blockWords = countWords(t);
				} else if (Array.isArray(t)) {
					blockWords = t
						.map((c) => (typeof c === "string" ? countWords(c) : 0))
						.reduce((a, b) => a + b, 0);
				}
			}

			wordCount += blockWords;

			// 3. DO NOT INSERT ADS INSIDE LISTS
			const tag = block?.type?.toString() || "";
			const isListItem = block.type === "li" || tag.includes("li");
			if (isListItem) return;

			// 4. Insert ad AFTER the block *only if* enough words accumulated
			// Inside the word-count loop where you insert the ad:
			if (wordCount >= minWordsPerAd) {
				 output.push(
					<div className="my-10 w-full p-4 p-2 border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl flex flex-col items-center gap-1 justify-center bg-gray-50/50 dark:bg-white/5">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">Sponsored Transmission</span>
                       <ArticleAd /> 
                  </div>
				);
				wordCount = 0;
				adInserted = true;
			}
		});

		// 5. Always show at least ONE ad if article is too short
		if (!adInserted && blocks.length > 1) {
			output.push(
					<div className="my-10 w-full p-4 p-2 border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl flex flex-col items-center gap-1 justify-center bg-gray-50/50 dark:bg-white/5">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">Sponsored Transmission</span>
                       <ArticleAd /> 
                  </div>
				);
			wordCount = 0;
			adInserted = true;
		}

		return output;
	}



	return (
		<>
			<div className={`group bg-white dark:bg-[#0d1117] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-2xl hover:border-blue-500/50 rounded-2xl py-6 px-5 mb-8 relative overflow-hidden transition-all duration-300 ${className}`}>

				{/* TOP DECO: Scanner Line (Appears on Hover) */}
				<div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 group-hover:animate-[scan_2s_linear_infinite] transition-opacity" />

				{/* Author & Views */}
				<div className="flex justify-between items-center mb-4">
					<Link
						href={`/author/${post.authorId}`}
						className="flex items-center space-x-3 group/author"
					>
						{author.image ? (
							<div className="w-10 h-10 relative rounded-full border-2 border-blue-500/30 p-[2px] overflow-hidden group-hover/author:border-blue-500 transition-colors">
								<div className="w-full h-full relative rounded-full overflow-hidden">
									<Image
										src={author.image}
										alt={author.name || "Author"}
										fill
										className="object-cover transition-transform group-hover/author:scale-110"
										loading="lazy"
									/>
								</div>
							</div>
						) : (
							<div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-sm font-black text-blue-600">
								?
							</div>
						)}
						<div className="flex flex-col">
							<span className="font-black text-xs uppercase tracking-widest text-blue-600 dark:text-blue-400 opacity-80 group-hover/author:opacity-100 transition-opacity">
								{author.name || "Unknown Entity"}
							</span>
							<span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Verified Author</span>
						</div>
					</Link>

					<div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-1 rounded-full border border-gray-100 dark:border-gray-700">
						<div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
						<span className="text-[10px] font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">{formatViews(totalViews)}</span>
					</div>
				</div>

				{/* --- Post Content --- */}
				<div className="relative mb-4">
					<h2 className={`font-black uppercase italic tracking-tighter transition-colors group-hover:text-blue-600 ${isSimilarPost ? "text-[18px] leading-tight mb-1" : isFeed ? "text-xl leading-tight mb-2" : "text-3xl mb-3"}`}>
						{post?.title}
					</h2>

					<div className="text-gray-600 dark:text-gray-300 text-sm md:text-base leading-relaxed font-medium">
						{isFeed ? (
							isLongMessage && !showFullMessage ? (
								<>
									<Link href={`/post/${idLink}`} className="hover:text-blue-500 transition-colors">
										{renderMessage()}
									</Link>
									<Link href={`/post/${idLink}`} className="ml-2 text-blue-600 font-black uppercase text-[10px] tracking-widest hover:underline">
										[ Read Intel ]
									</Link>
								</>
							) : (
								<Link href={`/post/${idLink}`} className="hover:text-blue-500 transition-colors">
									{renderMessage()}
								</Link>
							)
						) : (
							<div className="prose dark:prose-invert max-w-none">
								{renderMessageWithAds(renderMessage(), 100)}
							</div>
						)}
						<input type="hidden" value="Oreblogda - Anime blog" aria-label="Oreblogda - Anime Blog" />
					</div>
				</div>

				{/* Media Section */}
				{!hideMedia && post.mediaUrl && (
					<div className="relative group/media rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800 mb-4 shadow-inner">
						{/* TikTok Embed */}
						{post.mediaUrl.includes("tiktok.com") ? (
							<div className="flex justify-center bg-black">
								<blockquote
									className="tiktok-embed"
									cite={post.mediaUrl.split("?")[0]}
									data-video-id={post.mediaUrl.match(/video\/(\d+)/)?.[1]}
									style={{ maxWidth: "100%", minWidth: "325px" }}
								>
									<section> </section>
								</blockquote>
							</div>
						) : post.mediaUrl.includes("youtube.com") || post.mediaUrl.includes("youtu.be") ? (
							<div className="relative w-full h-0 pb-[56.25%]"> {/* 16:9 aspect ratio */}
								<iframe
									src={`https://www.youtube.com/embed/${post.mediaUrl.match(/(?:v=|youtu\.be\/)([\w-]+)/)?.[1]}`}
									title="YouTube video"
									allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
									allowFullScreen
									className="absolute top-0 left-0 w-full h-full"
								/>
							</div>
						) : post.mediaType?.startsWith("image") ? (
							<div
								className="relative w-full h-auto cursor-pointer overflow-hidden"
								onClick={() => openLightbox(post.mediaUrl, "image")}
							>
								<Image
									src={getOptimizedCloudinaryUrl(post.mediaUrl)}
									alt="post media"
									priority
									loading="eager"
									fetchPriority="high"
									width={800}
									height={600}
									sizes="(max-width: 768px) 90vw, (max-width: 1200px) 80vw, 60vw"
									className={`w-full h-auto object-cover transition-transform duration-700 group-hover/media:scale-105 ${imgHeight}`}
								/>
								{/* Glitch Overlay on Hover */}
								<div className="absolute inset-0 bg-blue-600/10 opacity-0 group-hover/media:opacity-100 pointer-events-none transition-opacity mix-blend-overlay" />
							</div>
						) : (
							<video
								src={post.mediaUrl}
								controls
								className="w-full max-h-[500px] object-cover cursor-pointer"
								onClick={() => openLightbox(post.mediaUrl, "video")}
							/>
						)}
					</div>
				)}



				{/* Poll Section */}
				{post.poll && post.poll.options?.length > 0 && (
					<div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
						{isFeed ? (
							<Link href={`/post/${post._id}`}>
								<Poll poll={post.poll} postId={post._id} setPosts={setPosts} readOnly />
							</Link>
						) : (
							<Poll poll={post.poll} postId={post._id} setPosts={setPosts} readOnly={false} />
						)}
					</div>
				)}

				{/* Actions HUD */}
				{isSimilarPost ? null : (
					<div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-gray-800 text-gray-500 dark:text-gray-400">
						<div className="flex items-center space-x-6">
							<div className="relative">
								<motion.button
									onClick={handleLike}
									whileTap={{ scale: 1.4 }}
									className={`flex items-center space-x-2 font-black text-xs transition-colors ${liked ? "text-red-500" : "hover:text-red-400"}`}
								>
									{liked ? <FaHeart className="text-lg" /> : <FaRegHeart className="text-lg" />}
									<motion.span key={totalLikes} initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{totalLikes}</motion.span>
								</motion.button>

								{burst && (
									<div className="pointer-events-none">
										<span className="absolute -top-6 -left-2 animate-burst text-lg">❤️</span>
										<span className="absolute -top-8 left-4 animate-burst2 text-lg">❤️</span>
										<span className="absolute -top-10 left-8 animate-burst3 text-lg">❤️</span>
									</div>
								)}
							</div>

							<motion.button
								onClick={() => setShowCommentInput(!showCommentInput)}
								whileHover={{ y: -2 }}
								className="flex items-center space-x-2 font-black text-xs hover:text-blue-500"
							>
								<FaComment className="text-lg" />
								<motion.span key={totalComments} initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{totalComments}</motion.span>
							</motion.button>

							<motion.button
								onClick={handleShare}
								whileHover={{ y: -2 }}
								className="flex items-center space-x-2 font-black text-xs hover:text-green-500"
							>
								<FaShareAlt className="text-lg" />
								<motion.span key={totalShares} initial={{ y: 5, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>{totalShares}</motion.span>
							</motion.button>
						</div>
					</div>
				)}

				{isSimilarPost ? null : (
					!hideComments && post.comments.length > 0 && (
						<div className="mt-4 space-y-2">
							<AnimatePresence>
								{(isFeed ? post.comments.slice(-2) : post.comments.slice()).map((comment, idx) => (
									<div key={comment._id || idx} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="p-3 bg-gray-50 dark:bg-gray-800/40 border-l-2 border-blue-500 rounded-r-xl">
										<span className="text-[10px] font-black uppercase text-blue-600 dark:text-blue-400 block mb-1">{comment.name}</span>
										<p className="text-xs font-medium text-gray-700 dark:text-gray-300 leading-tight">{comment.text}</p>
									</div>
								))}
							</AnimatePresence>
							{isFeed && post.comments.length > 2 && (
								<Link href={`/post/${post._id}`} className="inline-block text-[10px] font-black uppercase tracking-widest text-blue-500 hover:text-blue-600 mt-2">
									+ View All Transmissions
								</Link>
							)}
						</div>
					)
				)}
			</div>

			{/* Lightbox Functional Logic Untouched */}
			{lightbox.open && (
				<div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[999] p-4" onClick={closeLightbox}>
					<button onClick={closeLightbox} className="absolute top-8 right-8 text-white/50 hover:text-white transition-colors"><FaTimes size={32} /></button>
					{lightbox.type === "image" ? (
						<img src={lightbox.src} alt="Lightbox" className="max-h-[85vh] max-w-[90vw] object-contain shadow-2xl animate-in zoom-in duration-300" onClick={(e) => e.stopPropagation()} />
					) : (
						<video src={lightbox.src} controls autoPlay className="max-h-[85vh] max-w-[90vw] rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
					)}
				</div>
			)}

			<style jsx>{`
        @keyframes scan {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
        }
        @keyframes burst {
            0% { transform: translate(0,0) scale(1); opacity:1; }
            100% { transform: translate(-15px,-50px) scale(1.8); opacity:0; }
        }
        @keyframes burst2 {
            0% { transform: translate(0,0) scale(1); opacity:1; }
            100% { transform: translate(15px,-60px) scale(2); opacity:0; }
        }
        @keyframes burst3 {
            0% { transform: translate(0,0) scale(1); opacity:1; }
            100% { transform: translate(0,-70px) scale(2.2); opacity:0; }
        }
        .animate-burst { animation: burst 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        .animate-burst2 { animation: burst2 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
        .animate-burst3 { animation: burst3 0.8s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards; }
    `}</style>
		</>
	);
}

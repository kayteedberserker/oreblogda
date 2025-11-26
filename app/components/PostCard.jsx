"use client";

import { useEffect, useState } from "react";
import { FaHeart, FaRegHeart, FaShareAlt, FaComment, FaTimes } from "react-icons/fa";
import { toast } from "react-toastify";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { mutate } from "swr"; // ✅ Added SWR mutate support
import Poll from "./Poll";
import Image from "next/image";
import FingerprintJS from "@fingerprintjs/fingerprintjs";

export default function PostCard({
	post,
	posts,
	setPosts,
	isFeed,
	hideComments = false,
	hideMedia,
	className,
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

	const totalLikes = post?.likes?.length || 0;
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
					console.error(err);
				}
			};

			sendView(); // run async function
		}
	}, [post?._id]);



	const handleLike = async () => {
		if (liked) return;
		setLiked(true);
		setLikeAnim(true);
		setBurst(true);
		setTimeout(() => setLikeAnim(false), 300);
		setTimeout(() => setBurst(false), 700);
		localStorage.setItem(post._id, true)

		try {
			const res = await fetch(`/api/posts/${post._id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "like",
					fingerprint: await getFingerprint(),
				}),
			});

			const data = await res.json()

			if (data?.message.includes("You have liked this post")) {
				toast.warn("You have liked this post")
				localStorage.setItem(post._id, true)
				return
			}
			refreshPosts(data);
		} catch(err) {
			toast.error(err.message)
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
		} catch(err){
			toast.error("Failed to share");
		}
	};


	const handleAddComment = async () => {
		if (!commentText.trim() || !commentName.trim()) {
			toast.error("Please enter your name and comment");
			return;
		}

		try {
			const res = await fetch(`/api/posts/${post._id}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					action: "comment",
					payload: { name: commentName, text: commentText },
					fingerprint: await getFingerprint()
				}),
			});

			const data = await res.json();
			refreshPosts({ ...post, comments: data.comments });

			setCommentText("");
			setCommentName("");
			setShowCommentInput(false);
			toast.success("Comment added!");
		} catch(err) {
			toast.error("Failed to comment");
		}
	};


	const [author, setAuthor] = useState({ name: post.authorName, image: null });

	useEffect(() => {
		const fetchAuthor = async () => {
			try {
				const res = await fetch(`/api/users/${post.authorId}`);
				if (!res.ok) throw new Error("Failed to fetch author");
				const data = await res.json();
				setAuthor({ name: data.name || post.authorName, image: data.user?.profilePic?.url });
			} catch (err) {
			}
		};

		if (post.authorId) fetchAuthor();
	}, [post.authorId, post.authorName]);

	const isLongMessage = post.message.length > 150;
	const displayMessage =
		showFullMessage || !isLongMessage
			? post.message
			: post.message.slice(0, 150) + "...";

	const openLightbox = (src, type) => setLightbox({ open: true, src, type });
	const closeLightbox = () => setLightbox({ open: false, src: null, type: null });

	// ✅ Optimized TikTok embed handler
	useEffect(() => {
		if (!post?.mediaUrl || !post.mediaUrl.includes("tiktok.com")) return;

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
	}, [post.mediaUrl]);


	// ✅ --- UPDATED MESSAGE SECTION ---
	const parseMessageSections = (msg) => {
	const regex = /\[section\](.*?)\[\/section\]|\[h\](.*?)\[\/h\]|\[li\](.*?)\[\/li\]|\[br\]/gs;

	const parts = [];
	let lastIndex = 0;
	let match;

	while ((match = regex.exec(msg)) !== null) {
		// Add text before the tag
		if (match.index > lastIndex) {
			parts.push({ type: "text", content: msg.slice(lastIndex, match.index) });
		}

		// Determine which tag matched
		if (match[1] !== undefined) {
			parts.push({ type: "section", content: match[1] });
		} else if (match[2] !== undefined) {
			parts.push({ type: "heading", content: match[2] });
		} else if (match[3] !== undefined) {
			parts.push({ type: "listItem", content: match[3] });
		} else {
			parts.push({ type: "br" }); // [br]
		}

		lastIndex = regex.lastIndex;
	}

	// Add remaining text
	if (lastIndex < msg.length) {
		parts.push({ type: "text", content: msg.slice(lastIndex) });
	}

	return parts;
};



	const renderMessage = () => {
	const maxLength = 150;

	if (isFeed) {
		const plainText = post.message.replace(/\[section\](.*?)\[\/section\]|\[h\](.*?)\[\/h\]|\[li\](.*?)\[\/li\]|\[br\]/gs, "");
		const truncated = plainText.length > maxLength ? plainText.slice(0, maxLength) + "..." : plainText;
		return <span>{truncated}</span>;
	}

	const parts = parseMessageSections(post.message);

	return parts.map((p, i) => {
		switch (p.type) {
			case "text":
				return <span key={i}>{p.content}</span>;

			case "br":
				return <br key={i} />;

			case "heading":
				return (
					<h2 key={i} className="text-xl font-bold my-2 ">
						{p.content}
					</h2>
				);

			case "listItem":
				return (
					<li key={i} className="ml-24 md:ml-[170px] lg:ml-[290px] list-disc">
						{p.content}
					</li>
				);

			case "section":
				return (
					<div
						key={i}
						className="bg-gray-100 dark:bg-gray-700 p-2 my-2 w-fit max-w-[70%] ml-20 md:ml-[150px] lg:ml-[270px] rounded-md border-l-4 border-blue-500"
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

	return (
		<>
			<div className={`bg-white dark:bg-gray-800 shadow-md rounded-md py-4 px-1 mb-6 relative overflow-hidden ${className}`}>
				{/* Author & Views */}
				<div className="flex justify-between items-center mb-1">
					<Link
						href={`/author/${post.authorId}`}
						className="flex items-center space-x-2 hover:underline"
					>
						{author.image ? (
							<div className="w-8 h-8 relative rounded-full border border-gray-600 dark:border-gray-600 overflow-hidden">
								<Image
									src={author.image}
									alt={`Author ${author.name}'s Image` || "Author"}
									fill
									className="object-cover"
									loading="lazy"
								/>
							</div>
						) : (
							<div className="w-8 h-8 rounded-full bg-gray-300 flex items-center justify-center text-sm text-gray-600">
								?
							</div>
						)}
						<span className="font-light text-2xl underline capitalize">
							{author.name || "Unknown"}
						</span>
					</Link>
					<span className="text-sm text-gray-500">{totalViews} views</span>
				</div>


				{/* ✅ Updated Message */}
				<h2 className=" font-bold text-2xl mb-1.5">{post?.title}</h2>
				<div className="text-gray-800 text-[12px] md:text-[16px] dark:text-gray-100 mb-1">
					{isFeed ? (
						isLongMessage && !showFullMessage ? (
							<>
								<Link href={`/post/${idLink}`} className="hover:underline">
									{renderMessage()}
								</Link>
								<Link href={`/post/${idLink}`} className=" ml-3.5 hover:underline">
									Read More
								</Link>
								<input type="hidden" name="" value={"Oreblogda - Anime blog"} aria-label="Oreblogda - Anime Blog" />
							</>
						) : (
							<Link href={`/post/${idLink}`} className="hover:underline">
								{renderMessage()}
								<input type="hidden" name="" value={"Oreblogda - Anime blog"} aria-label="Oreblogda - Anime Blog" />
							</Link>
						)
					) : (
						<>
							{renderMessage()}
							<input type="hidden" name="" value={"Oreblogda - Anime blog"} aria-label="Oreblogda - Anime Blog" />
						</>
					)}
				</div>

				{/* Media */}
				{!hideMedia && post.mediaUrl && (
					post.mediaUrl.includes("tiktok.com") ? (
						<>
							<blockquote
								className="tiktok-embed"
								cite={post.mediaUrl.split("?")[0]}
								data-video-id={post.mediaUrl.match(/video\/(\d+)/)?.[1]}
								style={{ maxWidth: "100%", minWidth: "325px" }}
							>
								<section> </section>
							</blockquote>
							<script async src="https://www.tiktok.com/embed.js"></script>
						</>
					) : post.mediaType?.startsWith("image") ? (
						<div className="relative rounded-md mb-2 w-full h-80 cursor-pointer">
							<Image
								src={post.mediaUrl}
								alt="post media"
								loading="eager"
								fill
								sizes="(max-width: 768px) 90vw, (max-width: 1200px) 80vw, 60vw"
								className="object-contain rounded-md"
								onClick={() => openLightbox(post.mediaUrl, "image")}
							/>
						</div>
					) : (
						<video
							src={post.mediaUrl}
							controls
							className="rounded-md mb-2 max-h-80 w-full object-cover cursor-pointer"
							onClick={() => openLightbox(post.mediaUrl, "video")}
						/>
					)
				)}



				{/* Poll */}
				{post.poll && post.poll.options?.length > 0 && (
					isFeed ? (
						<Link href={`/post/${post._id}`}>
							<Poll poll={post.poll} postId={post._id} setPosts={setPosts} readOnly />
						</Link>
					) : (
						<Poll poll={post.poll} postId={post._id} setPosts={setPosts} readOnly={false} />
					)
				)}

				{/* Actions */}
				<div className="flex items-center space-x-4 mt-2 text-gray-600 dark:text-gray-300 relative">
					<div className="relative">
						<motion.button
							name="Add like"
							onClick={handleLike}
							whileTap={{ scale: 1.3 }}
							className={`flex items-center space-x-1 transition-transform duration-300 ${likeAnim ? "scale-125" : "scale-100"}`}
						>
							{liked ? <FaHeart className="text-red-500" /> : <FaRegHeart />}
							<motion.span
								key={totalLikes}
								initial={{ scale: 0.8 }}
								animate={{ scale: 1 }}
								transition={{ type: "spring", stiffness: 500 }}
							>
								{totalLikes}
							</motion.span>
						</motion.button>

						{burst && (
							<>
								<span className="absolute -top-3 -left-2 animate-burst text-red-400 text-lg">❤️</span>
								<span className="absolute -top-2 left-5 animate-burst2 text-red-500 text-lg">❤️</span>
								<span className="absolute -top-4 left-10 animate-burst3 text-red-600 text-lg">❤️</span>
							</>
						)}
					</div>

					<motion.button
						name="Open comment"
						onClick={() => setShowCommentInput((prev) => !prev)}
						whileHover={{ scale: 1.05 }}
						className="flex items-center space-x-1"
					>
						<FaComment />
						<motion.span
							key={totalComments}
							initial={{ scale: 0.8 }}
							animate={{ scale: 1 }}
							transition={{ type: "spring", stiffness: 500 }}
						>
							{totalComments}
						</motion.span>
					</motion.button>

					<motion.button
						name="share"
						onClick={handleShare}
						whileHover={{ scale: 1.05 }}
						className="flex items-center space-x-1"
					>
						<FaShareAlt />
						<motion.span
							key={totalShares}
							initial={{ scale: 0.8 }}
							animate={{ scale: 1 }}
							transition={{ type: "spring", stiffness: 500 }}
						>
							{totalShares}
						</motion.span>
					</motion.button>
				</div>

				{/* Comment Input */}
				{showCommentInput && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="mt-2 space-y-2"
					>
						<input
							type="text"
							placeholder="Your Name"
							value={commentName}
							onChange={(e) => setCommentName(e.target.value)}
							className="w-full border rounded-md p-2 text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600"
						/>
						<textarea
							placeholder="Write a comment..."
							value={commentText}
							onChange={(e) => setCommentText(e.target.value)}
							className="w-full border rounded-md p-2 text-gray-800 dark:text-gray-100 bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 resize-none"
						/>
						<button
							aria-label="Add comment"
							onClick={handleAddComment}
							className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
						>
							Submit
						</button>
					</motion.div>
				)}

				{/* Comments */}
				{!hideComments && (
					<div className="mt-2 space-y-2">
						<AnimatePresence>
							{(isFeed ? post.comments.slice(-2) : post.comments.slice()).map((comment, idx) => (
								<motion.div
									key={comment._id || idx}
									initial={{ opacity: 0, y: -10 }}
									animate={{ opacity: 1, y: 0 }}
									exit={{ opacity: 0, y: -10 }}
									transition={{ duration: 0.3 }}
									className="p-2 bg-gray-100 dark:bg-gray-700 rounded-md"
								>
									<span className="font-semibold text-gray-800 dark:text-gray-100">
										{comment.name}
									</span>
									:
									<span className="ml-1 text-gray-700 dark:text-gray-300">
										{comment.text}
									</span>
								</motion.div>
							))}
						</AnimatePresence>

						{isFeed && post.comments.length > 2 && (
							<Link href={`/post/${post._id}`} className="text-blue-500 hover:underline text-sm">
								View all comments
							</Link>
						)}
					</div>
				)}
			</div>

			{/* Lightbox */}
			{lightbox.open && (
				<div
					className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50 p-4"
					onClick={closeLightbox}
				>
					<button
						aria-label="close"
						onClick={closeLightbox}
						className="absolute top-4 right-4 text-white text-2xl z-50"
					>
						<FaTimes />
					</button>

					{lightbox.type === "image" ? (
						<img
							src={lightbox.src}
							alt="Lightbox image"
							className="max-h-[90vh] max-w-[90vw] object-contain rounded-md"
							onClick={(e) => e.stopPropagation()}
						/>
					) : (
						<video
							src={lightbox.src}
							controls
							autoPlay
							className="max-h-[90vh] max-w-[90vw] rounded-md object-contain"
							onClick={(e) => e.stopPropagation()}
						/>
					)}
				</div>
			)}




			{/* Heart Animations */}
			<style jsx>{`
        @keyframes burst {
          0% { transform: translate(0,0) scale(1); opacity:1; }
          100% { transform: translate(-10px,-40px) scale(1.5); opacity:0; }
        }
        @keyframes burst2 {
          0% { transform: translate(0,0) scale(1); opacity:1; }
          100% { transform: translate(10px,-50px) scale(1.7); opacity:0; }
        }
        @keyframes burst3 {
          0% { transform: translate(0,0) scale(1); opacity:1; }
          100% { transform: translate(0,-60px) scale(2); opacity:0; }
        }
        .animate-burst { animation: burst 0.9s forwards; }
        .animate-burst2 { animation: burst2 0.9s forwards; }
        .animate-burst3 { animation: burst3 0.9s forwards; }
      `}</style>
		</>
	);
}

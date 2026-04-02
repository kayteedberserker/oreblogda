"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useEffect, useMemo, useState } from "react";
import useSWR from "swr";

import { toast } from "react-toastify";
import AuraAvatar from "./AuraAvatar";
import ClanCrest from "./ClanCrest";
import PeakBadge from "./PeakBadge";
import Poll from "./Poll";

const API_URL = "https://oreblogda.com";
const fetcher = (url) => fetch(API_URL + url).then((res) => res.json());

// --- Inline Web Icons (Upgraded to support Tailwind text colors natively) ---
const Icons = {
	Play: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" className="text-white"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>,
	Image: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>,
	ChevronLeft: () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>,
	ChevronRight: () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>,
	X: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>,
	Download: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>,
	Check: () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>,
	SwordCross: () => (
		<svg
			width="18"
			height="18"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="text-white"
		>
			{/* Sword 1 (Bottom Left to Top Right) */}
			<path d="M20 4L3 21" />
			<path d="M7 14l-3 3" />
			<path d="M10 17l-3 3" />

			{/* Sword 2 (Bottom Right to Top Left) */}
			<path d="M4 4l17 17" />
			<path d="M14 7l3-3" />
			<path d="M17 10l3-3" />
		</svg>
	),
	Group: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>,
	Flame: ({ className }) => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" className={className}><path d="M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 11-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 002.5 2.5z" /></svg>,
	Heart: ({ filled, className }) => <svg width="20" height="20" viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" className={className}><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>,
	Comment: ({ className }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>,
	Forum: ({ className }) => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><path d="M14 9a2 2 0 0 1-2 2H6l-4 4V4c0-1.1.9-2 2-2h8a2 2 0 0 1 2 2v5Z" /><path d="M18 9h2a2 2 0 0 1 2 2v11l-4-4h-6a2 2 0 0 1-2-2v-1" /></svg>,
	Share: ({ className }) => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>,
	Copy: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>,
	Verified: ({ color }) => <svg width="16" height="16" viewBox="0 0 24 24" fill={color}><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" /></svg>
};

// --- Helpers ---
const getClanRankTitle = (rank) => {
	switch (rank) {
		case 1: return "Wandering Ronin"; case 2: return "Squad 13"; case 3: return "Upper Moon";
		case 4: return "Phantom Troupe"; case 5: return "The Espada"; case 6: return "The Akatsuki";
		default: return "Wandering Ronin";
	}
};

const getAuraVisuals = (rank) => {
	if (!rank || rank > 10 || rank <= 0) return null;
	switch (rank) {
		case 1: return { color: '#fbbf24', label: 'MONARCH', emoji: '👑' };
		case 2: return { color: '#ef4444', label: 'YONKO', emoji: '☄️' };
		case 3: return { color: '#a855f7', label: 'KAGE', emoji: '🌙' };
		case 4: return { color: '#3b82f6', label: 'SHOGUN', emoji: '🛡️' };
		case 5: return { color: '#e0f2fe', label: 'ESPADA 0', emoji: '💀' };
		case 6: return { color: '#cbd5e1', label: 'ESPADA 1', emoji: '⚔️' };
		case 7: return { color: '#94a3b8', label: 'ESPADA 2', emoji: '⚔️' };
		case 8: return { color: '#64748b', label: 'ESPADA 3', emoji: '⚔️' };
		case 9: return { color: '#475569', label: 'ESPADA 4', emoji: '⚔️' };
		case 10: return { color: '#334155', label: 'ESPADA 5', emoji: '⚔️' };
		default: return { color: '#1e293b', label: 'OPERATIVE', emoji: '🎯' };
	}
};

const AURA_TIERS = [
	{ level: 1, req: 0, title: "E-Rank Novice", icon: "🌱", postLimit: 2 },
	{ level: 2, req: 100, title: "D-Rank Operative", icon: "⚔️", postLimit: 2 },
	{ level: 3, req: 300, title: "C-Rank Awakened", icon: "🔥", postLimit: 3 },
	{ level: 4, req: 700, title: "B-Rank Elite", icon: "⚡", postLimit: 3 },
	{ level: 5, req: 1500, title: "A-Rank Champion", icon: "🛡️", postLimit: 4 },
	{ level: 6, req: 3000, title: "S-Rank Legend", icon: "🌟", postLimit: 4 },
	{ level: 7, req: 6000, title: "SS-Rank Mythic", icon: "🌀", postLimit: 5 },
	{ level: 8, req: 12000, title: "Monarch", icon: "👑", postLimit: 5 },
];

const resolveUserRank = (level) => {
	const safeLevel = Math.max(1, Math.min(8, level || 1));
	const currentTier = AURA_TIERS[safeLevel - 1];
	return { ...currentTier, rankName: `${currentTier.icon} ${currentTier.title}` };
};

const formatViews = (views) => {
	if (!views || views < 0) return "0";
	if (views < 100) return views.toString();
	if (views < 1000) return `${Math.floor(views / 100) * 100}+`;
	if (views < 1000000) return `${(views / 1000).toFixed(views % 1000 === 0 ? 0 : 1)}k+`;
	return `${(views / 1000000).toFixed(views % 1000000 === 0 ? 0 : 1)}m+`;
};

const getVideoThumbnail = (url) => {
	if (!url) return null;
	if (url.includes("youtube.com") || url.includes("youtu.be")) {
		const id = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
		return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null;
	}
	return url.replace("/q_auto,vc_auto/", "/f_jpg,q_auto,so_auto,c_pad,b_black/").replace(/\.[^/.]+$/, ".jpg");
};

// --- Sub Components ---

const MediaPlaceholder = ({ height = "250px", onPress, type, thumbUrl, showPlayIcon = true }) => (
	<button onClick={onPress} style={{ height }} className="w-full bg-gray-100 dark:bg-gray-900 flex items-center justify-center overflow-hidden rounded-2xl relative border-none cursor-pointer group">
		{thumbUrl && <img src={thumbUrl} className="absolute w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-500" alt="Thumbnail" />}
		{showPlayIcon && <div className="bg-black/40 p-4 rounded-full mb-2 border border-white/20 z-10 backdrop-blur-sm group-hover:bg-blue-600/60 transition-colors">{type === "video" ? <Icons.Play /> : <Icons.Image />}</div>}
		<div className="bg-black/60 px-4 py-1 rounded-full border border-white/10 z-10 backdrop-blur-sm">
			<span className="text-white font-black text-[10px] uppercase tracking-[0.2em]">Open {type === "video" ? "Stream" : "Visual"}</span>
		</div>
	</button>
);

const MediaModal = ({ isOpen, onClose, mediaItems, currentIndex, setCurrentIndex, handleDownload, isDownloading, isMediaSaved }) => {
	if (!isOpen) return null;

	const goToNext = (e) => { e.stopPropagation(); if (currentIndex < mediaItems.length - 1) setCurrentIndex(currentIndex + 1); };
	const goToPrev = (e) => { e.stopPropagation(); if (currentIndex > 0) setCurrentIndex(currentIndex - 1); };

	const renderLightboxContent = (item) => {
		const lowerUrl = item.url?.toLowerCase() || "";
		const isYouTube = lowerUrl.includes("youtube.com") || lowerUrl.includes("youtu.be");
		const isTikTok = lowerUrl.includes("tiktok.com");
		const isDirectVideo = item.type?.startsWith("video") || lowerUrl.match(/\.(mp4|mov|m4v|webm)$/i);

		if (isYouTube) {
			const getYouTubeID = (url) => url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|shorts)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/)?.[1];
			return (
				<div className="w-full max-w-4xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl">
					<iframe className="w-full h-full" src={`https://www.youtube.com/embed/${getYouTubeID(item.url)}?autoplay=1`} allow="autoplay; encrypted-media" allowFullScreen />
				</div>
			);
		}

		if (isTikTok) {
			const getTikTokEmbedUrl = (url) => {
				const match = url.match(/\/video\/(\d+)/);
				return match?.[1] ? `https://www.tiktok.com/embed/v2/${match[1]}` : url;
			};
			return (
				<div className="w-full max-w-[400px] h-[80vh] bg-black rounded-lg overflow-hidden shadow-2xl">
					<iframe className="w-full h-full" src={getTikTokEmbedUrl(item.url)} allowFullScreen />
				</div>
			);
		}

		if (isDirectVideo) {
			return <video src={item.url} controls autoPlay loop className="max-w-full max-h-[85vh] rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />;
		}

		return <img src={item.url} className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl" alt="Enlarged Visual" onClick={e => e.stopPropagation()} />;
	};

	return (
		<div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md animate-in fade-in duration-200" onClick={onClose}>
			<button onClick={onClose} className="absolute top-6 right-6 p-3 bg-white/10 hover:bg-white/20 rounded-full z-50 transition-colors"><Icons.X color="white" /></button>
			{mediaItems[currentIndex]?.type !== "youtube" && (
				<button onClick={(e) => { e.stopPropagation(); handleDownload(); }} disabled={isDownloading || isMediaSaved} className="absolute top-6 left-6 p-3 bg-white/10 hover:bg-white/20 rounded-full z-50 flex items-center gap-2 transition-colors">
					{isDownloading ? <span className="text-white text-xs">...</span> : isMediaSaved ? <Icons.Check color="white" /> : <Icons.Download color="white" />}
				</button>
			)}
			<div className="relative w-full h-full flex items-center justify-center p-4">
				{mediaItems[currentIndex] && renderLightboxContent(mediaItems[currentIndex])}
			</div>
			{mediaItems.length > 1 && (
				<>
					{currentIndex > 0 && <button onClick={goToPrev} className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full z-50 border border-white/20"><Icons.ChevronLeft color="white" /></button>}
					{currentIndex < mediaItems.length - 1 && <button onClick={goToNext} className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-white/10 hover:bg-white/20 rounded-full z-50 border border-white/20"><Icons.ChevronRight color="white" /></button>}
					<div className="absolute bottom-8 w-full flex justify-center pointer-events-none">
						<div className="bg-black/60 px-6 py-2 rounded-full border border-white/10 backdrop-blur-sm">
							<span className="text-white font-black tracking-widest uppercase text-xs">Asset {currentIndex + 1} / {mediaItems.length}</span>
						</div>
					</div>
				</>
			)}
		</div>
	);
};

const MemoizedClanHeader = memo(({ clanInfo }) => {
	if (!clanInfo) return null;

	const isVerified = clanInfo.verifiedUntil && new Date(clanInfo.verifiedUntil) > new Date();
	const verifiedTier = clanInfo.activeCustomizations?.verifiedTier;
	const verifiedColor = verifiedTier === "premium" ? "#facc15" : verifiedTier === "standard" ? "#ef4444" : verifiedTier === "basic" ? "#3b82f6" : "";
	const highlightColor = isVerified ? verifiedColor : "#3b82f6";
	const activeGlowColor = clanInfo.equippedGlow?.visualConfig?.primaryColor || clanInfo.equippedGlow?.visualData?.glowColor || null;

	return (
		<div className="mb-4">
			<div className="flex flex-row items-center justify-between px-4 py-4 rounded-[28px] border-2 relative overflow-hidden bg-white dark:bg-[#111] border-gray-100 dark:border-gray-800 hover:border-blue-500/30 transition-colors">
				<Link href={`/clans/${clanInfo.tag}`} className="flex flex-row items-center flex-1 z-10 hover:opacity-80 transition-opacity">
					<div className="mr-4">
						<ClanCrest isFeed={true} rank={clanInfo.rank} size={48} glowColor={activeGlowColor} />
					</div>
					<div className="flex flex-col">
						<div className="flex flex-row gap-1 items-center">
							<span className="font-bold text-[16px] text-gray-900 dark:text-white" style={{ color: activeGlowColor || undefined }}>{clanInfo.name}</span>
							{isVerified && <Icons.Verified color={verifiedColor} />}
						</div>
						<div className="flex flex-row items-center mt-1">
							<div style={{ backgroundColor: highlightColor }} className="w-1 h-3 mr-2 rounded-full" />
							<span className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-70 text-gray-500 dark:text-gray-400">{getClanRankTitle(clanInfo.rank)}</span>
						</div>
					</div>
				</Link>
				<div className="flex flex-row items-center z-10 pl-4 border-l border-gray-200 dark:border-gray-800">
					{clanInfo.isInWar ? (
						<div className="flex flex-col items-center">
							<div className="bg-red-500 p-2 rounded-xl rotate-45 shadow-sm shadow-red-500/50"><div className="-rotate-45"><Icons.SwordCross /></div></div>
							<span className="text-[8px] text-red-500 font-black uppercase mt-2 tracking-widest">In Battle</span>
						</div>
					) : (
						<div className="flex flex-col items-end">
							<div className="flex flex-row items-center">
								<span className="text-[15px] font-black italic text-gray-900 dark:text-white">{clanInfo.followerCount || "0"}</span>
								<div className="ml-1 opacity-50"><Icons.Group /></div>
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
});

// --- Main Post Component ---
export default function PostCardComponent({ post, authorData, clanData, isFeed, isVisible = true }) {
	const router = useRouter();

	const [lightbox, setLightbox] = useState({ open: false, index: 0 });
	const [currentAssetIndex, setCurrentAssetIndex] = useState(0);
	const [isDownloading, setIsDownloading] = useState(false);
	const [liked, setLiked] = useState(false);
	const [isMediaSaved, setIsMediaSaved] = useState(false);

	useEffect(() => {
		if (typeof window !== 'undefined') {
			try {
				const likedList = JSON.parse(localStorage.getItem('user_likes') || "[]");
				setLiked(likedList.includes(post?._id));
			} catch (e) { }
		}
	}, [post?._id]);

	const author = authorData || { name: post?.authorName || "Unknown", streak: null, rank: null, rankLevel: 1, aura: 0, peakLevel: 0 };

	const mediaItems = useMemo(() => {
		if (post?.media && Array.isArray(post.media) && post.media.length > 0) return post.media;
		if (post?.mediaUrl) return [{ url: post.mediaUrl, type: post.mediaType || "image" }];
		return [];
	}, [post]);

	const { data: postData, mutate } = useSWR(
		post?._id && isVisible ? `/api/posts/${post._id}` : null,
		fetcher,
		{ refreshInterval: 120000, fallbackData: post, revalidateOnMount: false }
	);

	const activeData = postData || post;
	const totalLikes = activeData?.likesCount ?? activeData?.likes?.length ?? 0;
	const totalComments = activeData?.commentsCount ?? activeData?.comments?.length ?? 0;
	const totalViews = activeData?.viewsCount ?? activeData?.views ?? 0;

	const totalDiscussions = useMemo(() => {
		const commentsArray = activeData?.comments || [];
		if (!Array.isArray(commentsArray)) return 0;
		let count = 0;
		commentsArray.forEach(c => {
			const replies = c.replies || [];
			if (replies.length >= 3) { count++; return; }
			const authors = new Set();
			const getId = (item) => item.authorUserId || item.authorFingerprint || item.name;
			authors.add(getId(c));
			replies.forEach(r => authors.add(getId(r)));
			if (authors.size >= 2) count++;
		});
		return count;
	}, [activeData?.comments]);

	const userRank = useMemo(() => resolveUserRank(author.rankLevel), [author.rankLevel]);

	const handleLike = async () => {
		if (liked) return;
		const previousData = activeData;
		setLiked(true);
		mutate({ ...activeData, likesCount: totalLikes + 1 }, false);

		try {
			const res = await fetch(`${API_URL}/api/posts/${post?._id}/like`, { method: "PATCH" });
			if (res.ok) {
				const likedList = JSON.parse(localStorage.getItem('user_likes') || "[]");
				if (!likedList.includes(post?._id)) {
					likedList.push(post?._id);
					localStorage.setItem('user_likes', JSON.stringify(likedList));
				}
			} else throw new Error("Server rejected like");
		} catch (err) {
			setLiked(false);
			mutate(previousData, false);
		}
	};

	const handleWebShare = async () => {
		const url = `https://oreblogda.com/post/${post?.slug || post?._id}`;
		if (navigator.share) {
			try { await navigator.share({ title: `Check out this post`, text: post?.title, url: url }); } catch (error) { console.log(error); }
		} else {
			navigator.clipboard.writeText(url);
			toast.success("Link copied to clipboard!");
		}
	};

	const handleDownloadMedia = async () => {
		const item = mediaItems[currentAssetIndex];
		if (!item || !item.url) return;
		try {
			setIsDownloading(true);
			const response = await fetch(item.url);
			const blob = await response.blob();
			const url = window.URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.style.display = 'none';
			a.href = url;
			a.download = item.url.split('/').pop() || (item.type === "video" ? "video.mp4" : "image.jpg");
			document.body.appendChild(a);
			a.click();
			window.URL.revokeObjectURL(url);
			setIsMediaSaved(true);
			setTimeout(() => setIsMediaSaved(false), 3000);
		} catch (error) {
			toast.error("Unable to download media due to cross-origin restrictions.");
		} finally { setIsDownloading(false); }
	};

	const handleCopyFullText = async (e) => {
		e.preventDefault();
		let cleanText = post.message.replace(/br\(\)|\[br\]/g, '\n');
		cleanText = cleanText.replace(/s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]/gs, (match, p1, p2, p3, p4, p5, p6, p8, p10) => p1 || p2 || p3 || p4 || p5 || p6 || p8 || p10 || '').trim();
		await navigator.clipboard.writeText(cleanText);
		if (navigator.vibrate) navigator.vibrate(50);
		toast.success("Text copied to clipboard!");
	};

	const parseCustomSyntax = (text) => {
		if (!text) return [];
		const regex = /s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs;
		const parts = [];
		let lastIndex = 0;
		let match;
		while ((match = regex.exec(text)) !== null) {
			if (match.index > lastIndex) parts.push({ type: 'text', content: text.slice(lastIndex, match.index) });
			if (match[1] || match[2]) parts.push({ type: 'section', content: match[1] || match[2] });
			else if (match[3] || match[4]) parts.push({ type: 'heading', content: match[3] || match[4] });
			else if (match[5] || match[6]) parts.push({ type: 'listItem', content: match[5] || match[6] });
			else if (match[7] && match[8]) parts.push({ type: 'link', url: match[7], content: match[8] });
			else if (match[9] && match[10]) parts.push({ type: 'link', url: match[9], content: match[10] });
			else if (match[0] === 'br()' || match[0] === 'br') parts.push({ type: 'br' });
			lastIndex = regex.lastIndex;
		}
		if (lastIndex < text.length) parts.push({ type: 'text', content: text.slice(lastIndex) });
		return parts;
	};

	const renderContent = useMemo(() => {
		const maxLength = 150;
		if (isFeed) {
			const plainText = post.message.replace(/s\((.*?)\)|\[section\](.*?)\[\/section\]|h\((.*?)\)|\[h\](.*?)\[\/h\]|l\((.*?)\)|\[li\](.*?)\[\/li\]|link\((.*?)\)-text\((.*?)\)|\[source="(.*?)" text:(.*?)\]|br\(\)|\[br\]/gs, (match, p1, p2, p3, p4, p5, p6, p8, p10) => p1 || p2 || p3 || p4 || p5 || p6 || p8 || p10 || '').trim();
			const truncated = plainText.length > maxLength ? plainText.slice(0, maxLength) + "..." : plainText;
			return <p className="text-base leading-6 text-gray-600 dark:text-gray-400">{truncated}</p>;
		}

		const parts = parseCustomSyntax(post.message);
		return (
			<div className="relative group">
				<button onClick={handleCopyFullText} className="absolute -right-2 -top-6 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-100 dark:bg-gray-800 rounded-lg text-xs font-bold text-gray-500 flex items-center gap-1">
					<Icons.Copy /> Copy
				</button>
				{parts.map((part, i) => {
					switch (part.type) {
						case "text": return <span key={i} className="text-base leading-7 text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words">{part.content}</span>;
						case "br": return <div key={i} className="h-2" />;
						case "link": return <a key={i} href={part.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 font-bold underline text-base hover:text-blue-600 transition-colors">{part.content}</a>;
						case "heading": return <h3 key={i} className="text-xl font-bold mt-4 mb-2 text-black dark:text-white uppercase tracking-tight">{part.content}</h3>;
						case "listItem": return <div key={i} className="flex flex-row items-start ml-4 my-1"><span className="text-blue-500 mr-2 text-lg">•</span><span className="flex-1 text-base leading-6 text-gray-800 dark:text-gray-200">{part.content}</span></div>;
						case "section": return <div key={i} className="bg-gray-100 dark:bg-gray-800/60 p-4 my-3 rounded-2xl border-l-4 border-blue-500"><p className="text-base italic leading-6 text-gray-700 dark:text-gray-300">{part.content}</p></div>;
						default: return null;
					}
				})}
			</div>
		);
	}, [post.message, isFeed]);

	const renderMediaContent = () => {
		if (mediaItems.length === 0) return null;
		const count = mediaItems.length;
		const openItem = (index, e) => { e.preventDefault(); e.stopPropagation(); setCurrentAssetIndex(index); setLightbox({ open: true, index }); };

		return (
			<div className="my-2 rounded-2xl overflow-hidden bg-black border border-blue-400/20 shadow-[0_0_15px_rgba(96,165,250,0.15)] h-[300px]">
				{count === 1 ? (
					<div className="w-full h-full relative">
						{mediaItems[0].type?.startsWith("video") || mediaItems[0].url.toLowerCase().includes("youtube") || mediaItems[0].url.toLowerCase().includes("tiktok") ? (
							<MediaPlaceholder height="100%" type="video" thumbUrl={getVideoThumbnail(mediaItems[0].url)} onPress={(e) => openItem(0, e)} />
						) : (
							<button onClick={(e) => openItem(0, e)} className="w-full h-full relative block overflow-hidden group border-none">
								<img src={mediaItems[0].url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Post Media" />
							</button>
						)}
					</div>
				) : count === 2 ? (
					<div className="flex w-full h-full gap-[2px]">
						{mediaItems.slice(0, 2).map((item, idx) => (
							<button key={idx} onClick={(e) => openItem(idx, e)} className="flex-1 relative overflow-hidden group border-none">
								<img src={item.type === "video" ? getVideoThumbnail(item.url) : item.url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Post Media" />
								{item.type === "video" && <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm"><Icons.Play /></div>}
							</button>
						))}
					</div>
				) : (
					<div className="flex w-full h-full gap-[2px]">
						<button onClick={(e) => openItem(0, e)} className="w-1/2 h-full relative overflow-hidden group border-none">
							<img src={mediaItems[0].type === "video" ? getVideoThumbnail(mediaItems[0].url) : mediaItems[0].url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Post Media" />
							{mediaItems[0].type === "video" && <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm"><Icons.Play /></div>}
						</button>
						<div className="w-1/2 h-full flex flex-col gap-[2px]">
							<button onClick={(e) => openItem(1, e)} className="flex-1 relative overflow-hidden group border-none">
								<img src={mediaItems[1].type === "video" ? getVideoThumbnail(mediaItems[1].url) : mediaItems[1].url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Post Media" />
								{mediaItems[1].type === "video" && <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm"><Icons.Play /></div>}
							</button>
							<button onClick={(e) => openItem(2, e)} className="flex-1 relative overflow-hidden group border-none">
								<img src={mediaItems[2].type === "video" ? getVideoThumbnail(mediaItems[2].url) : mediaItems[2].url} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" alt="Post Media" />
								{count > 3 && <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 backdrop-blur-sm"><span className="text-white text-2xl font-black">+{count - 3}</span></div>}
								{mediaItems[2].type === "video" && count <= 3 && <div className="absolute inset-0 flex items-center justify-center bg-black/20 z-10 backdrop-blur-sm"><Icons.Play /></div>}
							</button>
						</div>
					</div>
				)}
			</div>
		);
	};

	const activeGlowColor = author.equippedGlow?.visualConfig?.primaryColor || null;
	const aura = getAuraVisuals(author.rank);
	const isTop10 = author.rank > 0 && author.rank <= 10;
	const isClanPost = !!(post.clanId || post.clanTag);

	return (
		<div className="mb-8 overflow-hidden rounded-[32px] border bg-white dark:bg-[#0d1117] border-gray-100 dark:border-gray-800 shadow-sm dark:shadow-none relative transition-colors">

			{isTop10 && <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundColor: activeGlowColor || aura.color }} />}
			<div className="h-[3px] w-full bg-blue-600 opacity-20" />

			<div className="p-4 sm:px-6">
				<div className="mb-5">
					{isClanPost && clanData && <MemoizedClanHeader clanInfo={clanData} />}

					<div className="flex flex-row justify-between items-start">
						<div className="flex flex-row items-center gap-4 flex-1 pr-2">
							<Link href={`/author/${post.authorUserId}`}>
								<AuraAvatar author={author} glowColor={activeGlowColor} aura={aura} isTop10={isTop10} size={44} />
							</Link>

							<div className="flex-1">
								<Link href={`/author/${post.authorUserId}`} className="flex flex-col group">
									<div className="flex flex-row items-center gap-1 flex-wrap">
										<span className="font-bold text-[13px] hover:underline text-blue-600 dark:text-blue-400" style={{ color: activeGlowColor || (isTop10 ? aura?.color : undefined) }}>
											{author.name}
										</span>
										<span className="text-gray-500 text-xs"> • </span>
										<Icons.Flame className={author.streak < 0 ? "text-red-500" : "text-orange-500"} />
										<span className="text-gray-500 text-[10px] font-bold">{author.streak || "0"}</span>
									</div>

									{isTop10 && (
										<div className="bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded border flex inline-flex items-center gap-1 mt-1 w-fit" style={{ borderColor: (activeGlowColor || aura.color) + '40' }}>
											<span>{aura?.emoji}</span>
											<span style={{ color: activeGlowColor || aura.color, fontSize: '8px', fontWeight: '900' }}>{aura.label}</span>
										</div>
									)}
									<span className="text-[10px] mt-1 text-gray-500 dark:text-gray-400 font-bold uppercase tracking-tighter">
										{userRank.rankName || "Verified Author"}
									</span>
								</Link>
							</div>
						</div>

						<div className="flex flex-col items-end">
							<div className="flex shrink-0 flex-row items-center gap-2 bg-gray-50 dark:bg-gray-800/50 px-3 py-1.5 rounded-full border border-gray-100 dark:border-gray-700">
								<div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
								<span className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">{formatViews(totalViews)}</span>
							</div>

							{author.peakLevel > 0 && (
								<div className="mt-2">
									<PeakBadge level={author.peakLevel} size={25} />
								</div>
							)}
						</div>
					</div>
				</div>

				{isFeed ? (
					<Link href={`/post/${post.slug || post?._id}`} className="block mb-4 hover:opacity-80 transition-opacity">
						<h2 className="font-[900] uppercase italic tracking-tighter leading-tight mb-2 text-gray-900 dark:text-white text-2xl">
							{post?.title}
						</h2>
						<div className="opacity-90">{renderContent}</div>
					</Link>
				) : (
					<div className="mb-4">
						<h1 className="font-[900] uppercase italic tracking-tighter leading-tight mb-2 text-gray-900 dark:text-white text-3xl md:text-4xl">
							{post?.title}
						</h1>
						<div className="opacity-90">{renderContent}</div>
					</div>
				)}

				<div className="mb-4 rounded-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
					{renderMediaContent()}
				</div>

				{post.poll && (
					<div className="mb-6 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-gray-100 dark:border-gray-800">
						<Poll poll={post.poll} postId={post?._id} />
					</div>
				)}

				<div className="flex flex-row items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4 mt-2">
					<div className="flex flex-row items-center gap-6">
						<button onClick={handleLike} disabled={liked} className="flex flex-row items-center gap-2 hover:opacity-80 transition-opacity group bg-transparent border-none cursor-pointer p-0">
							<Icons.Heart filled={liked} className={liked ? "text-red-500" : "text-gray-600 dark:text-gray-400"} />
							<span className={`text-xs font-black transition-colors ${liked ? "text-red-500" : "text-gray-500 group-hover:text-red-400"}`}>{formatViews(totalLikes)}</span>
						</button>
						<Link href={`/post/${post.slug || post?._id}?comment=open`} className="flex flex-row items-center gap-2 hover:opacity-80 transition-opacity group">
							<Icons.Comment className="text-gray-600 dark:text-gray-400" />
							<span className="text-xs font-black text-gray-500 group-hover:text-blue-500 transition-colors">{formatViews(totalComments)}</span>
						</Link>
						<Link href={`/post/${post.slug || post?._id}?comment=open`} className="hidden sm:flex flex-row items-center gap-2 hover:opacity-80 transition-opacity group">
							<Icons.Forum className="text-gray-600 dark:text-gray-400" />
							<span className="text-xs font-black text-gray-500 group-hover:text-blue-500 transition-colors">{formatViews(totalDiscussions)}</span>
						</Link>
					</div>

					<button onClick={handleWebShare} className="w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-gray-800/80 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors cursor-pointer p-0">
						<Icons.Share className="text-blue-600 dark:text-blue-400" />
					</button>
				</div>
			</div>

			<MediaModal
				isOpen={lightbox.open}
				onClose={() => setLightbox({ open: false, index: 0 })}
				mediaItems={mediaItems}
				currentIndex={currentAssetIndex}
				setCurrentIndex={setCurrentAssetIndex}
				handleDownload={handleDownloadMedia}
				isDownloading={isDownloading}
				isMediaSaved={isMediaSaved}
			/>
		</div>
	);
}
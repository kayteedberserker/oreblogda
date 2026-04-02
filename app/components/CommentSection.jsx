"use client";

import { motion, useAnimation } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useInView } from "react-intersection-observer";
import useSWR from "swr";
// import apiFetch from "../utils/apiFetch"; 

const API_URL = "https://oreblogda.com";
export const useScrollAnimation = () => {
  const controls = useAnimation();
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 });

  useEffect(() => {
    if (inView) controls.start("visible");
  }, [controls, inView]);

  const variants = {
    hidden: { opacity: 0, y: 40 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.6, ease: "easeOut" },
    },
  };

  return { ref, controls, variants };
};

// --- Helper Functions ---
const flattenReplies = (nodes) => {
  let flatList = [];
  const traverse = (items) => {
    if (!items) return;
    items.forEach(item => {
      flatList.push(item);
      if (item.replies && item.replies.length > 0) {
        traverse(item.replies);
      }
    });
  };
  traverse(nodes);
  return flatList.sort((a, b) => new Date(a.date) - new Date(b.date));
};

const countReplies = (nodes) => {
  let count = 0;
  if (!nodes) return 0;
  nodes.forEach(n => {
    count++;
    if (n.replies) count += countReplies(n.replies);
  });
  return count;
};

// --- Components ---
const CommentSkeleton = () => (
  <div className="mb-6 pl-4 border-l-2 border-gray-100 dark:border-gray-800 animate-pulse">
    <div className="h-5 w-32 bg-gray-200 dark:bg-gray-800 rounded-md mb-2" />
    <div className="h-4 w-full bg-gray-100 dark:bg-gray-800 rounded-md mb-1" />
  </div>
);

const SingleComment = ({ comment, onOpenDiscussion }) => {
  const { ref, controls, variants } = useScrollAnimation();
  const totalReplies = countReplies(comment.replies);
  const hasReplies = totalReplies > 0;
  const previewReply = comment.replies && comment.replies.length > 0 ? comment.replies[0] : null;
  const authorName = comment.author?.name || comment.name || "Anonymous";

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={variants}
      className="mb-6 border-l-2 border-blue-600/20 pl-4"
    >
      <div className="flex items-center gap-2 pr-2">
        <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
          {authorName}
        </span>
      </div>

      <p className="text-xs text-gray-600 dark:text-gray-300 font-bold leading-5 mt-1">
        {comment.text}
      </p>

      <div className="flex items-center mt-2 gap-4">
        <span className="text-gray-400 text-[10px] font-bold">
          {new Date(comment.date).toLocaleDateString()}
        </span>
        <button
          onClick={() => onOpenDiscussion(comment)}
          className="flex items-center bg-blue-600/10 px-3 py-1.5 rounded-full border border-blue-600/20 hover:bg-blue-600/20 transition-colors"
        >
          <span className="text-blue-600 text-[10px] font-black uppercase tracking-widest">
            {hasReplies ? `View Discussion (${totalReplies})` : "Start Discussion"}
          </span>
        </button>
      </div>

      {hasReplies && previewReply && (
        <div className="mt-3 opacity-60 bg-gray-50 dark:bg-white/5 p-2 rounded-lg border-l border-gray-300 dark:border-gray-700">
          <p className="text-[10px] font-black text-gray-500 uppercase">{previewReply.name || "Anonymous"}</p>
          <p className="text-[11px] text-gray-500 font-bold truncate">{previewReply.text}</p>
        </div>
      )}
    </motion.div>
  );
};

const HighlightableComment = ({ reply, isHighlighted }) => {
  const { ref, controls, variants } = useScrollAnimation();
  const authorName = reply.author?.name || reply.name || "Anonymous";

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={variants}
      className={`flex flex-col w-full mb-6 pr-2 transition-all duration-500 rounded-lg ${isHighlighted
        ? "bg-blue-600/10 scale-[1.02] p-3 border-l-2 border-blue-600"
        : "border-l-2 border-gray-300 dark:border-gray-700 pl-4"
        }`}
    >
      <span className="text-sm font-bold text-blue-500">
        {authorName}
      </span>
      <p className="text-xs text-gray-600 dark:text-gray-300 font-bold leading-5 mt-1">
        {reply.text}
      </p>
      <span className="text-[10px] font-bold text-gray-400 uppercase mt-2">
        {new Date(reply.date).toLocaleTimeString()}
      </span>
    </motion.div>
  );
};

const DiscussionDrawer = ({ visible, comment, onClose, slug, highlightId, onReply, isPosting }) => {
  const [replyText, setReplyText] = useState("");

  const displayComments = useMemo(() => {
    if (!comment) return [];
    return flattenReplies(comment.replies);
  }, [comment]);

  if (!visible || !comment) return null;

  const handleShare = async () => {
    const url = `${API_URL}/post/${slug}?discussion=${comment._id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join the discussion',
          text: 'Join the discussion on OreBlogda',
          url: url,
        });
      } catch (err) {
        console.log("Share failed:", err);
      }
    } else {
      navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 sm:items-center sm:p-4">
      <div className="absolute inset-0" onClick={onClose} />

      <div className="relative w-full max-w-2xl bg-white dark:bg-[#0a0a0a] rounded-t-[40px] sm:rounded-[40px] border-t-2 sm:border-2 border-blue-600/40 overflow-hidden h-[85vh] flex flex-col animate-in slide-in-from-bottom-full duration-300">

        {/* Header */}
        <div className="bg-white dark:bg-[#0a0a0a] border-b border-gray-100 dark:border-gray-800 z-10 shrink-0">
          <div className="flex items-center justify-center py-4 sm:hidden">
            <div className="w-12 h-1.5 bg-gray-200 dark:bg-gray-800 rounded-full" />
          </div>

          <div className="flex items-center justify-between px-6 pb-2 pt-2 sm:pt-6">
            <button onClick={onClose} className="bg-gray-100 dark:bg-white/10 px-4 py-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/20 transition-colors">
              <span className="text-[10px] font-black text-blue-600 uppercase">Close</span>
            </button>
            <button onClick={handleShare} className="flex items-center bg-blue-600 px-5 py-2 rounded-full shadow-md hover:bg-blue-700 transition-colors text-white">
              <span className="text-[10px] font-black uppercase">Share</span>
            </button>
          </div>

          <div className="bg-blue-50/50 dark:bg-blue-900/10 px-6 py-4 border-y border-blue-100 dark:border-blue-900/30">
            <span className="block text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Anchor Signal</span>
            <span className="block text-sm font-bold text-blue-600 mb-1">
              {comment.author?.name || comment.name || "Anonymous"}
            </span>
            <p className="text-xs text-gray-600 dark:text-gray-400 font-bold leading-5 line-clamp-3">
              {comment.text}
            </p>
          </div>
        </div>

        {/* Comments List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 custom-scrollbar">
          <span className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-6">Live Feed</span>
          {displayComments.length > 0 ? (
            displayComments.map((reply, idx) => (
              <HighlightableComment
                key={reply._id || idx}
                reply={reply}
                isHighlighted={highlightId === reply._id}
              />
            ))
          ) : (
            <p className="text-center text-gray-500 text-xs font-bold mt-10">No replies yet. Be the first!</p>
          )}
        </div>

        {/* Input Area with Notification Upsell */}
        <div className="bg-white dark:bg-[#0a0a0a] p-4 border-t border-gray-100 dark:border-gray-800">
          <div className="flex gap-3 mb-3">
            <textarea
              placeholder="Write a reply..."
              className="flex-1 bg-gray-50 dark:bg-gray-900 p-3 rounded-xl text-sm font-bold dark:text-white border border-gray-200 dark:border-gray-800 resize-none outline-none focus:border-blue-500"
              rows={1}
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
            />
            <button
              onClick={() => {
                if (replyText.trim() && !isPosting) {
                  onReply(comment._id, replyText);
                  setReplyText("");
                }
              }}
              disabled={isPosting}
              className="bg-blue-600 text-white px-5 rounded-xl font-black uppercase text-[11px] hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isPosting ? "..." : "Send"}
            </button>
          </div>
          {/* The Upsell Banner */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-2 border border-blue-100 dark:border-blue-900/50">
            <p className="text-[11px] font-bold text-blue-700 dark:text-blue-300">
              🔔 Track this discussion & get notified of replies.
            </p>
            <button className="bg-blue-600 text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase whitespace-nowrap hover:bg-blue-700">
              Get App
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function WebCommentSection({ postId, slug, discussionIdfromPage }) {
  const { ref, controls, variants } = useScrollAnimation();
  const searchParams = useSearchParams();
  const discussion = searchParams.get('discussion');
  const commentId = searchParams.get('commentId');
  const targetId = discussion || commentId || discussionIdfromPage;

  const [text, setText] = useState("");
  const [isPosting, setIsPosting] = useState(false);
  const [activeDiscussion, setActiveDiscussion] = useState(null);
  const [activeHighlightId, setActiveHighlightId] = useState(null);
  const [pagedComments, setPagedComments] = useState([]);
  const [page, setPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const hasAutoOpened = useRef(false);

  // Mock API fetch for SWR - Replace with actual fetcher
  const mockFetcher = async (url) => {
    const res = await fetch(API_URL + url);
    if (!res.ok) throw new Error("Failed to load");
    return res.json();
  };

  const { data, isLoading, mutate } = useSWR(
    `/api/posts/${postId}/comment?page=1&limit=40`,
    mockFetcher,
    { refreshInterval: 30000 }
  );

  useEffect(() => {
    if (data?.comments && page === 1) {
      setPagedComments(data.comments);
    }
  }, [data, page]);

  // Handle posting new signal or replying in discussion
  const handlePostComment = async (parentId = null, replyContent = null) => {
    const content = replyContent || text;
    if (!content.trim()) return;

    setIsPosting(true);
    try {
      // Replace with your actual API endpoint/fetch logic
      const res = await fetch(`${API_URL}/api/posts/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: "Anonymous User", // Or handle actual web auth if you ever add it
          text: content,
          parentCommentId: parentId,
        }),
      });

      if (res.ok) {
        const responseData = await res.json();
        if (parentId) {
          // Refresh data to show new reply inside the drawer
          mutate();
        } else {
          setPagedComments(prev => [responseData.comment, ...prev]);
          setText("");
        }
      }
    } catch (err) {
      console.error("Link Failure", err);
    } finally {
      setIsPosting(false);
    }
  };

  const handleLoadMore = async () => {
    if (isLoadingMore || !data?.hasMore) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const result = await mockFetcher(`/posts/${postId}/comment?page=${nextPage}&limit=40`);
      setPagedComments(prev => [...prev, ...result.comments]);
      setPage(nextPage);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const findAndOpenComment = (tId) => {
    if (!tId || pagedComments.length === 0) return;

    const target = pagedComments.find(c => {
      if (c._id === tId) return true;
      const search = (nodes) => nodes?.some(n => n._id === tId || search(n.replies));
      return search(c.replies);
    });

    if (target) {
      setActiveDiscussion(target);
      setActiveHighlightId(tId);
      hasAutoOpened.current = true;
    }
  };

  useEffect(() => {
    if (pagedComments.length > 0 && targetId && !hasAutoOpened.current) {
      findAndOpenComment(targetId);
    }
  }, [targetId, pagedComments]);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={variants}
      className="bg-white/80 dark:bg-black/40 rounded-[32px] p-5 md:p-8 border border-gray-100 dark:border-blue-900/30 shadow-2xl mt-4"
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
          <span className="text-sm font-[900] uppercase tracking-[0.3em] text-gray-900 dark:text-white">Comms_Feed</span>
        </div>
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          {data?.total || pagedComments.length} Signals
        </span>
      </div>

      {/* Input Area + Upsell for Top Level Comments */}
      <div className="mb-8">
        <div className="gap-3 mb-3 flex flex-col">
          <textarea
            placeholder="ENTER ENCRYPTED MESSAGE..."
            className="w-full p-4 rounded-xl border-2 border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-[13px] font-black tracking-widest text-gray-900 dark:text-white min-h-[100px] outline-none focus:border-blue-500 transition-colors"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            onClick={() => handlePostComment()}
            disabled={isPosting}
            className="bg-blue-600 h-14 rounded-xl flex justify-center items-center shadow-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            <span className="text-[13px] font-black text-white uppercase tracking-widest">
              {isPosting ? "Transmitting..." : "Transmit Signal"}
            </span>
          </button>
        </div>

        {/* The Upsell Banner */}
        <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg flex flex-col sm:flex-row items-center justify-between gap-4 border border-gray-200 dark:border-gray-800">
          <p className="text-[11px] font-bold text-gray-500">
            🔔 Want to be notified when someone replies to your signal?
          </p>
          <button className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg text-[10px] font-black uppercase whitespace-nowrap hover:bg-gray-300 dark:hover:bg-gray-700 transition-colors">
            Download App
          </button>
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto custom-scrollbar pr-2">
        {isLoading && page === 1 ? (
          <div>
            <CommentSkeleton />
            <CommentSkeleton />
            <CommentSkeleton />
          </div>
        ) : pagedComments.length > 0 ? (
          <div>
            {pagedComments.map((c, i) => (
              <SingleComment
                key={c._id || i}
                comment={c}
                onOpenDiscussion={(comm) => {
                  setActiveHighlightId(null);
                  setActiveDiscussion(comm);
                }}
              />
            ))}
            {data?.hasMore && (
              <button
                onClick={handleLoadMore}
                disabled={isLoadingMore}
                className="w-full py-6 flex justify-center border-t border-gray-100 dark:border-gray-800 disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-900/50 transition-colors"
              >
                <span className="text-blue-600 font-black text-[11px] uppercase tracking-widest">
                  {isLoadingMore ? "Loading..." : "Load More Signals"}
                </span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-10 opacity-40">
            <span className="text-[15px] font-bold text-gray-500 uppercase tracking-widest text-center mt-3">
              Awaiting First Signal...
            </span>
          </div>
        )}
      </div>

      <DiscussionDrawer
        visible={!!activeDiscussion}
        comment={activeDiscussion}
        onClose={() => {
          setActiveDiscussion(null);
          setActiveHighlightId(null);
        }}
        slug={slug}
        highlightId={activeHighlightId}
        onReply={handlePostComment}
        isPosting={isPosting}
      />
    </motion.div>
  );
}
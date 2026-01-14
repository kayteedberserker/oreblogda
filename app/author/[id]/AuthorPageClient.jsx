"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import PostCard from "@/app/components/PostCard";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import FeedAd from "@/app/components/FeedAd";
export default function AuthorPageClient({ author, initialPosts = [], total: initialTotal = 0 }) {
  const [posts, setPosts] = useState(initialPosts);
  const [totalPosts, setTotalPosts] = useState(initialTotal); // Use total from API
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchMorePosts = useCallback(async () => {
    if (!hasMore || loading) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/posts?author=${author._id || author.id}&page=${page + 1}&limit=6`
      );
      const data = await res.json();

      if (res.ok) {
        setPosts((prev) => [...prev, ...data.posts]);
        setTotalPosts(data.total); // Update total count from backend response
        setPage((prev) => prev + 1);
        if (data.posts.length < 6) setHasMore(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [author, page, hasMore, loading]);

  const handleLoadMore = () => {
    fetchMorePosts();
  };

  const getOptimizedCloudinaryUrl = (url) => {
    if (!url || !url.includes("cloudinary.com")) return url || "/default-avatar.png";
    return url.replace("/upload/", "/upload/w_300,c_fill,g_face,f_auto,q_auto/");
  };

  // --- ANIME RANKING LOGIC (Using lifetime totalPosts from API) ---
  const rankData = useMemo(() => {
    const count = totalPosts;
    if (count > 150) return { title: "Master_Writer", icon: "👑", next: 200, color: "bg-yellow-500" };
    if (count > 120) return { title: "Elite_Writer", icon: "💎", next: 150, color: "bg-purple-500" };
    if (count > 100) return { title: "Senior_Writer", icon: "🔥", next: 120, color: "bg-red-500" };
    if (count > 50)  return { title: "Novice_Writer", icon: "⚔️", next: 100, color: "bg-blue-500" };
    if (count > 25)  return { title: "Senior_Researcher", icon: "📜", next: 50, color: "bg-green-500" };
    return { title: "Novice_Researcher", icon: "🛡️", next: 25, color: "bg-gray-500" };
  }, [totalPosts]);

  const progress = Math.min((totalPosts / rankData.next) * 100, 100);

  return (
    <div className="max-w-7xl mx-auto px-4 mt-10 min-h-screen">
      
      {/* --- AUTHOR DOSSIER HEADER --- */}
      {author && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-12 p-6 md:p-10 bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-gray-200 dark:border-blue-900/30 rounded-[2rem] shadow-2xl overflow-hidden"
        >
          {/* Tactical Background Elements */}
          <div className="absolute top-0 right-0 p-4 opacity-10 font-mono text-[40px] font-black select-none uppercase italic">
            Operator
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-blue-600/50 to-transparent" />

          <div className="relative z-10 flex flex-col md:flex-row items-center gap-8">
            {/* Avatar with Digital Frame */}
            <div className="relative group">
              <div className="absolute inset-0 bg-blue-600 rounded-full animate-pulse blur-md opacity-20 group-hover:opacity-40 transition-opacity" />
              <div className="relative w-32 h-32 md:w-44 md:h-44 rounded-full overflow-hidden border-4 border-white dark:border-gray-900 shadow-xl bg-gray-100 dark:bg-gray-800">
                <Image
                  src={getOptimizedCloudinaryUrl(author.profilePic?.url)}
                  alt={author.username}
                  fill
                  priority 
                  sizes="(max-width: 768px) 128px, 176px"
                  className="object-cover"
                />
              </div>
              <div className="absolute bottom-2 right-4 w-6 h-6 bg-green-500 border-4 border-white dark:border-gray-950 rounded-full shadow-lg" />
            </div>

            <div className="text-center md:text-left flex-1 w-full">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-600/10 border border-blue-600/20 mb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-blue-600">Verified_Intel_Source</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white mb-3">
                {author.username}
              </h1>
              <p className="text-sm md:text-base text-gray-600 dark:text-gray-400 max-w-2xl leading-relaxed font-medium">
                {author.description || "This operator hasn’t synchronized a bio with the central network yet."}
              </p>
              
              {/* --- ANIME RPG HUD RANKING --- */}
              <div className="mt-8 max-w-md mx-auto md:mx-0">
                <div className="flex justify-between items-end mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{rankData.icon}</span>
                    <div className="flex flex-col">
                      <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-blue-500 leading-none mb-1">Current_Class</span>
                      <span className="text-sm font-black uppercase tracking-tight dark:text-white">
                        {rankData.title}
                      </span>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono font-bold text-gray-500">
                    EXP: {totalPosts} / {totalPosts > 150 ? "MAX" : rankData.next}
                  </span>
                </div>

                {/* Tactical Progress Bar */}
                <div className="h-2 w-full bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-300 dark:border-white/10 shadow-inner">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1.5, ease: "circOut" }}
                    className={`h-full ${rankData.color} shadow-[0_0_10px_rgba(37,99,235,0.4)]`}
                  />
                </div>

                <div className="flex justify-between mt-2">
                   <span className="text-[8px] font-mono uppercase tracking-widest opacity-50 dark:text-gray-400">
                    Status: {totalPosts > 100 ? "Limit_Breaker" : "Online"}
                  </span>
                  <span className="text-[8px] font-mono uppercase tracking-widest opacity-50 dark:text-gray-400">
                    Lifetime_Contributions: {totalPosts}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* --- FEED SECTION --- */}
      <div className="relative">
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">
            Intel <span className="text-blue-600">Archives</span>
          </h2>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-blue-600/30 to-transparent" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {posts.map((post) => (
            <motion.div 
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              key={post._id}
            >
              <PostCard post={post} isFeed />
              {(index + 1) % 2 === 0 && (
                     <div className="my-10 w-full p-4 px-2 border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl flex flex-col items-center gap-1 justify-center bg-gray-50/50 dark:bg-white/5">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">Sponsored Transmission</span>
                       <FeedAd /> 
                  </div>
                  )}
            </motion.div>
          ))}
        </div>

        {/* --- LOAD MORE --- */}
        {hasMore && (
          <div className="flex flex-col items-center justify-center my-16 gap-4">
            <button
              onClick={handleLoadMore}
              disabled={loading}
              className="group relative px-12 py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl overflow-hidden shadow-2xl transition-all active:scale-95 disabled:opacity-70"
            >
              <div className="relative z-10 flex items-center gap-3">
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    <span className="text-xs font-black uppercase tracking-[0.2em]">Syncing_Data...</span>
                  </>
                ) : (
                  <span className="text-xs font-black uppercase tracking-[0.2em]">Fetch_More_Intel</span>
                )}
              </div>
              <div className={`absolute bottom-0 left-0 h-1 bg-blue-600 transition-all duration-300 ${loading ? 'w-full animate-[loading_2s_infinite]' : 'w-0'}`} />
            </button>
          </div>
        )}

        {!hasMore && posts.length > 0 && (
          <div className="text-center py-10 opacity-30">
            <div className="h-[1px] w-24 bg-gray-500 mx-auto mb-4" />
            <p className="text-[10px] font-mono uppercase tracking-[0.4em]">End_Of_Transmission</p>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}

"use client";
import { useState, useEffect } from "react";
import useSWRInfinite from "swr/infinite";
import PostCard from "@/app/components/PostCard";
import RecentPollsCard from "@/app/components/RecentPollsCard";
import { FaPoll } from "react-icons/fa";
import { useScrollAnimation } from "@/app/components/useScrollAnimation";
import { motion } from "framer-motion";
import FeedAd from "@/app/components/FeedAd";

const limit = 5;
const fetcher = (url) => fetch(url, { cache: "no-store" }).then((res) => res.json());

export default function ClientCategoryPage({ category, initialPosts }) {
  const { ref, controls, variants } = useScrollAnimation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // SWR Infinite Pagination
  const getKey = (pageIndex, previousPageData) => {
    if (!category) return null;
    if (previousPageData && previousPageData.posts?.length < limit) return null;
    return `/api/posts?category=${category}&page=${pageIndex + 1}&limit=${limit}`;
  };

  const { data, size, setSize, isLoading, isValidating } = useSWRInfinite(getKey, fetcher, {
    initialData: [{ posts: initialPosts }],
  });

  // Combine & deduplicate
  const posts = data ? data.flatMap((p) => p.posts || []) : [];
  const uniquePosts = Array.from(new Map(posts.map((p) => [p._id, p])).values());
  const hasMore = data && data[data.length - 1]?.posts?.length === limit;

  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 &&
        hasMore &&
        !isLoading &&
        !isValidating
      ) {
        setSize((prev) => prev + 1);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, isLoading, isValidating, setSize]);

  return (
    <div 
      ref={ref} 
      initial="hidden" 
      animate={controls} 
      variants={variants} 
      className="bg-transparent rounded-2xl shadow-md"
    >
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 relative min-h-[75vh]">

        {/* --- ATMOSPHERIC BACKGROUND EFFECTS --- */}
        <div className="absolute top-10 left-10 w-48 h-48 bg-blue-400 dark:bg-indigo-900 opacity-10 rounded-full blur-[100px] animate-pulse pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-56 h-56 bg-blue-300 dark:bg-blue-700 opacity-10 rounded-full blur-[120px] animate-pulse pointer-events-none" />

        {/* FIX: added items-start and overflow-visible to support sticky sidebar */}
        <div className="md:flex md:gap-12 items-start overflow-visible">
          
          {/* --- MAIN CONTENT AREA --- */}
          {/* PERFORMANCE FIX: Removed max-h and overflow-y to stop Forced Reflows and enable sticky sidebar */}
          <div
            id="postsContainer"
            className="md:flex-1 pr-2 scrollbar-hide"
          >
            {/* Category HUD Header */}
            <div className="relative mb-10 pb-4 border-b-2 border-gray-100 dark:border-gray-800">
              <div className="flex items-center gap-3 mb-1">
                <div className="h-2 w-2 bg-blue-600 rounded-full animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">Archive Sector</span>
              </div>
              <h1 className="text-4xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white">
                Folder: <span className="text-blue-600">{category}</span>
              </h1>
              <div className="absolute bottom-0 left-0 h-[2px] w-20 bg-blue-600" />
            </div>

            <div className="flex flex-col gap-6">
              {uniquePosts.map((post, index) => (
                <div key={post._id} className="break-inside-avoid">
                  <PostCard 
                    post={post} 
                    posts={uniquePosts} 
                    setPosts={() => { }} 
                    isFeed 
                    isPriority={index < 2} // Optimization for LCP
                  />
                  
                  {/* Ad Placeholder logic kept consistent */}
                  {(index + 1) % 2 === 0 (
                     <div className="my-10 w-full p-4 border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl flex flex-col align-center justify-center bg-gray-50/50 dark:bg-white/5">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">Sponsored Transmission</span>
                       <FeedAd /> 
                  </div>
                  )}
                </div>
              ))}
            </div>

            {/* --- LOADING & FEEDBACK --- */}
            {/* FIX: Added min-h-[140px] to stabilize layout during loading (Fixes CLS) */}
            <div className="py-12 min-h-[140px] flex flex-col items-center justify-center">
              {(isLoading || isValidating) ? (
                <div className="flex flex-col items-center gap-3">
                   {/* Custom Loading Animation per instructions */}
                   <div className="w-16 h-1 bg-gray-100 dark:bg-gray-800 overflow-hidden rounded-full">
                      <div className="h-full bg-blue-600 animate-[loading_1.5s_infinite]" />
                   </div>
                   <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 animate-pulse">
                      Retrieving Data...
                   </p>
                </div>
              ) : hasMore ? (
                <div className="text-center mt-6">
                  <button
                    aria-label="Load more"
                    onClick={() => setSize((prev) => prev + 1)}
                    className="group relative px-8 py-3 bg-gray-900 dark:bg-white rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95"
                  >
                    <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform" />
                    <span className="relative z-10 text-white dark:text-black group-hover:text-white font-black uppercase italic tracking-widest text-xs">
                      Fetch More Records
                    </span>
                  </button>
                </div>
              ) : uniquePosts.length > 0 ? (
                <p className="text-center text-[10px] font-black uppercase tracking-[0.5em] text-gray-400 mt-4">
                  END OF ARCHIVE
                </p>
              ) : (
                <div className="text-center py-20 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-3xl w-full">
                  <p className="text-gray-500 font-black uppercase italic tracking-widest">
                    No posts found in <span className="text-blue-600">{category}</span>
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* --- DESKTOP SIDEBAR --- */}
          {/* FIX: h-fit and top-24 ensure the sidebar sticks correctly */}
          <aside className="hidden md:flex flex-col gap-6 md:w-[350px] lg:w-[450px] sticky top-24 h-fit">
            <div className="flex items-center gap-2 mb-4">
              <div className="h-1 w-4 bg-blue-600" />
              <span className="text-[10px] font-black uppercase tracking-widest">Sidebar Widgets</span>
            </div>
            <RecentPollsCard />
          </aside>

          {/* --- TACTICAL MINI DRAWER (Mobile Only) --- */}
          <div className="md:hidden">
            <button
              aria-label="Open drawer"
              onClick={() => setDrawerOpen((prev) => !prev)}
              className={`fixed top-1/2 -right-2 transform -translate-y-1/2 z-50 w-14 h-14 rounded-l-2xl flex items-center justify-center shadow-2xl transition-all ${
                drawerOpen ? "bg-red-600" : "bg-blue-600"
              }`}
            >
              <div className="relative">
                {drawerOpen ? <span className="text-xl text-white">✕</span> : <FaPoll className="text-xl text-white" />}
                {!drawerOpen && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-blue-600 animate-ping" />}
              </div>
            </button>

            {/* Drawer Sliding Panel */}
            <div
              className={`fixed top-0 right-0 z-40 h-full w-[85%] bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-l border-blue-600/20 p-6 shadow-[-20px_0_50px_rgba(0,0,0,0.3)] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                drawerOpen ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <div className="mt-20">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter">Tactical HUD</h2>
                  <span className="text-[8px] font-mono opacity-40 italic">SECURE_LINK</span>
                </div>
                <RecentPollsCard />
              </div>
            </div>

            {/* Backdrop Blur */}
            {drawerOpen && (
              <div 
                onClick={() => setDrawerOpen(false)}
                className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30" 
              />
            )}
          </div>
        </div>

        {/* Global Styles for this component */}
        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar { width: 0px; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }

          div[style*="overflow-y: auto"]::-webkit-scrollbar { width: 4px; }
          div[style*="overflow-y: auto"]::-webkit-scrollbar-thumb {
            background-color: #2563eb;
            border-radius: 10px;
          }
        `}</style>
      </div>
    </div>
  );
}

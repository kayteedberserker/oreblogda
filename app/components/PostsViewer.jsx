"use client";
import { useState, useEffect } from "react";
import useSWRInfinite from "swr/infinite";
import PostCard from "./PostCard";
import RecentPollsCard from "./RecentPollsCard";
import { FaPoll } from "react-icons/fa";
import { useScrollAnimation } from "./useScrollAnimation";
import dynamic from "next/dynamic";
const ArticleAd = dynamic(() => import("./ArticleAd"), {
  ssr: false,
});
const FooterAds = dynamic(() => import("./FooterAds"), {
  ssr: false,
});

const limit = 5;
const fetcher = (url) => fetch(url, { cache: "no-store" }).then((res) => res.json());

export default function PostsViewer({ initialPosts }) {
  const { ref, controls, variants } = useScrollAnimation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // --- SWR Infinite ---
  const getKey = (pageIndex, previousPageData) => {
    if (previousPageData && previousPageData.posts?.length < limit) return null;
    return `/api/posts?page=${pageIndex + 1}&limit=${limit}`;
  };

  const { data, size, setSize, isValidating, isLoading } = useSWRInfinite(getKey, fetcher, {
    initialData: [{ posts: initialPosts || [] }],
  });

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
    <div className="max-w-7xl mx-auto md:px-8 py-8 bg-white dark:bg-[#0a0a0a00] min-h-screen transition-colors duration-500">
      
      {/* --- AMBIENT BACKGROUND ELEMENTS --- */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-blue-600 to-transparent opacity-50 z-50" />
      
      {/* STRICT FIX FOR STICKY: 
          1. items-start prevents the sidebar from growing to match the Post height.
          2. The parent MUST NOT have overflow-hidden or overflow-auto.
      */}
      <div className="md:flex md:gap-12 items-start overflow-visible">
        
        {/* --- MAIN CONTENT: THE DATA STREAM --- */}
        {/* PERFORMANCE FIX: Removed max-h-screen and overflow-y-auto to stop Forced Reflows and Layout Shifts */}
        <div
          id="postsContainer"
          className="md:flex-1 pr-4 scrollbar-hide px-4 md:px-0"
        >
          {/* Header with Scan-line effect */}
          <div className="relative mb-10 pb-4 border-b-2 border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-1">
                <div className="h-3 w-3 bg-blue-600 rounded-full animate-ping" />
                <span className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-600">Live Feed Active</span>
            </div>
            <h1 className="text-5xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white">
              Anime <span className="text-blue-600">Intel</span>
            </h1>
            <div className="absolute bottom-0 left-0 h-[2px] w-24 bg-blue-600" />
          </div>

          <div className="flex flex-col gap-8">
            {uniquePosts.map((post, index) => (
              <div key={post._id} className="relative group">
                <PostCard
                  post={post}
                  posts={uniquePosts}
                  setPosts={() => { }}
                  isFeed
                  /* Optimization: Give priority to the first two images in the viewport */
                  isPriority={index < 2}
                />

                {/* AD TERMINAL SLOT */}
                {index % 2 === 1 && (
                  <div className="my-10 w-full p-4 border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl flex justify-center bg-gray-50/50 dark:bg-white/5">
                      {/* <AdsterraBannerSync /> */}
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">Sponsored Transmission</span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* LOADING & LOAD MORE STATE */}
          {/* FIX: Added min-h-[140px] to keep the container stable during loading (Fixes CLS) */}
          <div className="py-12 border-t border-gray-100 dark:border-gray-800 mt-10 min-h-[140px] flex flex-col items-center justify-center">
            {(isLoading || isValidating) ? (
              <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-1 bg-gray-200 dark:bg-gray-800 overflow-hidden">
                     <div className="h-full bg-blue-600 animate-[loading_1.5s_infinite]" />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 animate-pulse">
                    Synchronizing...
                  </p>
              </div>
            ) : hasMore ? (
              <div className="text-center">
                <button
                  aria-label="Load more"
                  onClick={() => setSize((prev) => prev + 1)}
                  className="group relative px-10 py-4 bg-gray-900 dark:bg-white rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95"
                >
                  <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform" />
                  <span className="relative z-10 text-white dark:text-black group-hover:text-white font-black uppercase italic tracking-widest text-xs">
                    Expand Feed +
                  </span>
                </button>
              </div>
            ) : uniquePosts.length > 0 ? (
              <p className="text-center text-[10px] font-black uppercase tracking-[0.5em] text-gray-400">
                End of Transmission
              </p>
            ) : (
              <div className="text-center py-20">
                  <h2 className="text-2xl font-black uppercase italic text-gray-300">No Intel Found</h2>
              </div>
            )}
          </div>
        </div>

        {/* --- DESKTOP SIDEBAR --- */}
        {/* SIDEBAR REPAIR: 
            'h-fit' ensures the sidebar only takes up as much room as the poll card.
            'top-24' needs to be adjusted based on your navbar height.
        */}
        <aside className="hidden md:flex flex-col gap-6 md:w-[350px] lg:w-[450px] sticky top-20 h-fit">
          <div className="flex items-center gap-2 mb-4 ml-1">
            <div className="h-1 w-4 bg-blue-600" />
            <span className="text-[10px] font-black uppercase tracking-widest">Sidebar Widgets</span>
          </div>
          <RecentPollsCard />
          {/* You can add FooterAds here if you want them to stick as well */}
        </aside>

        {/* --- THE TACTICAL MOBILE DRAWER --- */}
        <div className="md:hidden">
          {/* Glowing Trigger Button */}
          <button
            aria-label="Open drawer"
            onClick={() => setDrawerOpen((prev) => !prev)}
            className={`fixed top-1/2 -right-2 transform -translate-y-1/2 z-50 w-14 h-14 rounded-l-2xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all ${
              drawerOpen ? "bg-red-600" : "bg-blue-600"
            }`}
          >
            <div className="relative">
               {drawerOpen ? <span className="text-xl">✕</span> : <FaPoll className="text-xl text-white" />}
               {!drawerOpen && <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-blue-600 animate-bounce" />}
            </div>
          </button>

          {/* Drawer Overlay Terminal */}
          <div
            className={`fixed top-0 right-0 z-40 h-full w-[85%] bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-l border-blue-600/20 p-6 shadow-[-20px_0_50px_rgba(0,0,0,0.2)] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${
              drawerOpen ? "translate-x-0" : "translate-x-full"
            }`}
          >
            <div className="mt-16">
               <div className="flex items-center justify-between mb-8">
                  <h2 className="text-2xl font-black italic uppercase tracking-tighter">Tactical HUD</h2>
                  <span className="text-[8px] font-mono opacity-50">v2.0.26_SYNC</span>
               </div>
               
               <div className="space-y-6">
                 <RecentPollsCard />
               </div>
               
               <div className="absolute bottom-10 left-6 right-6 p-4 border border-blue-600/10 rounded-2xl">
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-600 opacity-50">System Link: Stable</p>
               </div>
            </div>
          </div>

          {/* Backdrop Blur */}
          {drawerOpen && (
            <div 
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 animate-in fade-in duration-300" 
            />
          )}
        </div>
      </div>

      <style jsx>{`
        .scrollbar-hide::-webkit-scrollbar { width: 0px; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
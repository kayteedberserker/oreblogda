"use client";
import { useState, useEffect, useMemo } from "react";
import useSWRInfinite from "swr/infinite";
import PostCard from "@/app/components/PostCard";
import RecentPollsCard from "@/app/components/RecentPollsCard";
import { FaPoll } from "react-icons/fa";
import { useScrollAnimation } from "@/app/components/useScrollAnimation";
import FeedAd from "@/app/components/FeedAd";

const limit = 5;
const fetcher = (url) => fetch(url, { cache: "no-store" }).then((res) => res.json());

export default function ClientCategoryPage({ category, initialPosts }) {
  const { ref } = useScrollAnimation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // SWR Infinite Pagination
  const getKey = (pageIndex, previousPageData) => {
    if (!category) return null;
    if (previousPageData && (!previousPageData.posts || previousPageData.posts.length < limit)) return null;
    return `/api/posts?category=${category}&page=${pageIndex + 1}&limit=${limit}`;
  };

  const { data, size, setSize, isLoading, isValidating } = useSWRInfinite(getKey, fetcher, {
    fallbackData: initialPosts ? [{ posts: initialPosts }] : [],
    revalidateFirstPage: false,
    persistSize: true,
  });

  // MEMOIZED: Prevent expensive re-renders during scroll
  const uniquePosts = useMemo(() => {
    const posts = data ? data.flatMap((p) => (Array.isArray(p?.posts) ? p.posts : [])) : [];
    return Array.from(new Map(posts.filter(p => p && p._id).map((p) => [p._id, p])).values());
  }, [data]);
  
  const hasMore = data && data[data.length - 1]?.posts?.length === limit;

  // Optimized Infinite scroll with Throttling check
  useEffect(() => {
    let isFetching = false;
    const handleScroll = () => {
      if (isFetching) return;
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 1000 &&
        hasMore && !isLoading && !isValidating
      ) {
        isFetching = true;
        setSize((prev) => prev + 1);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, isLoading, isValidating, setSize]);

  return (
    <div ref={ref} className="bg-transparent">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 relative min-h-screen">

        {/* --- PERFORMANCE-FIRST BACKGROUND --- */}
        <div className="fixed inset-0 pointer-events-none">
          <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-blue-500/5 to-transparent dark:from-blue-600/5" />
          {/* Subtle grid like the app */}
          <div className="absolute inset-0 opacity-[0.02] dark:opacity-[0.03]" 
               style={{ backgroundImage: `radial-gradient(#2563eb 0.5px, transparent 0.5px)`, backgroundSize: '30px 30px' }} />
        </div>

        <div className="md:flex md:gap-12 items-start relative z-10">
          
          {/* --- MAIN CONTENT AREA --- */}
          <div id="postsContainer" className="md:flex-1">
            {/* Category HUD Header */}
            <div className="relative mb-12 pb-6">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-1.5 w-1.5 bg-blue-600 rounded-full" />
                <span className="text-[9px] font-black uppercase tracking-[0.4em] text-blue-600">Sector_Access</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase text-zinc-900 dark:text-white">
                {category}
              </h1>
              <div className="mt-4 h-1 w-12 bg-blue-600 rounded-full" />
            </div>

            <div className="flex flex-col gap-8">
              {uniquePosts.length > 0 ? (
                uniquePosts.map((post, index) => (
                  <div key={post._id || index}>
                    <PostCard 
                      post={post} 
                      posts={uniquePosts} 
                      setPosts={() => { }} 
                      isFeed 
                      isPriority={index < 2} 
                    />
                    
                    {(index + 1) % 3 === 0 && (
                       <div className="my-12 w-full p-6 border border-zinc-200 dark:border-zinc-800 rounded-[2.5rem] bg-zinc-50/50 dark:bg-zinc-900/20">
                         <div className="flex items-center gap-2 mb-4">
                            <div className="w-1 h-1 bg-zinc-400 rounded-full" />
                            <span className="text-[8px] font-bold text-zinc-400 uppercase tracking-widest">Sponsored_Stream</span>
                         </div>
                         <FeedAd /> 
                      </div>
                    )}
                  </div>
                ))
              ) : !isLoading && (
                <div className="py-32 flex flex-col items-center border-2 border-dashed border-zinc-100 dark:border-zinc-900 rounded-[3rem]">
                  <p className="text-zinc-400 font-black uppercase italic tracking-widest text-sm">
                    Empty Archive: <span className="text-blue-600">{category}</span>
                  </p>
                </div>
              )}
            </div>

            {/* --- LOADING & FEEDBACK --- */}
            <div className="py-20 flex flex-col items-center">
              {(isLoading || (isValidating && size > (data?.length || 0))) ? (
                <div className="flex flex-col items-center gap-4">
                   <div className="flex gap-1.5">
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
                      <div className="w-2 h-2 bg-blue-600 rounded-full animate-bounce" />
                   </div>
                   <p className="text-[9px] font-black uppercase tracking-[0.5em] text-blue-600">
                      Syncing_Sector...
                   </p>
                </div>
              ) : !hasMore && uniquePosts.length > 0 && (
                <div className="flex flex-col items-center gap-4 opacity-30">
                  <div className="h-[1px] w-12 bg-zinc-500" />
                  <p className="text-[10px] font-black uppercase tracking-[0.5em] text-zinc-500">
                    Transmission_End
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* --- DESKTOP SIDEBAR --- */}
          <aside className="hidden lg:flex flex-col gap-8 w-[400px] sticky top-28 h-fit">
            <div className="p-1 border-b border-zinc-100 dark:border-zinc-900 mb-2">
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Tactical_Widgets</span>
            </div>
            <RecentPollsCard />
          </aside>

          {/* --- TACTICAL MINI DRAWER (Mobile) --- */}
          <div className="md:hidden">
            <button
              onClick={() => setDrawerOpen((prev) => !prev)}
              className={`fixed bottom-10 right-6 z-50 w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all duration-300 ${
                drawerOpen ? "bg-zinc-900 dark:bg-white rotate-90" : "bg-blue-600"
              }`}
            >
              {drawerOpen ? (
                <span className="text-xl text-white dark:text-black">✕</span>
              ) : (
                <FaPoll className="text-xl text-white" />
              )}
            </button>

            <div className={`fixed inset-0 z-40 transition-opacity duration-300 ${drawerOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
              <div onClick={() => setDrawerOpen(false)} className="absolute inset-0 bg-white/80 dark:bg-black/80 backdrop-blur-md" />
              <div className={`absolute bottom-0 left-0 w-full bg-white dark:bg-[#0a0a0a] rounded-t-[3rem] p-8 pb-20 border-t border-blue-600/20 transform transition-transform duration-500 ease-out ${drawerOpen ? "translate-y-0" : "translate-y-full"}`}>
                <div className="w-12 h-1.5 bg-zinc-200 dark:bg-zinc-800 rounded-full mx-auto mb-8" />
                <h2 className="text-3xl font-black italic uppercase tracking-tighter mb-8">Poll_Center</h2>
                <RecentPollsCard />
              </div>
            </div>
          </div>
        </div>

        <style jsx>{`
          @keyframes loading {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(100%); }
          }
        `}</style>
      </div>
    </div>
  );
}

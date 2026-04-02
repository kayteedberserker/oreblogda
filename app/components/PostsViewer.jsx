"use client";

import dynamic from "next/dynamic";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { FaPoll } from "react-icons/fa";
import { mutate as globalMutate } from "swr"; // ⚡️ ADDED globalMutate for instant hydration
import useSWRInfinite from "swr/infinite";

// Components
import PostCard from "./PostCard";
import RecentPollsCard from "./RecentPollsCard";
import { useScrollAnimation } from "./useScrollAnimation";

// Dynamic Ad Component
const FeedAd = dynamic(() => import("./FeedAd"), { ssr: false });

const LIMIT = 15;
const CACHE_KEY = "POSTS_CACHE_V1";
const API_URL = "https://oreblogda.com"; // Adjust if using relative /api paths

// Memory Cache to prevent flash-of-empty on route changes
const SESSION_STATE = {
  memoryCache: null,
  hasFetched: false
};

const fetcher = (url) => fetch(url).then(res => res.json());

// ⚡️ PERFORMANCE FIX 1: Aggressively Memoize the List Item
const MemoizedPostItem = memo(({ item, isVisible, syncing, mutate, posts }) => {
  return (
    <PostCard
      post={item}
      authorData={item.authorData}
      clanData={item.clanData}
      isFeed
      posts={posts}
      setPosts={mutate}
      syncing={syncing}
      isVisible={isVisible}
    />
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.isVisible === nextProps.isVisible &&
    prevProps.syncing === nextProps.syncing &&
    prevProps.item === nextProps.item
  );
});

export default function PostsViewer({ initialPosts }) {
  const { ref, controls, variants } = useScrollAnimation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);

  // --- State & Cache Initialization ---
  const [cachedData, setCachedData] = useState(() => {
    if (typeof window === 'undefined') return initialPosts ? [{ posts: initialPosts }] : undefined;
    if (SESSION_STATE.memoryCache) return SESSION_STATE.memoryCache;
    try {
      const local = localStorage.getItem(CACHE_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        if (parsed && Array.isArray(parsed.data)) {
          SESSION_STATE.memoryCache = parsed.data;
          return parsed.data;
        }
      }
    } catch (e) {
      console.error("Local storage load error", e);
    }
    return initialPosts ? [{ posts: initialPosts }] : undefined;
  });

  const saveHeavyCache = useCallback((data) => {
    if (typeof window === 'undefined') return;
    try {
      const cacheEntry = {
        data: data,
        timestamp: Date.now(),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(cacheEntry));
    } catch (e) {
      console.error("Local Storage Save Error", e);
    }
  }, []);

  // --- SWR Infinite Configuration ---
  const getKey = (pageIndex, previousPageData) => {
    // If we reached the end (no more posts)
    if (previousPageData && (!previousPageData.posts || previousPageData.posts.length < LIMIT)) return null;
    return `${API_URL}/api/posts?page=${pageIndex + 1}&limit=${LIMIT}`; // Adjust URL as needed
  };

  const { data, size, setSize, isValidating, isLoading, mutate } = useSWRInfinite(getKey, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    revalidateIfStale: true,
    fallbackData: cachedData,
    onSuccess: (newData) => {
      setIsOfflineMode(false);
      SESSION_STATE.memoryCache = newData;
      SESSION_STATE.hasFetched = true;
      saveHeavyCache(newData);
    },
    onError: () => {
      setIsOfflineMode(true);
    }
  });

  // ⚡️ INSTANT FOCUS SYNC: Equivalent to RN useFocusEffect
  useEffect(() => {
    const handleFocus = () => {
      globalMutate(
        key => typeof key === 'string' && key.includes('/api/posts'),
        undefined,
        { revalidate: true }
      );
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  // --- Data Processing ---
  const posts = useMemo(() => {
    const sourceData = data || cachedData;
    if (!sourceData || !Array.isArray(sourceData)) return [];

    const orderedList = [];
    const seenIds = new Set();

    sourceData.forEach((page) => {
      if (page?.posts && Array.isArray(page.posts)) {
        page.posts.forEach((p) => {
          if (p?._id && !seenIds.has(p._id)) {
            seenIds.add(p._id);
            orderedList.push(p);
          }
        });
      }
    });

    return orderedList;
  }, [data, cachedData]);

  const hasMore = data ? data[data.length - 1]?.posts?.length === LIMIT : false;

  // --- Infinite Scroll Logic ---
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 1200 &&
        hasMore &&
        !isLoading &&
        !isValidating &&
        !isOfflineMode
      ) {
        setSize((prev) => prev + 1);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, isLoading, isValidating, isOfflineMode, setSize]);


  return (
    <div className="max-w-7xl mx-auto md:px-8 py-8 min-h-screen transition-colors duration-500">

      {/* --- AMBIENT BACKGROUND ELEMENTS --- */}
      <div className={`fixed top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent ${isOfflineMode ? 'via-orange-500' : 'via-blue-600'} to-transparent opacity-50 z-50 transition-colors`} />

      <div className="md:flex md:gap-12 items-start overflow-visible">

        {/* --- MAIN CONTENT: THE DATA STREAM --- */}
        <div id="postsContainer" className="md:flex-1 pr-4 scrollbar-hide px-4 md:px-0">

          {/* Header with Scan-line effect */}
          <div className="relative mb-10 pb-4 border-b-2 border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-3 mb-1">
              <div className={`h-2 w-2 rounded-full ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600 animate-ping'}`} />
              <span className={`text-[10px] font-black uppercase tracking-[0.4em] ${isOfflineMode ? 'text-orange-500' : 'text-blue-600'}`}>
                {isOfflineMode ? "Archived Intel // Offline" : "Live Feed Active"}
              </span>
            </div>
            <h1 className="text-5xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white">
              Anime <span className={isOfflineMode ? "text-orange-500" : "text-blue-600"}>Intel</span>
            </h1>
            <div className={`absolute bottom-0 left-0 h-[2px] w-24 ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600'}`} />
          </div>

          {/* RENDER POSTS */}
          <div className="flex flex-col gap-8">
            {posts.length > 0 ? (
              posts.map((post, index) => (
                <div key={post._id || index} className="relative group">
                  <MemoizedPostItem
                    item={post}
                    isVisible={true}
                    syncing={!SESSION_STATE.hasFetched || isValidating}
                    mutate={mutate}
                    posts={posts}
                  />

                  {/* Inject Sponsored Ad every 2 posts */}
                  {index % 2 === 1 && (
                    <div className="my-10 w-full p-4 border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl flex flex-col items-center gap-1 justify-center bg-gray-50/50 dark:bg-white/5">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">Sponsored Transmission</span>
                      <FeedAd />
                    </div>
                  )}
                </div>
              ))
            ) : !isLoading && (
              <div className="text-center py-20">
                <h2 className="text-2xl font-black uppercase italic text-gray-300">No Intel Found</h2>
              </div>
            )}
          </div>

          {/* LOADING & LOAD MORE STATE */}
          <div className="py-12 border-t border-gray-100 dark:border-gray-800 mt-10 min-h-[140px] flex flex-col items-center justify-center">
            {(isLoading || (isValidating && size > 1)) ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-1 bg-gray-200 dark:bg-gray-800 overflow-hidden relative rounded">
                  <div className={`absolute inset-0 ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600'} animate-[loading_1.5s_infinite]`} />
                </div>
                <p className={`text-[10px] font-black uppercase tracking-[0.3em] ${isOfflineMode ? 'text-orange-500' : 'text-blue-600'} animate-pulse`}>
                  {isOfflineMode ? "Searching Local Cache..." : "Synchronizing..."}
                </p>
              </div>
            ) : hasMore ? (
              <div className="text-center">
                <button
                  onClick={() => !isOfflineMode && setSize((prev) => prev + 1)}
                  disabled={isOfflineMode}
                  className={`group relative px-10 py-4 rounded-2xl overflow-hidden transition-all hover:scale-105 active:scale-95 ${isOfflineMode ? 'bg-gray-200 dark:bg-gray-800 cursor-not-allowed opacity-50' : 'bg-gray-900 dark:bg-white cursor-pointer'}`}
                >
                  <div className="absolute inset-0 bg-blue-600 translate-y-full group-hover:translate-y-0 transition-transform" />
                  <span className={`relative z-10 font-black uppercase italic tracking-widest text-xs ${isOfflineMode ? 'text-gray-500' : 'text-white dark:text-black group-hover:text-white'}`}>
                    Expand Feed +
                  </span>
                </button>
              </div>
            ) : posts.length > 0 && (
              <p className="text-center text-[10px] font-black uppercase tracking-[0.5em] text-gray-400">
                End of Transmission
              </p>
            )}
          </div>
        </div>

        {/* --- DESKTOP SIDEBAR --- */}
        <aside className="hidden md:flex flex-col gap-6 md:w-[350px] lg:w-[450px] sticky top-20 h-fit">
          <div className="flex items-center gap-2 mb-4 ml-1">
            <div className={`h-1 w-4 ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600'}`} />
            <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Sidebar Widgets</span>
          </div>
          <RecentPollsCard />
        </aside>

        {/* --- THE TACTICAL MOBILE DRAWER --- */}
        <div className="md:hidden">
          <button
            onClick={() => setDrawerOpen((prev) => !prev)}
            className={`fixed top-1/2 -right-2 transform -translate-y-1/2 z-50 w-14 h-14 rounded-l-2xl flex items-center justify-center shadow-[0_0_20px_rgba(37,99,235,0.3)] transition-all border-none outline-none cursor-pointer ${drawerOpen ? "bg-red-600" : (isOfflineMode ? "bg-orange-500" : "bg-blue-600")
              }`}
          >
            <div className="relative">
              {drawerOpen ? <span className="text-xl font-black text-white">X</span> : <FaPoll className="text-xl text-white" />}
              {!drawerOpen && <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white animate-bounce ${isOfflineMode ? 'bg-red-500' : 'bg-green-400'}`} />}
            </div>
          </button>

          <div
            className={`fixed top-0 right-0 z-40 h-full w-[85%] max-w-sm bg-white/95 dark:bg-[#0a0a0a]/95 backdrop-blur-xl border-l border-blue-600/20 p-6 shadow-[-20px_0_50px_rgba(0,0,0,0.2)] transition-all duration-500 ease-[cubic-bezier(0.23,1,0.32,1)] ${drawerOpen ? "translate-x-0" : "translate-x-full"
              }`}
          >
            <div className="mt-16 h-full flex flex-col">
              <div className="flex items-center justify-between mb-8 shrink-0">
                <h2 className="text-2xl font-black italic uppercase tracking-tighter dark:text-white">Tactical HUD</h2>
                <span className="text-[8px] font-mono opacity-50 dark:text-white">v2.0.26_SYNC</span>
              </div>

              <div className="flex-1 overflow-y-auto pb-24 scrollbar-hide">
                <RecentPollsCard />
              </div>

              <div className="absolute bottom-6 left-6 right-6 p-4 border rounded-2xl bg-white/50 dark:bg-black/50 backdrop-blur-md" style={{ borderColor: isOfflineMode ? 'rgba(249, 115, 22, 0.2)' : 'rgba(37, 99, 235, 0.2)' }}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600'}`} />
                  <p className={`text-[9px] font-black uppercase tracking-widest opacity-80 ${isOfflineMode ? 'text-orange-500' : 'text-blue-600'}`}>
                    {isOfflineMode ? "Cache_Relay_Active" : "System Link: Stable"}
                  </p>
                </div>
              </div>
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

        {/* --- Bottom Left Status Indicator (Desktop/Tablet) --- */}
        <div className="hidden md:flex fixed left-6 bottom-6 items-center gap-2 px-4 py-2 rounded-full bg-white/80 dark:bg-black/80 backdrop-blur-md border border-gray-200 dark:border-gray-800 shadow-lg pointer-events-none z-40 transition-colors">
          <div className={`w-2 h-2 rounded-full animate-pulse ${isOfflineMode ? 'bg-orange-500' : 'bg-blue-600'}`} />
          <span className={`text-[8px] font-black uppercase tracking-[0.4em] ${isOfflineMode ? 'text-orange-500' : 'text-blue-600'}`}>
            {isOfflineMode ? "Cache_Relay_Active" : "Neural_Link_Established"}
          </span>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{
        __html: `
                .scrollbar-hide::-webkit-scrollbar { width: 0px; }
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}} />
    </div>
  );
}
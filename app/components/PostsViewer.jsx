"use client";
import useSWRInfinite from "swr/infinite";
import PostCard from "./PostCard";
import RecentPollsCard from "./RecentPollsCard";
import { FaPoll } from "react-icons/fa";
import { useState, useRef, useEffect } from "react";

export default function PostsViewer() {
  const limit = 5;
  const [drawerOpen, setDrawerOpen] = useState(false);

  const getKey = (pageIndex, previousPageData) => {
    if (previousPageData && previousPageData.length === 0) return null; // no more
    
    return `/api/posts?page=${pageIndex + 1}&limit=${limit}`;
  };

  const {
    data,
    size,
    setSize,
    isLoading,
    isValidating,
  } = useSWRInfinite(getKey, {
    refreshInterval: 10000, // Poll every 10s for new posts
  });

  const posts = data ? data.flatMap((page) => page.posts).filter(Boolean) : [];
  const hasMore = data ? data[data.length - 1]?.length >= limit : true;
  
  // Infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
        hasMore &&
        !isLoading &&
        !isValidating
      ) {
        setSize((prev) => prev + 1);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, isLoading, isValidating]);

  return (
    <div className="max-w-7xl mx-auto px-2 md:px-8 py-6">
      <h1 className="text-4xl mb-6">Posts</h1>

      <div className="md:flex md:gap-8">
        {/* Posts */}
        <div className="md:flex-2 max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide">
          {posts.map((post) => (
            <div key={post?._id || "i"} className="mb-6">

              <PostCard post={post} posts={posts} isFeed={true}/>
            </div>
          ))}

          {isLoading && <p className="text-center text-gray-500 mt-4">Loading...</p>}
          {!hasMore && <p className="text-center text-gray-400 mt-4">No more posts</p>}
        </div>

        {/* Sidebar - large screens */}
        <div className="hidden md:block md:w-1/3">
          <RecentPollsCard />
        </div>

        {/* Mini drawer - small screens */}
        <div className="md:hidden">
          <button
            onClick={() => setDrawerOpen((p) => !p)}
            className="fixed top-1/3 right-[-20px] z-50 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg"
          >
            <FaPoll />
          </button>

          <div
            className={`fixed top-1/4 right-0 z-40 w-64 bg-white dark:bg-gray-800 p-4 shadow-lg rounded-l-lg transition-transform duration-300
            ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
          >
            <RecentPollsCard />
          </div>
        </div>
      </div>
    </div>
  );
}

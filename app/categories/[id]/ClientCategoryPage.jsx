"use client";
import { useState, useEffect } from "react";
import useSWRInfinite from "swr/infinite";
import PostCard from "@/app/components/PostCard";
import FeedAd from "@/app/components/FeedAd"
import RecentPollsCard from "@/app/components/RecentPollsCard";
import { FaPoll } from "react-icons/fa";
import { useScrollAnimation } from "@/app/components/useScrollAnimation";
import { motion } from "framer-motion";

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
  }, [hasMore, isLoading, isValidating, setSize]);

  return (
    <motion.div ref={ref} initial="hidden" animate={controls} variants={variants} className="bg-transparent rounded-2xl shadow-md">
      <div className="max-w-7xl mx-auto px-2 md:px-8 py-6 relative min-h-[75vh]">
        <h1 className="text-2xl font-bold mb-6 capitalize">{category}</h1>

        {/* Background effects */}
        <div className="absolute top-10 left-10 w-48 h-48 bg-blue-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-56 h-56 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

        <div className="md:flex md:gap-8">
          <div
  id="postsContainer"
  className="md:flex-2 max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide"
>
  {uniquePosts.map((post, index) => (
    <div key={post._id} className="break-inside-avoid mb-6">
      <PostCard post={post} posts={uniquePosts} setPosts={() => {}} isFeed />

      {/* Insert ad after every 2 posts */}
      {(index + 1) % 2 === 0 && <FeedAd />}
    </div>
  ))}

  {(isLoading || isValidating) && (
    <p className="text-center text-gray-500 mt-4">Loading more...</p>
  )}

  {hasMore && !isLoading && !isValidating && (
    <div className="text-center mt-6">
      <button
        aria-label="Load more"
        onClick={() => setSize((prev) => prev + 1)}
        className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
      >
        Load more
      </button>
    </div>
  )}

  {!hasMore && uniquePosts.length > 0 && (
    <p className="text-center text-gray-400 mt-4">No more posts to show</p>
  )}
  {!isLoading && uniquePosts.length === 0 && (
    <p className="text-center text-gray-500 mt-4">
      No posts found in this category
    </p>
  )}
</div>

          {/* Sidebar */}
          <div className="hidden md:block md:w-1/3">
            <RecentPollsCard />
          </div>

          {/* Mini drawer */}
          <div className="md:hidden">
            <button
              aria-label="Open drawer"
              onClick={() => setDrawerOpen((prev) => !prev)}
              className="fixed top-1/3 right-[-20px] transform -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg"
            >
              <FaPoll />
            </button>

            <div
              className={`fixed top-1/4 right-0 z-40 w-64 bg-white dark:bg-gray-800 p-4 shadow-lg rounded-l-lg transition-transform duration-300 ${
                drawerOpen ? "translate-x-0" : "translate-x-full"
              }`}
            >
              <RecentPollsCard />
            </div>
          </div>
        </div>

        {/* Scrollbar & Styles */}
        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar {
            width: 0px;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
          div[style*="overflow-y: auto"]::-webkit-scrollbar {
            width: 6px;
          }
          div[style*="overflow-y: auto"]::-webkit-scrollbar-track {
            background: transparent;
          }
          div[style*="overflow-y: auto"]::-webkit-scrollbar-thumb {
            background-color: rgba(107, 114, 128, 0.5);
            border-radius: 10px;
          }
          .dark div[style*="overflow-y: auto"]::-webkit-scrollbar-thumb {
            background-color: rgba(156, 163, 175, 0.3);
          }
        `}</style>
      </div>
    </motion.div>
  );
          }

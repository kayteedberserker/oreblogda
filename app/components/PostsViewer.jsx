"use client";

import { useState } from "react";
import useSWRInfinite from "swr/infinite";
import PostCard from "./PostCard";
import RecentPollsCard from "./RecentPollsCard";
import { FaPoll } from "react-icons/fa";
import { useScrollAnimation } from "./useScrollAnimation";
import { motion } from "framer-motion";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function PostsViewer({ initialPosts }) {
  const { ref, controls, variants } = useScrollAnimation();
  const limit = 5;

  // SWR Infinite Key function
  const getKey = (pageIndex, previousPageData) => {
    // Stop if previous page returned no posts
    if (previousPageData && previousPageData.posts.length === 0) return null;
    return `/api/posts?page=${pageIndex + 1}&limit=${limit}`;
  };

  const {
    data,
    size,
    setSize,
    isValidating,
  } = useSWRInfinite(getKey, fetcher, {
    fallbackData: [{ posts: initialPosts || [] }],
    revalidateAll: false,
  });

  // Flatten pages into a single array
  const posts = data ? data.flatMap((page) => page.posts || []) : [];

  // Check if more pages exist
  const hasMore = data ? data[data.length - 1].posts.length === limit : true;

  // Infinite scroll handler
  const handleScroll = () => {
    if (
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
      hasMore &&
      !isValidating
    ) {
      setSize(size + 1);
    }
  };

  // Add scroll listener
  useState(() => {
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  });

  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={variants}
      className="md:p-6 bg-transparent rounded-2xl shadow-md"
    >
      <div className="max-w-7xl mx-auto md:px-8 py-6">
        <h1 className="text-4xl font-bold mb-6">Anime Blog Posts</h1>

        <div className="md:flex md:gap-8">
          <div
            id="postsContainer"
            className="md:flex-2 max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide"
          >
            {posts.map((post) => (
              <div key={post._id} className="break-inside-avoid mb-6">
                <PostCard post={post} posts={posts} setPosts={() => {}} isFeed />
              </div>
            ))}

            {isValidating && (
              <p className="text-center text-gray-500 mt-4 animate-pulse">
                Loading more...
              </p>
            )}

            {!hasMore && posts.length > 0 && (
              <p className="text-center text-gray-400 mt-4">
                No more posts to show
              </p>
            )}

            {!isValidating && posts.length === 0 && (
              <p className="text-center text-gray-500 mt-4">No posts available yet</p>
            )}
          </div>

          {/* Sidebar for large screens */}
          <div className="hidden md:block md:w-1/3">
            <RecentPollsCard />
          </div>

          {/* Mini drawer for small screens */}
          <div className="md:hidden">
            <button
              aria-label="Open poll"
              onClick={() => setDrawerOpen((prev) => !prev)}
              className="fixed top-1/3 -right-5 transform -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg"
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

        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar {
            width: 0px;
          }
          .scrollbar-hide {
            -ms-overflow-style: none;
            scrollbar-width: none;
          }
        `}</style>
      </div>
    </motion.div>
  );
}

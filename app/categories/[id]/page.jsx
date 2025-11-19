// app/category/[id]/page.jsx
"use client";

import { useState, useEffect } from "react";
import PostCard from "@/app/components/PostCard";
import RecentPollsCard from "@/app/components/RecentPollsCard";
import { FaPoll } from "react-icons/fa";
import { useScrollAnimation } from "@/app/components/useScrollAnimation";
import { motion } from "framer-motion";

const limit = 5;

export default function CategoryPage({ params, initialPosts: ssrPosts }) {
  const { ref, controls, variants } = useScrollAnimation();
  const { id } = params;

  const category = id
    ? id.includes("-")
      ? id
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join("/")
      : id.charAt(0).toUpperCase() + id.slice(1).toLowerCase()
    : "";
console.log(id, category) 
  // --- Client-side state ---
  const [posts, setPosts] = useState(ssrPosts || []);
  const [page, setPage] = useState(2); // first page already SSR
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // --- Fetch more posts ---
  const fetchPosts = async (pageNum) => {
    if (!hasMore) return;
    setLoading(true);

    try {
      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BASE_URL}/api/posts?category=${category}&page=${pageNum}&limit=${limit}`,
        { cache: "no-store" }
      );
      const data = await res.json();
      const newPosts = Array.isArray(data.posts) ? data.posts : [];

      if (newPosts.length < limit) setHasMore(false);

      // Merge without duplicates
      setPosts((prev) => {
        const all = [...prev, ...newPosts];
        return Array.from(new Map(all.map((p) => [p._id, p])).values());
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // --- Infinite Scroll ---
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
        hasMore &&
        !loading
      ) {
        setPage((prev) => prev + 1);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, loading]);

  // Fetch next page whenever `page` changes
  useEffect(() => {
    if (page > 1) fetchPosts(page);
  }, [page]);

  return (
    <motion.div ref={ref} initial="hidden" animate={controls} variants={variants} className="bg-transparent rounded-2xl shadow-md">
      <div className="max-w-7xl mx-auto px-2 md:px-8 py-6 relative min-h-[75vh]">
        <h1 className="text-2xl font-bold mb-6 capitalize">{category}</h1>

        {/* Background effects */}
        <div className="absolute top-10 left-10 w-48 h-48 bg-blue-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-56 h-56 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

        <div className="md:flex md:gap-8">
          {/* Posts */}
          <div id="postsContainer" className="md:flex-2 max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide">
            {posts.map((post) => (
              <div key={post._id} className="break-inside-avoid mb-6">
                <PostCard post={post} posts={posts} setPosts={setPosts} isFeed={true} />
              </div>
            ))}

            {loading && <p className="text-center text-gray-500 mt-4">Loading more...</p>}

            {!hasMore && posts.length > 0 && <p className="text-center text-gray-400 mt-4">No more posts to show</p>}

            {!loading && posts.length === 0 && <p className="text-center text-gray-500 mt-4">No posts found in this category</p>}
          </div>

          {/* Sidebar */}
          <div className="hidden md:block md:w-1/3">
            <RecentPollsCard />
          </div>

          {/* Mini drawer - small screens */}
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

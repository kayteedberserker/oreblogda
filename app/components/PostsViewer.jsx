"use client";
import { useEffect, useState } from "react";
import PostCard from "./PostCard";
import RecentPollsCard from "./RecentPollsCard";
import { FaPoll } from "react-icons/fa";
import { useScrollAnimation } from "./useScrollAnimation";
import { motion } from "framer-motion";

export default function PostsViewer() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { ref, controls, variants } = useScrollAnimation();
  const limit = 5;

  // --- Fetch posts ---
  const fetchPosts = async (pageNum = 1) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/posts?page=${pageNum}&limit=${limit}`, {
        cache: "no-store",
      });
      const data = await res.json();

      const newPosts = Array.isArray(data) ? data : data.posts || [];

      // ✅ Merge without duplicates
      setPosts((prev) => {
        const all = [...prev, ...newPosts];
        const unique = Array.from(new Map(all.map((p) => [p._id, p])).values());
        return unique;
      });

      // ✅ Check if there’s more data
      if (newPosts.length < limit) setHasMore(false);

      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
      setLoading(false);
    }
  };

  // --- Initial + page change fetch ---
  useEffect(() => {
    fetchPosts(page);
  }, [page]);

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

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={variants}
      className="p-6 bg-transparent rounded-2xl shadow-md"
    >
    <div className="max-w-7xl mx-auto px-2 md:px-8 py-6">
      <h1 className="text-4xl font-bold mb-6">Posts</h1>

      <div className="md:flex md:gap-8">
        {/* Posts */}
        <div id="postsContainer" className="md:flex-2 max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide">
          {posts.map((post) => (
            <div key={post._id} className="break-inside-avoid mb-6">
              <PostCard post={post} posts={posts} setPosts={setPosts} isFeed />
            </div>
          ))}

          {/* Loading Indicator */}
          {loading && (
            <p className="text-center text-gray-500 mt-4 animate-pulse">
              Loading more...
            </p>
          )}

          {/* Load More Button Fallback */}
          {hasMore && !loading && (
            <div className="text-center mt-6">
              <button
                onClick={() => setPage((prev) => prev + 1)}
                className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Load more
              </button>
            </div>
          )}

          {/* No More Posts */}
          {!hasMore && posts.length > 0 && (
            <p className="text-center text-gray-400 mt-4">No more posts to show</p>
          )}

          {/* Empty State */}
          {!loading && posts.length === 0 && (
            <p className="text-center text-gray-500 mt-4">
              No posts available yet
            </p>
          )}
        </div>

        {/* Sidebar - large screens */}
        <div className="hidden md:block md:w-1/3">
          <RecentPollsCard />
        </div>

        {/* Mini drawer - small screens */}
        <div className="md:hidden">
          {/* Toggle Button */}
          <button
            onClick={() => setDrawerOpen((prev) => !prev)}
            className="fixed top-1/3 right-[-20px] transform -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg"
          >
            <FaPoll />
          </button>

          {/* Drawer */}
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

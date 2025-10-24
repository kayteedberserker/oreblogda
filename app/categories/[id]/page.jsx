"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import PostCard from "@/components/PostCard";
import RecentPollsCard from "@/components/RecentPollsCard";
import { FaPoll } from "react-icons/fa";

export default function CategoryPage() {
  const params = useParams();
  const { id } = params;

  const [category, setCategory] = useState("");
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const prevScrollHeight = useRef(0);
  const limit = 5;

  // Format category from URL
  useEffect(() => {
    if (!id) return;
    if (id.includes("-")) {
      setCategory(
        id
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join("/")
      );
    } else {
      setCategory(id.charAt(0).toUpperCase() + id.slice(1).toLowerCase());
    }
  }, [id]);

  // Fetch posts for category
  const fetchPosts = async (pageNum = 1) => {
    if (!category) return;
    try {
      setLoading(true);
      const res = await fetch(
        `/api/posts?category=${category}&page=${pageNum}&limit=${limit}`
      );
      const data = await res.json();
      const newPosts = Array.isArray(data) ? data : data.posts || [];

      if (newPosts.length < limit) setHasMore(false);

      prevScrollHeight.current = document.body.scrollHeight;
      setPosts((prev) => [...prev, ...newPosts]);

      setTimeout(() => {
        const diff = document.body.scrollHeight - prevScrollHeight.current;
        window.scrollBy({ top: -diff, behavior: "instant" });
      }, 0);

      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPosts(page);
  }, [page, category]);

  // Infinite scroll
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
    <div className="max-w-7xl mx-auto px-2 md:px-8 py-6 relative">
      <h1 className="text-2xl font-bold mb-6 capitalize">{category}</h1>
      {/* Subtle anime glow */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-blue-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-56 h-56 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

      <div className="md:flex md:gap-8">
        {/* Posts */}
        <div className="md:flex-2 max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide">
          {posts.map((post) => (
            <div key={post._id} className="break-inside-avoid mb-6">
              <PostCard post={post} posts={posts} setPosts={setPosts} isFeed={true} />
            </div>
          ))}
          {loading && <p className="text-center text-gray-500 mt-4">Loading more...</p>}
          {!hasMore && <p className="text-center text-gray-400 mt-4">No more posts to show</p>}
        </div>

        {/* Sidebar - large screens */}
        <div className="hidden md:block md:w-1/3">
          <RecentPollsCard />
        </div>

        {/* Mini drawer - small screens */}
        <div className="md:hidden">
          {/* Circular toggle button */}
          <button
            onClick={() => setDrawerOpen((prev) => !prev)}
            className="fixed top-1/3 right-[-20px] transform -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg"
          >
            <FaPoll />
          </button>

          {/* Drawer */}
          <div
            className={`fixed top-1/4 right-0 z-40 w-64 bg-white dark:bg-gray-800 p-4 shadow-lg rounded-l-lg transition-transform duration-300
              ${drawerOpen ? "translate-x-0" : "translate-x-full"}`}
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

        /* Custom scrollbar for drawer */
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
  );
}

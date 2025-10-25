"use client";
import { useEffect, useState, useRef } from "react";
import PostCard from "./PostCard";
import RecentPollsCard from "./RecentPollsCard";
import { FaPoll } from "react-icons/fa";

export default function PostsViewer() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const limit = 5;
  const prevScrollHeight = useRef(0);

  const fetchPosts = async (pageNum = 1) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/posts?page=${pageNum}&limit=${limit}`);
      const data = await res.json();
      const newPosts = Array.isArray(data) ? data : data.posts || [];

      if (newPosts.length < limit) setHasMore(false);
      prevScrollHeight.current = document.body.scrollHeight;

      setPosts(prev => [...prev, ...newPosts]);

      setTimeout(() => {
        const diff = document.body.scrollHeight - prevScrollHeight.current;
        window.scrollBy({ top: -diff, behavior: "instant" });
      }, 0);

      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
      setLoading(false);
    }
  };

 useEffect(() => {
  fetchPosts(page);
}, [page]);

useEffect(() => {
  const handleScroll = () => {
    if (
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
      hasMore &&
      !loading
    ) {
      setPage(prev => prev + 1);
    }
  };

  window.addEventListener("scroll", handleScroll);
  return () => window.removeEventListener("scroll", handleScroll);
}, [hasMore, loading]);

  return (
    <div className="max-w-7xl mx-auto px-2 md:px-8 py-6">
      <h1 className=" text-4xl">Posts</h1>
      <div className="md:flex md:gap-8">
        {/* Posts */}
        <div className="md:flex-2 max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide">
          {posts.map(post => (
            <div key={post._id} className="break-inside-avoid mb-6">
              <PostCard post={post} posts={posts} setPosts={setPosts} isFeed />
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
            onClick={() => setDrawerOpen(prev => !prev)}
            className={`fixed top-1/3 right-[-20px] transform translate-y-[-50%] z-50 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg`}
          >
            <FaPoll />
          </button>

          {/* Drawer */}
          <div
            className={`fixed top-1/4 right-0 z-40 w-64 bg-white dark:bg-gray-800 p-4 shadow-lg rounded-l-lg transition-transform duration-300
              ${drawerOpen ? "translate-x-0" : "translate-x-full"}
            `}
          >
            <RecentPollsCard />
          </div>
        </div>
      </div>
    </div>
  );
}

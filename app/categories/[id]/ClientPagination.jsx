"use client";

import { useState, useEffect } from "react";
import useSWRInfinite from "swr/infinite";
import PostCard from "@/app/components/PostCard";
import RecentPollsCard from "@/app/components/RecentPollsCard";
import { FaPoll } from "react-icons/fa";

const limit = 5;
const fetcher = (url) => fetch(url, { cache: "no-store" }).then(res => res.json());

export default function ClientPagination({ category, initialPosts }) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const getKey = (pageIndex, previousPageData) => {
    if (!category) return null;
    if (previousPageData && previousPageData.posts?.length < limit) return null;
    return `/api/posts?category=${category}&page=${pageIndex + 1}&limit=${limit}`;
  };

  const { data, size, setSize, isLoading, isValidating } = useSWRInfinite(getKey, fetcher, {
    initialData: [{ posts: initialPosts }],
  });

  const posts = data ? data.flatMap(page => page.posts || []) : [];
  const uniquePosts = Array.from(new Map(posts.map(p => [p._id, p])).values());
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
        setSize(prev => prev + 1);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, isLoading, isValidating, setSize]);

  return (
    <>
      {/* Mini drawer */}
      <div className="md:hidden">
        <button
          aria-label="Open drawer"
          onClick={() => setDrawerOpen(prev => !prev)}
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

      {/* Infinite scroll posts */}
      {uniquePosts.slice(initialPosts.length).map(post => (
        <div key={post._id} className="break-inside-avoid mb-6 md:flex-2 max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide">
          <PostCard post={post} posts={uniquePosts} setPosts={() => {}} isFeed={true} />
        </div>
      ))}

      {isLoading || isValidating ? <p className="text-center text-gray-500 mt-4">Loading more...</p> : null}

      {hasMore && !isLoading && !isValidating && (
        <div className="text-center mt-6">
          <button
            aria-label="Load more"
            onClick={() => setSize(prev => prev + 1)}
            className="px-5 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Load more
          </button>
        </div>
      )}

      {!hasMore && uniquePosts.length > 0 && <p className="text-center text-gray-400 mt-4">No more posts to show</p>}
    </>
  );
}

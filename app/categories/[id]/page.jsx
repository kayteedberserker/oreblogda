"use client";
import { useState } from "react";
import { useParams } from "next/navigation";
import useSWRInfinite from "swr/infinite";
import PostCard from "@/app/components/PostCard";
import RecentPollsCard from "@/app/components/RecentPollsCard";
import { FaPoll } from "react-icons/fa";

const fetcher = (url) => fetch(url).then((res) => res.json());
const limit = 5;

export default function CategoryPage() {
  const params = useParams();
  const { id } = params;

  const [drawerOpen, setDrawerOpen] = useState(false);

  const category = id
    ? id.includes("-")
      ? id
          .split("-")
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join("/")
      : id.charAt(0).toUpperCase() + id.slice(1).toLowerCase()
    : "";

  // SWR Infinite (handles pagination)
  const getKey = (pageIndex, previousPageData) => {
    if (!category) return null;
    if (previousPageData && previousPageData.posts?.length < limit) return null;
    return `/api/posts?category=${category}&page=${pageIndex + 1}&limit=${limit}`;
  };

  const { data, error, size, setSize, isLoading } = useSWRInfinite(
    getKey,
    fetcher,
    { refreshInterval: 10000 } // revalidate every 10s
  );

  const posts = data ? data.flatMap((d) => (Array.isArray(d) ? d : d.posts || [])) : [];
  const hasMore = data ? data[data.length - 1]?.posts?.length >= limit : true;

  // Infinite scroll
  if (typeof window !== "undefined") {
    window.onscroll = () => {
      if (
        window.innerHeight + window.scrollY >= document.body.offsetHeight - 200 &&
        hasMore &&
        !isLoading
      ) {
        setSize((prev) => prev + 1);
      }
    };
  }

  return (
    <div className="max-w-7xl mx-auto px-2 md:px-8 py-6 relative min-h-[75vh]">
      <h1 className="text-2xl font-bold mb-6 capitalize">{category}</h1>

      <div className="absolute top-10 left-10 w-48 h-48 bg-blue-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-56 h-56 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

      <div className="md:flex md:gap-8">
        {/* Posts */}
        <div className="md:flex-2 max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide">
          {posts.map((post) => (
            <div key={post._id} className="break-inside-avoid mb-6">
              <PostCard post={post} posts={posts} setPosts={() => {}} isFeed={true} />
            </div>
          ))}

          {isLoading && (
            <p className="text-center text-gray-500 mt-4 h-max-[70vh]">
              Loading more...
            </p>
          )}
          {!hasMore && (
            <p className="text-center text-gray-400 mt-4">
              No more posts to show
            </p>
          )}
        </div>

        {/* Sidebar - large screens */}
        <div className="hidden md:block md:w-1/3">
          <RecentPollsCard />
        </div>

        {/* Mini drawer - small screens */}
        <div className="md:hidden">
          <button
          name="Open drawer"
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
  );
}

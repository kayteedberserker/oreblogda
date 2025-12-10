"use client";
import { useState, useEffect } from "react";
import useSWRInfinite from "swr/infinite";
import PostCard from "./PostCard";
import RecentPollsCard from "./RecentPollsCard";
import { FaPoll } from "react-icons/fa";
import { useScrollAnimation } from "./useScrollAnimation";
import { motion } from "framer-motion"
import FeedAd from "./FeedAd"
import FooterAds from "./FooterAds";

const limit = 5;
const fetcher = (url) => fetch(url, { cache: "no-store" }).then((res) => res.json());

export default function PostsViewer({ initialPosts }) {
  const { ref, controls, variants } = useScrollAnimation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // --- SWR Infinite ---
  const getKey = (pageIndex, previousPageData) => {
    if (previousPageData && previousPageData.posts?.length < limit) return null;
    return `/api/posts?page=${pageIndex + 1}&limit=${limit}`;
  };

  const { data, size, setSize, isValidating, isLoading } = useSWRInfinite(getKey, fetcher, {
    initialData: [{ posts: initialPosts || [] }],
  });

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
    <motion.div ref={ref} initial="hidden" animate={controls} variants={variants} className="md:p-6 bg-transparent rounded-2xl shadow-md">
      <div className="max-w-7xl mx-auto md:px-8 py-6">


        <div className="md:flex md:gap-8">
          {/* Posts */}
          <div
            id="postsContainer"
            className="md:flex-2 max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide"
          >
            <h1 className="text-4xl font-bold mb-6">Anime Blog Posts</h1>
            {uniquePosts.map((post, index) => (
              <div key={post._id} className="break-inside-avoid mb-6">
                <PostCard
                  post={post}
                  posts={uniquePosts}
                  setPosts={() => { }}
                  isFeed
                />

                {/* Insert ad after every 2 posts (index = 1, 3, 5...) */}
                {index % 2 === 1 && (
                  <div className="my-6">
                    <FeedAd />
                  </div>
                )}
              </div>
            ))}

            {(isLoading || isValidating) && (
              <p className="text-center text-gray-500 mt-4 animate-pulse">
                Loading more...
              </p>
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
              <p className="text-center text-gray-400 mt-4">
                No more posts to show
              </p>
            )}

            {!isLoading && uniquePosts.length === 0 && (
              <p className="text-center text-gray-500 mt-4">
                No posts available yet
              </p>
            )}
          </div>
          {/* Sidebar */}
          <div className="hidden md:block md:w-1/3">
            <RecentPollsCard />
            <FooterAds />
          </div>

          {/* Mini drawer */}
          <div className="md:hidden">
            <button
              aria-label="Open drawer"
              onClick={() => setDrawerOpen((prev) => !prev)}
              className="fixed top-1/3 -right-5 transform -translate-y-1/2 z-50 w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg"
            >
              <FaPoll />
            </button>

            <div
              className={`fixed top-1/4 right-0 z-40 w-64 bg-white dark:bg-gray-800 p-4 shadow-lg rounded-l-lg transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "translate-x-full"
                }`}
            >
              <RecentPollsCard />
              <FooterAds />
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

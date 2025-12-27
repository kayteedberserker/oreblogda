"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import PostCard from "./PostCard";
import dynamic from "next/dynamic";

const SimilarPostAd = dynamic(() => import("./SimilarPostAd"), {
  ssr: false,
});

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function SimilarPosts({ category, currentPostId }) {
  // Fetch ALL posts in that category
  const { data, error, isLoading } = useSWR(
    category ? `/api/posts?category=${category}` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  const [shuffledPosts, setShuffledPosts] = useState([]);

  useEffect(() => {
    if (data) {
      // Normalize the data array
      const list = (Array.isArray(data) ? data : data.posts || [])
        .filter((p) => p._id !== currentPostId);

      // Shuffle the entire list
      const shuffled = [...list].sort(() => Math.random() - 0.5);

      // Pick 6 random items
      setShuffledPosts(shuffled.slice(0, 6));
    }
  }, [data, currentPostId]);

  if (isLoading) return null;
  if (error || !shuffledPosts.length) return null;

  const similarPosts = shuffledPosts;

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Similar Posts
      </h3>

      <div className="flex overflow-x-auto space-x-4 py-2 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
        {similarPosts.flatMap((post, index) => {
          const items = [
            <div key={post._id} className="flex-none w-64 sm:w-72 md:w-80 lg:w-80">
              <PostCard
                post={post}
                posts={similarPosts}
                setPosts={() => {}}
                imgHeight={"max-h-[180px]"}
                isFeed={true}
                className="max-h-[450px] min-h-[430px] flex flex-col justify-between"
                hideMedia={post.category === "Polls"}
              />
            </div>,
          ];

          // Insert ad after every 2 posts
          if ((index + 1) % 3 === 0) {
            items.push(
              <div key={`ad-${index}`} className="flex-none w-fit">
                {/* <SimilarPostAd /> */}
              </div>
            );
          }

          return items;
        })}
      </div>

      <style jsx>{`
        .scrollbar-thin::-webkit-scrollbar {
          height: 6px;
        }
        .scrollbar-thin::-webkit-scrollbar-track {
          background: transparent;
        }
        .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: rgba(107, 114, 128, 0.5);
          border-radius: 10px;
        }
        .dark .scrollbar-thin::-webkit-scrollbar-thumb {
          background-color: rgba(156, 163, 175, 0.3);
        }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover {
          background-color: rgba(107, 114, 128, 0.8);
        }
      `}</style>
    </div>
  );
}

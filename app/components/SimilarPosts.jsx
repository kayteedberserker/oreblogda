"use client";

import { useEffect, useState } from "react";
import PostCard from "./PostCard";

export default function SimilarPosts({ category, currentPostId }) {
  const [similarPosts, setSimilarPosts] = useState([]);

  useEffect(() => {
    if (!category) return;

    const fetchSimilar = async () => {
      try {
        const res = await fetch(
          `/api/posts?category=${category}&limit=10`
        );
        const data = await res.json();
        const postsArray = Array.isArray(data) ? data : data.posts || [];
        setSimilarPosts(postsArray.filter((p) => p._id !== currentPostId));
      } catch (err) {
        console.error(err);
        setSimilarPosts([]);
      }
    };

    fetchSimilar();
  }, [category, currentPostId]);

  if (!similarPosts.length) return null;

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Similar Posts
      </h3>
      <div className="flex overflow-x-auto space-x-4 py-2 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
        {similarPosts.map((post) => (
          <div
            key={post._id}
            className="flex-none  w-64 sm:w-72 md:w-80 lg:w-80"
          >
            <PostCard
              post={post}
              posts={similarPosts}
              setPosts={setSimilarPosts}
              isFeed={true}
              className={`max-h-[440px] min-h-[430px] flex flex-col justify-between`}
              hideMedia={
                post.category === "Polls" // hide media for polls
              }
            />
          </div>
        ))}
      </div>

      <style jsx>{`
        /* Thin horizontal scrollbar */
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

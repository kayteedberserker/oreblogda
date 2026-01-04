"use client";
import { useEffect, useState } from "react";
import useSWR from "swr";
import PostCard from "./PostCard";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";

const SimilarPostAd = dynamic(() => import("./SimilarPostAd"), {
  ssr: false,
});

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function SimilarPosts({ category, currentPostId }) {
  const { data, error, isLoading } = useSWR(
    category ? `/api/posts?category=${category}` : null,
    fetcher,
    { refreshInterval: 10000 }
  );

  const [shuffledPosts, setShuffledPosts] = useState([]);

  useEffect(() => {
    if (data) {
      const list = (Array.isArray(data) ? data : data.posts || [])
        .filter((p) => p._id !== currentPostId);

      const shuffled = [...list].sort(() => Math.random() - 0.5);
      setShuffledPosts(shuffled.slice(0, 6));
    }
  }, [data, currentPostId]);

  // Loading Protocol
  if (isLoading) return (
    <div className="mt-10 flex flex-col items-center gap-3 opacity-50">
      <div className="w-full h-[1px] bg-blue-600/20 overflow-hidden">
        <div className="h-full bg-blue-600 animate-[loading_2s_infinite] w-1/3" />
      </div>
      <span className="text-[10px] font-mono uppercase tracking-[0.4em]">Searching_Related_Nodes...</span>
    </div>
  );

  if (error || !shuffledPosts.length) return null;

  return (
    <div className="mt-8 mb-8">

      {/* --- HORIZONTAL DATA STREAM --- */}
      <div className="flex overflow-x-auto space-x-5 py-4 px-2 no-scrollbar scrollbar-thin scrollbar-thumb-blue-600/20 dark:scrollbar-thumb-blue-600/10">
        {shuffledPosts.flatMap((post, index) => {
          const items = [
            <div 
              key={post._id} 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex-none w-[350px]"
            >
              <div className="group relative bg-white/50 dark:bg-black/40 backdrop-blur-md rounded-2xl border border-gray-100 dark:border-blue-900/20 overflow-hidden hover:border-blue-600/50 transition-all duration-300">
                <PostCard
                  post={post}
                  posts={shuffledPosts}
                  setPosts={() => {}}
                  isFeed={true}
                  isSimilarPost={true} // New Prop to hide actions
                  imgHeight="min-h-[160px] max-h-[170px] md:max-h-[200px]" // Priority on Image
                  className="flex flex-col"
                />
                
                {/* Decorative UI Accent */}
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-1 h-1 bg-blue-600 rounded-full" />
                    <div className="w-1 h-1 bg-blue-600/40 rounded-full" />
                </div>
              </div>
            </div>
          ];

          if ((index + 1) % 3 === 0) {
            items.push(
              <div key={`ad-${index}`} className="flex-none flex items-center justify-center">
                {/* <SimilarPostAd /> */}
              </div>
            );
          }

          return items;
        })}
      </div>

      <style jsx>{`
        .no-scrollbar::-webkit-scrollbar {
          height: 4px;
        }
        .no-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .no-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(37, 99, 235, 0.1);
          border-radius: 10px;
        }
        .no-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(37, 99, 235, 0.4);
        }
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
}
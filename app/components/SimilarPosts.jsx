"use client";
import useSWR from "swr";
import PostCard from "./PostCard";
import SimilarPostAd from "./SimilarPostAd"

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function SimilarPosts({ category, currentPostId }) {
  const { data, error, isLoading } = useSWR(
    category ? `/api/posts?category=${category}&limit=6` : null,
    fetcher,
    { refreshInterval: 10000 } // revalidate every 10s
  );

  const similarPosts = (Array.isArray(data) ? data : data?.posts || []).filter(
    (p) => p._id !== currentPostId
  );

  if (isLoading) return null;
  if (error || !similarPosts.length) return null;

  return (
    <div className="mt-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">
        Similar Posts
      </h3>
      <div className="flex overflow-x-auto space-x-4 py-2 scrollbar-thin scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
  {similarPosts.map((post, index) => (
    <div key={post._id} className="flex-none w-64 sm:w-72 md:w-80 lg:w-80">
      <PostCard
        post={post}
        posts={similarPosts}
        setPosts={() => {}}
        isFeed={true}
        className="max-h-[440px] min-h-[430px] flex flex-col justify-between"
        hideMedia={post.category === "Polls"}
      />
      {/* Insert the ad after the 2nd post (index === 1) */}
      {index === 1 && (
        <div className="flex-none w-64 sm:w-72 md:w-80 lg:w-80">
          <SimilarPostAd />
        </div>
      )}
    </div>
  ))}
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

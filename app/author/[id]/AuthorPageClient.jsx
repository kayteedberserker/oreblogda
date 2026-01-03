"use client";

import { useState, useEffect, useCallback } from "react";
import PostCard from "@/app/components/PostCard";
import AuthorPageAd from "@/app/components/AuthorPageAd";
import ArticleAd from "@/app/components/ArticleAd";

export default function AuthorPageClient({ author, initialPosts = [] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  // Fetch more posts
  const fetchMorePosts = useCallback(async () => {
    if (!hasMore || loading) return;
    setLoading(true);

    try {
      const res = await fetch(
        `/api/posts?author=${author._id || author.id}&page=${page + 1}&limit=6`
      );
      const data = await res.json();

      if (res.ok) {
        setPosts((prev) => [...prev, ...data.posts]);
        setPage((prev) => prev + 1);
        if (data.posts.length < 6) setHasMore(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [author, page, hasMore, loading]);

  const handleLoadMore = () => {
    fetchMorePosts();
  };

  return (
    <div className="max-w-7xl mx-auto mt-6 min-h-[70vh]">
      {/* Author Bio */}
      {author && (
        <div className="mb-6 flex items-center gap-4">
          <img
            src={author.profilePic?.url || "/default-avatar.png"}
            alt={author.username}
            className="w-30 h-30 md:w-60 md:h-60 rounded-full object-cover border"
          />
          <div>
            <h1 className="text-2xl font-bold">{author.username}</h1>
            <p className="text-gray-600">
              {author.description || "This author hasn’t added a description yet."}
            </p>
          </div>
        </div>
      )}

      {/* Optional Ad under author bio */}
      {/* <div className="mb-8"><ArticleAd /></div> */}

      {/* Posts Feed */}
      <div className="relative lg:flex lg:gap-6">
        <div className="flex-1">
          {posts.map((post, index) => (
            <div key={post._id} className="mb-12">
              <PostCard post={post} isFeed />
              {/* Optionally add ads every 2 posts */}
            </div>
          ))}

          {/* Load More Button */}
          {hasMore && (
            <div className="flex justify-center my-8">
              <button
                onClick={handleLoadMore}
                disabled={loading}
                className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Loading..." : "Load More"}
              </button>
            </div>
          )}

          {!hasMore && posts.length > 0 && (
            <p className="text-center text-gray-500 mt-6">No more posts.</p>
          )}
        </div>
      </div>
    </div>
  );
}

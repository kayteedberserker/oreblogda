"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import PostCard from "@/app/components/PostCard";
import SimilarPostAd from "@/app/components/SimilarPostAd";
import AuthorPageAd from "@/app/components/AuthorPageAd";

export default function AuthorPage() {
  const { id } = useParams();

  const [author, setAuthor] = useState(null);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  // Fetch author + first posts
  const fetchAuthorData = useCallback(async () => {
    try {
      const [userRes, postRes] = await Promise.all([
        fetch(`/api/users/${id}`),
        fetch(`/api/posts?author=${id}&page=1&limit=6`),
      ]);

      const userData = await userRes.json();
      const postData = await postRes.json();

      if (userRes.ok) setAuthor(userData.user);
      if (postRes.ok) {
        setPosts(postData.posts);
        if (postData.posts.length < 6) setHasMore(false);
      }
    } catch {}
  }, [id]);

  // Fetch more posts
  const fetchMorePosts = useCallback(async () => {
    if (!hasMore || loading) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/posts?author=${id}&page=${page}&limit=6`);
      const data = await res.json();

      if (res.ok) {
        setPosts((prev) => [...prev, ...data.posts]);
        if (data.posts.length < 6) setHasMore(false);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [id, page, hasMore, loading]);

  useEffect(() => {
    fetchAuthorData();
  }, [id]);

  const handleLoadMore = () => {
    if (hasMore && !loading) setPage((p) => p + 1);
  };

  useEffect(() => {
    if (page > 1) fetchMorePosts();
  }, [page]);

  return (
    <div className="max-w-7xl mx-auto mt-6 min-h-[70vh]">

      {/* Author Bio */}
      {author && (
        <>
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

          {/* Ad under author bio */}
          <div className="mb-8">
            <SimilarPostAd />
          </div>
        </>
      )}

      {/* Posts + Side Ads */}
      <div className="relative lg:flex lg:gap-6">
        {/* Left Side Ad */}
        <div className="hidden lg:block lg:w-[250px] sticky top-24 self-start h-[calc(100vh-6rem)]">
          <div className="max-h=[40vh]">
            {posts.length > 0 && <AuthorPageAd />}
          </div>
          <div className="max-h=[40vh]">
            {posts.length > 0 && <AuthorPageAd />}
          </div>
        </div>

        {/* Post Feed */}
        <div className="flex-1">
          {posts.map((post, index) => (
            <div key={post._id} className="mb-12">
              <PostCard post={post} isFeed />

              {/* Feed Ad after every 2 posts */}
              {(index + 1) % 2 === 0 && (
                <div className="my-6">
                  <SimilarPostAd />
                </div>
              )}
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

        {/* Right Side Ad */}
        <div className="hidden lg:block lg:w-[250px] sticky top-24 self-start h-[calc(100vh-5rem)]">
          <div className="max-h=[40vh]">
            {posts.length > 0 && <AuthorPageAd />}
          </div>
          <div className="max-h=[40vh]">
            {posts.length > 0 && <AuthorPageAd />}
          </div>
        </div>
      </div>
    </div>
  );
}

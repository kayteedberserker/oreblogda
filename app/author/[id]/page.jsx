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

  const LIMIT = 6;

  // Fetch author + first posts
  const fetchAuthorData = useCallback(async () => {
    try {
      const [userRes, postRes] = await Promise.all([
        fetch(`/api/users/${id}`),
        fetch(`/api/posts?author=${id}&page=1&limit=${LIMIT}`),
      ]);

      const userData = await userRes.json();
      const postData = await postRes.json();

      if (userRes.ok) setAuthor(userData.user);

      if (postRes.ok) {
        setPosts(postData.posts);
        if (postData.posts.length < LIMIT) setHasMore(false);
      }
    } catch (err) {
      console.error(err);
    }
  }, [id]);

  // Fetch more posts
  const fetchMorePosts = useCallback(async () => {
    if (!hasMore || loading) return;

    setLoading(true);

    try {
      const res = await fetch(
        `/api/posts?author=${id}&page=${page}&limit=${LIMIT}`
      );
      const data = await res.json();

      if (res.ok) {
        setPosts(prev => [...prev, ...data.posts]);
        if (data.posts.length < LIMIT) setHasMore(false);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, page, hasMore, loading]);

  useEffect(() => {
    fetchAuthorData();
  }, [id]);

  useEffect(() => {
    if (page > 1) fetchMorePosts();
  }, [page]);

  return (
    <div className="max-w-6xl mx-auto mt-6 px-4 min-h-[70vh]">

      {/* ================= AUTHOR BIO ================= */}
      {author && (
        <>
          <div className="mb-8 flex items-center gap-4">
            <img
              src={author.profilePic?.url || "/default-avatar.png"}
              alt={author.username}
              className="w-20 h-20 rounded-full object-cover border"
            />

            <div>
              <h1 className="text-2xl font-bold">
                {author.username}
              </h1>
              <p className="text-gray-600 mt-1">
                {author.description ||
                  "This author hasn’t added a description yet."}
              </p>
            </div>
          </div>

          {/* Ad under author bio */}
          <div className="mb-10">
            <SimilarPostAd />
          </div>
        </>
      )}

      {/* ================= POSTS + ADS ================= */}
      {posts.map((post, index) => (
        <div key={post._id} className="mb-12">

          {/* DESKTOP */}
          <div className="hidden lg:grid grid-cols-[300px_1fr_300px] gap-8">

            {/* LEFT AD */}
            {(index + 1) % 6 === 0 ? (
              <div className="sticky top-24 self-start">
                <AuthorPageAd />
              </div>
            ) : (
              <div />
            )}

            {/* POST */}
            <PostCard post={post} isFeed />

            {/* RIGHT AD */}
            {(index + 1) % 6 === 0 ? (
              <div className="sticky top-24 self-start">
                <AuthorPageAd />
              </div>
            ) : (
              <div />
            )}
          </div>

          {/* MOBILE */}
          <div className="lg:hidden">
            <PostCard post={post} isFeed />
          </div>
        </div>
      ))}

      {/* ================= LOAD MORE ================= */}
      {hasMore && (
        <div className="flex justify-center my-12">
          <button
            onClick={() => setPage(p => p + 1)}
            disabled={loading}
            className="px-6 py-2 rounded-md font-medium
                       bg-blue-600 text-white
                       hover:bg-blue-700
                       disabled:opacity-60"
          >
            {loading ? "Loading..." : "Load more posts"}
          </button>
        </div>
      )}
    </div>
  );
}

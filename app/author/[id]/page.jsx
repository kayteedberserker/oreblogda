"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import AuthorPageAd from "@/app/components/AuthorPageAd";
import PostCard from "@/app/components/PostCard";

export default function AuthorPage() {
  const { id } = useParams();
  const [author, setAuthor] = useState(null);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const observerRef = useRef();

  const fetchAuthorData = useCallback(async () => {
    try {
      const [userRes, postRes] = await Promise.all([
        fetch(`/api/users/${id}`),
        fetch(`/api/posts?author=${id}&page=1&limit=5`),
      ]);

      const userData = await userRes.json();
      const postData = await postRes.json();

      if (userRes.ok) setAuthor(userData.user);
      if (postRes.ok) {
        setPosts(postData.posts);
        if (postData.posts?.length < 5) setHasMore(false);
      }
    } catch (err) {
    }
  }, [id]);

  const fetchMorePosts = useCallback(async () => {
    if (!hasMore || loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/posts?author=${id}&page=${page}&limit=5`);
      const data = await res.json();
      if (res.ok) {
        setPosts((prev) => [...prev, ...data.posts]);
        if (data.posts?.length < 5) setHasMore(false);
      }
    } catch (err) {
    } finally {
      setLoading(false);
    }
  }, [id, page, hasMore, loading]);

  useEffect(() => {
    fetchAuthorData();
  }, [id]);
  

  // Infinite scroll observer
  useEffect(() => {
      const handleScroll = () => {
        if (
          window.innerHeight + window.scrollY >=
            document.body.offsetHeight - 200 &&
          hasMore &&
          !loading
        ) {
          setPage(prev => prev + 1);
        }
      };
  
      window.addEventListener("scroll", handleScroll);
      return () => window.removeEventListener("scroll", handleScroll);
    }, [loading, hasMore]);

  useEffect(() => {
    if (page > 1) fetchMorePosts();
  }, [page]);

  return (
  <div className="max-w-7xl mx-auto mt-6 px-4 min-h-[70vh]">
    {/* 3-column layout */}
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_3fr_1fr] gap-6">

      {/* LEFT AD (desktop only) */}
      <div className="hidden lg:block">
        <AuthorPageAd />
      </div>

      {/* MAIN CONTENT */}
      <div className="max-w-3xl mx-auto">

        {/* AUTHOR BIO */}
        {author && (
          <div className="mb-6 text-left">
            <div className="flex items-center gap-4">
              <img
                src={author?.profilePic?.url || "/default-avatar.png"}
                alt={author.username}
                className="w-24 h-24 rounded-full object-cover border border-gray-300 dark:border-gray-600"
              />

              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {author.username}
                </h1>
                <p className="text-gray-600 dark:text-gray-300 mt-1">
                  {author.description || "This author hasn’t added a description yet."}
                </p>
              </div>
            </div>

            <hr className="my-4 border-gray-300 dark:border-gray-700" />
          </div>
        )}

        {/* MOBILE AD (below bio) */}
        <div className="lg:hidden my-4">
          <AuthorPageAd />
        </div>

        {/* POSTS */}
        {posts.length === 0 && !loading && (
          <p className="text-gray-500 text-center">No posts yet.</p>
        )}

        {posts.map((post) => (
          <PostCard
            key={post._id}
            post={post}
            posts={posts}
            setPosts={setPosts}
            isFeed
          />
        ))}

        {loading && (
          <p className="text-center text-gray-500 mt-4">
            Loading more posts...
          </p>
        )}

        <div ref={observerRef} className="h-10"></div>
      </div>

      {/* RIGHT AD (desktop only) */}
      <div className="hidden lg:block">
        <AuthorPageAd />
      </div>

    </div>
  </div>
);

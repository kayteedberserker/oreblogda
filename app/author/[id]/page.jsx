
"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import PostCard from "@/app/components/PostCard";
import SimilarPostAd from "@/app/components/SimilarPostAd";
import AuthorPageAd from "@/app/components/AuthorPageAd

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
        fetch(`/api/posts?author=${id}&page=1&limit=6`)
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
        setPosts(prev => [...prev, ...data.posts]);
        if (data.posts.length < 6) setHasMore(false);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [id, page, hasMore, loading]);

  useEffect(() => {
    fetchAuthorData();
  }, [id]);

  // Infinite scroll
  useEffect(() => {
    const onScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
          document.body.offsetHeight - 200 &&
        hasMore &&
        !loading
      ) {
        setPage(p => p + 1);
      }
    };

    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [hasMore, loading]);

  useEffect(() => {
    if (page > 1) fetchMorePosts();
  }, [page]);

  return (
    <div className="max-w-6xl mx-auto mt-6 px-4 min-h-[70vh]">

      {/* Author Bio */}
      {author && (
        <>
          <div className="mb-6 flex items-center gap-4">
            <img
              src={author.profilePic?.url || "/default-avatar.png"}
              alt={author.username}
              className="w-20 h-20 rounded-full object-cover border"
            />
            <div>
              <h1 className="text-2xl font-bold">{author.username}</h1>
              <p className="text-gray-600">
                {author.description || "This author hasn’t added a description yet."}
              </p>
            </div>
          </div>

          {/* Ad under author bio */}
          <SimilarPostAd />
        </>
      )}

      {/* Posts + Side Ads */}
      {posts.map((post, index) => (
        <div key={post._id} className="my-6">

          {/* Desktop layout */}
          <div className="hidden lg:grid grid-cols-[300px_1fr_300px] gap-6">
            {(index + 1) % 6 === 0 ? <AuthorPageAd /> : <div />}
            <PostCard post={post} isFeed />
            {(index + 1) % 6 === 0 ? <AuthorPageAd />: <div />}
          </div>

          {/* Mobile layout */}
          <div className="lg:hidden">
            <PostCard post={post} isFeed />
          </div>
        </div>
      ))}

      {loading && (
        <p className="text-center text-gray-500 my-6">Loading more posts...</p>
      )}
    </div>
  );
}

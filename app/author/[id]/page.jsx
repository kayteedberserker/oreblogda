"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
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
      console.error("Error fetching author:", err);
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
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id, page, hasMore, loading]);

  useEffect(() => {
    fetchAuthorData();
  }, [id]);
  console.log(author);
  

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
    <div className="max-w-5xl mx-auto mt-6 p-6 min-h-[70vh]">
      {author && (
  <div className="mb-6 text-left">
    <div className="flex items-center gap-4">
      {/* Author Image */}
      <img
        src={author?.profilePic?.url || "/default-avatar.png"}
        alt={author.username}
        className="w-50 h-50 rounded-full object-cover border border-gray-300 dark:border-gray-600"
      />

      {/* Author Info */}
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


      {posts.length === 0 && !loading && (
        <p className="text-gray-500 text-center">No posts yet.</p>
      )}

      {posts.map((post) => (
        <PostCard
          key={post._id}
          post={post}
          posts={posts}
          setPosts={setPosts}
          isFeed={true}
        />
      ))}

      {loading && (
        <p className="text-center text-gray-500 mt-4">Loading more posts...</p>
      )}

      <div ref={observerRef} className="h-10"></div>
    </div>
  );
}

"use client";
import { useEffect, useState, useRef } from "react";
import PostCard from "./PostCard";

export default function PostsViewer() {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const limit = 5;
  const prevScrollHeight = useRef(0);

  // 🧠 Fetch posts with scroll preservation
  const fetchPosts = async (pageNum = 1) => {
    try {
      setLoading(true);
      const res = await fetch(`/api/posts?page=${pageNum}&limit=${limit}`);
      const data = await res.json();
      const newPosts = Array.isArray(data) ? data : data.posts || [];

      if (newPosts.length < limit) setHasMore(false);

      // store current scroll height before adding new posts
      prevScrollHeight.current = document.body.scrollHeight;

      setPosts(prev => [...prev, ...newPosts]);

      // wait for DOM update then restore scroll position
      setTimeout(() => {
        const diff =
          document.body.scrollHeight - prevScrollHeight.current;
        window.scrollBy({ top: -diff, behavior: "instant" });
      }, 0);

      setLoading(false);
    } catch (err) {
      console.error("Failed to fetch posts:", err);
      setLoading(false);
    }
  };

  // initial fetch
  useEffect(() => {
    fetchPosts(page);
  }, [page]);

  // infinite scroll trigger
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
  }, [hasMore, loading]);

  return (
    <div className="max-w-7xl mx-auto px-2 md:px-8 py-6">
      {Array.isArray(posts) && posts.length > 0 ? (
        <div className="columns-1 md:columns-2 gap-6 space-y-6">
          {posts.map(post => (
            <div key={post._id} className="break-inside-avoid">
              <PostCard
                post={post}
                posts={posts}
                isFeed={true}
                setPosts={setPosts}
              />
            </div>
          ))}
        </div>
      ) : (
        !loading && (
          <p className="text-center text-gray-500">No posts available</p>
        )
      )}

      {loading && <p className="text-center text-gray-500 mt-4">Loading more...</p>}
      {!hasMore && (
        <p className="text-center text-gray-400 mt-4">No more posts to show</p>
      )}
    </div>
  );
}

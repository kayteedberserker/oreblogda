import { useState, useEffect } from "react";

export default function useInfinitePosts(apiUrl, limit = 5) {
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetchPosts = async () => {
      setLoading(true);
      const res = await fetch(`${apiUrl}?page=${page}&limit=${limit}`);
      const data = await res.json();

      if (data.posts.length < limit) setHasMore(false);
      setPosts(prev => [...prev, ...data.posts]);
      setLoading(false);
    };

    fetchPosts();
  }, [page]);

  return { posts, hasMore, loading, loadMore: () => setPage(p => p + 1) };
}

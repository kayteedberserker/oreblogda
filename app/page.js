// app/page.jsx
import PostsViewer from "@/app/components/PostsViewer";
import { ToastContainer } from "react-toastify";

export default async function HomePage() {
  const limit = 10;

  // Fetch posts on the server BEFORE rendering
  const res = await fetch(
  `${process.env.NEXT_PUBLIC_SITE_URL}/api/posts?page=1&limit=${limit}`,
  {
    next: { revalidate: 600 }, // Revalidate every 10 minutes
  }
);

  const initialData = await res.json();

  const initialPosts = Array.isArray(initialData)
    ? initialData
    : initialData.posts || [];

  return (
    <div className="mx-auto p-1 relative min-h-[75vh]">
      {/* Subtle anime glow */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-blue-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-56 h-56 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

      {/* Pass SSR posts to PostsViewer */}
      <PostsViewer initialPosts={initialPosts} />

      <ToastContainer />
    </div>
  );
}

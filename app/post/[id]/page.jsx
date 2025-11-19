// app/post/[id]/page.jsx
import PostCard from "@/app/components/PostCard";
import CommentSection from "@/app/components/CommentSection";
import SimilarPosts from "@/app/components/SimilarPosts";
import { motion } from "framer-motion";
import { useScrollAnimation } from "@/app/components/useScrollAnimation";
import { ToastContainer } from "react-toastify";

async function fetchPost(id) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/posts/${id}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export default async function PostPage({ params }) {
  const { ref, controls, variants } = useScrollAnimation();
  const { id } = params;

  // --- SSR fetch ---
  const post = await fetchPost(id);

  if (!post) {
    return (
      <p className="text-center mt-8 min-h-[50vh]">
        Post not found
      </p>
    );
  }

  const description = post.message?.slice(0, 150) || "Read this post on Oreblogda";
  const postUrl = `https://oreblogda.vercel.app/post/${post._id}`;
  const postImage = post?.mediaUrl || "https://oreblogda.vercel.app/og-image.png";

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={variants}
      className="p-2 md:p-6 bg-transparent rounded-2xl shadow-md"
    >
      <div className="max-w-7xl mx-auto py-4 md:py-10 px-2 md:px-4 min-h-[70vh] relative">
        {/* Background glows */}
        <div className="absolute top-10 left-10 w-48 h-48 bg-blue-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-56 h-56 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

        {/* SEO */}
        

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Post content */}
          <div className="md:col-span-3">
            {/* PostCard is still client-side interactive */}
            <PostCard post={post} isFeed={false} posts={[post]} setPosts={() => {}} hideComments={true} />

            {/* Similar posts for large screens */}
            <div className="hidden md:block">
              <SimilarPosts category={post.category} currentPostId={post._id} />
            </div>
          </div>

          {/* Comments section */}
          <div className="md:col-span-2">
            <CommentSection postId={id} />

            {/* Similar posts for small screens */}
            <div className="md:hidden mt-6">
              <SimilarPosts category={post.category} currentPostId={post._id} />
            </div>
          </div>
        </div>

        <ToastContainer autoClose={1500} />
      </div>
    </motion.div>
  );
}

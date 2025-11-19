"use client";

import { useState, useEffect } from "react";
import Cookies from "js-cookie";
import PostCard from "@/app/components/PostCard";
import CommentSection from "@/app/components/CommentSection";
import SimilarPosts from "@/app/components/SimilarPosts";
import { useScrollAnimation } from "@/app/components/useScrollAnimation";
import { motion } from "framer-motion";
import { ToastContainer } from "react-toastify";

export default function PostContent({ post: initialPost }) {
  const { ref, controls, variants } = useScrollAnimation();
  const [post, setPost] = useState(initialPost);

  // Increment view count if not viewed today
  useEffect(() => {
    const updateViews = async () => {
      const viewed = Cookies.get(`viewed-${post._id}`);
      if (!viewed) {
        await fetch(`/api/posts/${post._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "view" }),
        });
        Cookies.set(`viewed-${post._id}`, "true", { expires: 1 });
        setPost((prev) => ({ ...prev, views: prev.views + 1 }));
      }
    };
    updateViews();
  }, [post._id]);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={variants}
      className="p-2 md:p-6 bg-transparent rounded-2xl shadow-md"
    >
      <div className="max-w-7xl mx-auto py-4 md:py-10 px-2 md:px-4 min-h-[70vh] relative">
        {/* Subtle anime glow */}
        <div className="absolute top-10 left-10 w-48 h-48 bg-blue-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-56 h-56 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
          {/* Post content */}
          <div className="md:col-span-3">
            <PostCard
              post={post}
              isFeed={false}
              posts={[post]}
              setPosts={setPost}
              hideComments={true}
            />

            {/* Similar posts for large screens */}
            <div className="hidden md:block">
              <SimilarPosts category={post.category} currentPostId={post._id} />
            </div>
          </div>

          {/* Comments section */}
          <div className="md:col-span-2">
            <CommentSection postId={post._id} />

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

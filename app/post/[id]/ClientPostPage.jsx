"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import PostCard from "@/app/components/PostCard";
import CommentSection from "@/app/components/CommentSection";
import SimilarPosts from "@/app/components/SimilarPosts";
import { NextSeo, ArticleJsonLd } from "next-seo";
import { ToastContainer } from "react-toastify";
import { motion } from "framer-motion";
import { useScrollAnimation } from "@/app/components/useScrollAnimation";

export default function ClientPostPage({
  post: initialPost,
  similarPosts,
  description,
  postUrl,
  postImage,
}) {
  const [post, setPost] = useState(initialPost);
  const { ref, controls, variants } = useScrollAnimation();

  // Increment views once per day
  useEffect(() => {
    const viewed = Cookies.get(`viewed-${post._id}`);

    if (!viewed) {
      fetch(`/api/posts/${post._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "view" }),
      });

      Cookies.set(`viewed-${post._id}`, "true", { expires: 1 });

      setPost((p) => ({ ...p, views: p.views + 1 }));
    }
  }, [post._id]);

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={controls}
      variants={variants}
      className="p-2 md:p-6 rounded-2xl"
    >
      {/* SEO */}
      <NextSeo
        title={post.title}
        description={description}
        canonical={postUrl}
        openGraph={{
          url: postUrl,
          title: post.title,
          description,
          images: [
            {
              url: postImage,
              width: 800,
              height: 600,
              alt: post.title,
            },
          ],
        }}
      />

      <ArticleJsonLd
        type="BlogPosting"
        url={postUrl}
        title={post.title}
        images={[postImage]}
        datePublished={post.createdAt}
        dateModified={post.updatedAt || post.createdAt}
        authorName={post.authorName || "Oreblogda"}
        description={description}
      />

      <div className="max-w-7xl mx-auto py-4">
        <PostCard
          post={post}
          isFeed={false}
          posts={[post]}
          setPosts={setPost}
          hideComments={true}
        />

        {/* Similar Posts */}
        <SimilarPosts posts={similarPosts} />

        {/* Comments */}
        <CommentSection postId={post._id} />

        <ToastContainer autoClose={1500} />
      </div>
    </motion.div>
  );
}

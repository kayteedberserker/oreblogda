"use client";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { NextSeo, ArticleJsonLd } from "next-seo";
import PostCard from "@/app/components/PostCard";
import { useParams } from "next/navigation";
import { ToastContainer } from "react-toastify";
import CommentSection from "@/app/components/CommentSection";
import SimilarPosts from "@/app/components/SimilarPosts";
import { useScrollAnimation } from "@/app/components/useScrollAnimation";
import { motion } from "framer-motion";

export default function PostPage() {
  const { ref, controls, variants } = useScrollAnimation();
  const params = useParams();
  const { id } = params;
  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/posts/${id}`);
        if (!res.ok) throw new Error("Failed to fetch post");
        const data = await res.json();
        setPost(data);

        // Increment view count if not viewed today
        const viewed = Cookies.get(`viewed-${id}`);
        if (!viewed) {
          await fetch(`/api/posts/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "view" }),
          });
          Cookies.set(`viewed-${id}`, "true", { expires: 1 });
          setPost((prev) => ({ ...prev, views: prev.views + 1 }));
        }
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  if (loading) return <p className="text-center mt-8 min-h-[70vh]">Loading...</p>;
  if (!post) return <p className="text-center mt-8 min-h-[50vh]">Post not found</p>;

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
      {/* Subtle anime glow */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-blue-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-56 h-56 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

      {/* Page SEO */}
      <NextSeo
        title={post?.title}
        description={description}
        canonical={postUrl}
        openGraph={{
          url: postUrl,
          title: post.message?.slice(0, 30) || "Post title",
          description,
          images: [
            {
              url: postImage,
              width: 800,
              height: 600,
              alt: post.message?.slice(0, 20),
            },
          ],
        }}
      />

      {/* Structured Data for Google */}
      <ArticleJsonLd
        type="BlogPosting"
        url={postUrl}
        title={post?.title}
        images={[postImage]}
        datePublished={post.createdAt}
        dateModified={post.updatedAt || post.createdAt}
        authorName={post.authorName || "Oreblogda"}
        description={description}
      />
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

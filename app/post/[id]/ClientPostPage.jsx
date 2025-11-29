"use client";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import useSWR from "swr";
import PostCard from "@/app/components/PostCard";
import FooterAd from "@/app/components/FooterAd";
import CommentSection from "@/app/components/CommentSection";
import SimilarPosts from "@/app/components/SimilarPosts";
import { NextSeo, ArticleJsonLd } from "next-seo";
import { ToastContainer } from "react-toastify";
import { motion } from "framer-motion";
import { useScrollAnimation } from "@/app/components/useScrollAnimation";

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function ClientPostPage({
  post: initialPost,
  similarPosts,
  description,
  postUrl,
  postImage,
}) {
  const { ref, controls, variants } = useScrollAnimation();

  // SWR to keep post up-to-date
  const { data: postData, mutate } = useSWR(
    `/api/posts/${initialPost._id}`,
    fetcher,
    { fallbackData: initialPost, revalidateOnFocus: false }
  );

  // Increment views once per day
  useEffect(() => {
    if (!postData?._id) return;

    const viewed = Cookies.get(`viewed-${postData._id}`);
    if (!viewed) {
      fetch(`/api/posts/${postData._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "view" }),
      }).then(() => {
        // Optimistically update the view count
        mutate({ ...postData, views: postData.views + 1 }, false);
      });

      Cookies.set(`viewed-${postData._id}`, "true", { expires: 1 });
    }
  }, [postData, mutate]);

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
        title={postData.title}
        description={description}
        canonical={postUrl}
        openGraph={{
          url: postUrl,
          title: postData.title,
          description,
          images: [
            {
              url: postImage,
              width: 800,
              height: 600,
              alt: postData.title,
            },
          ],
        }}
      />

      <ArticleJsonLd
        type="BlogPosting"
        url={postUrl}
        title={postData.title}
        images={[postImage]}
        datePublished={postData.createdAt}
        dateModified={postData.updatedAt || postData.createdAt}
        authorName={postData.authorName || "Oreblogda"}
        description={description}
      />

      <div className="max-w-7xl mx-auto py-4">
        <PostCard
          post={postData}
          isFeed={false}
          posts={[postData]}
          setPosts={mutate} // SWR mutate updates post immediately
          hideComments={true}
       />
    <div className="my-2">
      <FooterAd />
    </div>
        {/* Comments */}
        <CommentSection postId={postData._id} mutatePost={mutate} />
    <div className="my-2">
      <FooterAd />
    </div>
        {/* Similar Posts */}
        <SimilarPosts
          posts={similarPosts}
          category={postData?.category}
          currentPostId={postData?._id}
        />
    <div className="my-2">
      <FooterAd />
    </div>
        <ToastContainer autoClose={1500} />
      </div>
    </motion.div>
  );
}

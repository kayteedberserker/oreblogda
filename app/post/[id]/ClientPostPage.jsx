"use client";
import Head from "next/head";

import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import useSWR from "swr";
import PostCard from "@/app/components/PostCard";
import CommentSection from "@/app/components/CommentSection";
import SimilarPosts from "@/app/components/SimilarPosts";
import { NextSeo, ArticleJsonLd } from "next-seo";
import { ToastContainer } from "react-toastify";
import {motion} from "framer-motion";
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
    <div className="min-h-screen relative">
      <Head>
        <title>{postData.title} | Oreblogda</title>
        <meta name="description" content={description} />
        {/* Open Graph */}
        <meta property="og:type" content="article" />
        <meta property="og:title" content={postData.title} />
        <meta property="og:description" content={description} />
        <meta property="og:image" content={postImage} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:url" content={postUrl} />
        <meta property="og:site_name" content="Oreblogda" />
        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={postData.title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={postImage} />
        <link rel="canonical" href={postUrl} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: postData.title,
              image: [postImage],
              url: postUrl,
              datePublished: postData.createdAt,
              dateModified: postData.updatedAt || postData.createdAt,
              author: {
                "@type": "Person",
                name: postData.authorName || "Oreblogda",
              },
              description: description,
              publisher: {
                "@type": "Organization",
                name: "Oreblogda",
                logo: {
                  "@type": "ImageObject",
                  url: "https://oreblogda.com/ogimage.png",
                },
              },
            }),
          }}
        />
      </Head>

      {/* --- TOP DATA STREAM LOADER --- */}
      <div className="fixed top-16 left-0 w-full h-[1px] bg-blue-900/20 z-[60] overflow-hidden">
        <div className="h-full bg-blue-500 animate-[data-stream_3s_infinite] w-[40%]" />
      </div>

      <div className="p-2 md:p-6 lg:pt-10">
        <div className="max-w-7xl mx-auto">
          
          {/* --- BREADCRUMB HUD --- */}
          <div className="flex items-center gap-2 mb-6 px-2">
            <span className="text-[10px] font-mono text-blue-600 font-bold tracking-widest uppercase">Intel_Stream</span>
            <div className="h-[1px] w-10 bg-gray-300 dark:bg-gray-800" />
            <span className="text-[10px] font-mono text-gray-500 uppercase tracking-widest truncate max-w-[200px]">
              {postData.category} {/* {postData._id.slice(-6)} */}
            </span>
          </div>

          <div className="flex flex-col lg:grid lg:grid-cols-[1fr_380px] gap-6">
            
            {/* --- MAIN CONTENT SECTOR --- */}
            <div 
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-1"
            >
              <div className="relative group bg-white dark:bg-black/40 border border-gray-100 dark:border-blue-900/20 rounded-3xl overflow-hidden shadow-2xl">
                {/* Corner Decoration */}
                <div className="absolute top-0 right-0 w-12 h-12 border-t-2 border-r-2 border-blue-600/20 rounded-tr-3xl pointer-events-none" />
                
                <PostCard
                  post={postData}
                  isFeed={false}
                  posts={[postData]}
                  setPosts={mutate}
                  hideComments={true}
                />
              </div>
            </div>

            {/* --- SIDEBAR: COMMS CHANNEL --- */}
            <div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex-col"
            >
              <div className="sticky top-24 space-y-6">
                <div className="bg-gray-50/50 dark:bg-gray-950/50 backdrop-blur-md rounded-3xl border border-gray-100 dark:border-blue-900/20 p-4">
                  <div className="flex items-center gap-2 mb-4 px-2">
                    <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
                    <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-gray-900 dark:text-white">
                      Comms_Channel
                    </h3>
                  </div>
                  <CommentSection postId={postData._id} mutatePost={mutate} />
                </div>
              </div>
            </div>
          </div>

          {/* --- SIMILAR INTEL SECTOR --- */}
          <div className="mt-6">
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-2xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">
                Related <span className="text-blue-600">Intel</span>
              </h2>
              <div className="h-[2px] flex-1 bg-gradient-to-r from-blue-600/30 via-transparent to-transparent" />
            </div>
            
            <SimilarPosts
              posts={similarPosts}
              category={postData?.category}
              currentPostId={postData?._id}
            />
          </div>
        </div>
      </div>

      <ToastContainer autoClose={1500} theme="dark" />

      <style jsx>{`
        @keyframes data-stream {
          0% { transform: translateX(-100%); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateX(250%); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

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
    
    <div className="p-2 md:p-6 rounded-2xl">
      {/* SEO */}
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

				{/* Canonical */}
				<link rel="canonical" href={postUrl} />

				{/* JSON-LD structured data */}
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							"@context": "https://schema.org",
							"@type": "BlogPosting",
							headline: postData.title,
							image: [postImage],
							url: postUrl,
							datePublished: new Date(postData.createdAt).toISOString(),
							dateModified: new Date(postData.updatedAt || postData.createdAt).toISOString(),
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
      <div className="max-w-7xl mx-auto py-4">
        <div className="flex flex-col lg:flex-row lg:space-x-4">
          <div className="flex-2">
            <PostCard
              post={postData}
              isFeed={false}
              posts={[postData]}
              setPosts={mutate}
              hideComments={true}
            />
          </div>

          <div className="flex-1 mt-4 lg:mt-0">
            <CommentSection postId={postData._id} mutatePost={mutate} />
          </div>
        </div>

        {/* Similar Posts */}
        <SimilarPosts
          posts={similarPosts}
          category={postData?.category}
          currentPostId={postData?._id}
        />
        <ToastContainer autoClose={1500} />
      </div>
    </div>
  );
}

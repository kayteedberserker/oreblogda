"use client";
import { useEffect, useState } from "react";
import Cookies from "js-cookie";
import { NextSeo, ArticleJsonLd } from "next-seo";
import PostCard from "@/components/PostCard";
import { useParams } from "next/navigation";
import { ToastContainer } from "react-toastify";
import CommentSection from "@/components/CommentSection";

export default function PostPage() {
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
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchPost();
  }, [id]);

  if (loading) return <p className="text-center mt-8">Loading...</p>;
  if (!post) return <p className="text-center mt-8">Post not found</p>;

  const description = post.message?.slice(0, 150) || "Read this post on Oreblogda";
  const postUrl = `https://yourdomain.com/post/${post._id}`;
  const postImage = post.mediaUrl || "https://yourdomain.com/og-image.jpg";

  return (
    <div className="max-w-7xl mx-auto py-10 px-4 min-h-[70vh]">
      {/* Page SEO */}
      <NextSeo
        title={post.title || "Post title"}
        description={description}
        canonical={postUrl}
        openGraph={{
          url: postUrl,
          title: post.title || "Post title",
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
        title={post.title || "Post title"}
        images={[postImage]}
        datePublished={post.createdAt}
        dateModified={post.updatedAt || post.createdAt}
        authorName={post.authorName || "Oreblogda"}
        description={description}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Post content (2/3 width) */}
        <div className="lg:col-span-2">
          <PostCard
            post={post}
            isFeed={false}
            posts={[post]}
            setPosts={setPost}
            hideComments={true}
          />
        </div>

        {/* Comments section (1/3 width) */}
        <div className="lg:col-span-1">
          <CommentSection postId={id} />
        </div>
      </div>

      <ToastContainer autoClose={2500} />
    </div>
  );
}

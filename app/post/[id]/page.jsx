import ClientPostPage from "./ClientPostPage";
import { notFound } from "next/navigation";

export const revalidate = 60;

// Security headers to bypass your middleware operative check
const INTERNAL_HEADERS = {
  "x-oreblogda-secret": process.env.APP_INTERNAL_SECRET,
  "Content-Type": "application/json",
};

export async function generateMetadata({ params }) {
  const awaitParams = await params;
  const { id } = awaitParams;

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/posts/${id}`, {
    headers: INTERNAL_HEADERS,
  });
  
  if (!res.ok) return notFound();

  const post = await res.json();

  const description = post.message?.slice(0, 150) || "Read this post on Oreblogda";
  const postUrl = `https://oreblogda.com/post/${post.slug || post._id}`;
  
  // --- SMART MEDIA PREVIEW LOGIC ---
  // --- INSIDE YOUR generateMetadata FUNCTION ---

let postImage = "https://oreblogda.com/ogimage.png";

if (post.mediaUrl && post.mediaUrl.includes("res.cloudinary.com")) {
  const isVideo = post.mediaType === "video" || post.mediaUrl.match(/\.(mp4|mov|webm|mkv)$/i);
  
  if (isVideo) {
    // We strip out 'q_auto,vc_auto' and replace with OG-friendly image settings
    // This ensures bots don't see video-related parameters in an image URL
    postImage = post.mediaUrl
      .replace("/q_auto,vc_auto/", "/f_jpg,q_auto,so_auto,c_pad,w_1200,h_630,b_black/")
      .replace(/\.[^/.]+$/, ".jpg");
  } else {
    postImage = post.mediaUrl.replace("/upload/", "/upload/c_fill,w_1200,h_630,f_auto,q_auto/");
  }
}


  return {
    authors: [
      { name: post.authorName, url: `https://oreblogda.com/author/${post.authorId || post.authorUserId}` }
    ],
    title: post.title,
    description,
    openGraph: {
      title: post.title,
      description,
      url: postUrl,
      siteName: "Oreblogda",
      images: [
        {
          url: postImage,
          width: 1200,
          height: 630,
          alt: post.title,
        },
      ],
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      site: "https://oreblogda.com",
      title: post.title,
      description,
      images: [postImage],
      creator: "@oreblogda",
    },
    alternates: {
      canonical: postUrl,
    },
    metadataBase: new URL("https://oreblogda.com"),
    icons: {
      icon: "https://oreblogda.com/iconblue.png",
    },
    other: {
      "application/ld+json": JSON.stringify({
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        description,
        author: { "@type": "Person", name: post.authorName || "Oreblogda" },
        publisher: {
          "@type": "Organization",
          name: "Oreblogda",
          logo: { "@type": "ImageObject", url: "https://oreblogda.com/ogimage.png" },
        },
        image: [postImage],
        url: postUrl,
        datePublished: new Date(post.createdAt).toISOString(),
        dateModified: new Date(post.updatedAt || post.createdAt).toISOString(),
      }),
    },
  };
}


export default async function PostPage({ params }) {
  const awaitParams = await params;
  const { id } = awaitParams;

  // 1. Fetch main post with internal secret
  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/posts/${id}`, {
    headers: INTERNAL_HEADERS,
    next: { revalidate: 30 },
  });

  if (!res.ok) {
    console.error(`⛔ Post fetch failed: ${res.status}`);
    return <p className="text-center mt-8 min-h-[50vh]">Post not found</p>;
  }
  
  const post = await res.json();

  // 2. Fetch similar posts with internal secret
  const simRes = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/posts?category=${post.category}&limit=6`,
    { 
      headers: INTERNAL_HEADERS,
      next: { revalidate: 120 } 
    }
  );

  let similarPosts = [];
  if (simRes.ok) {
    const simData = await simRes.json();
    similarPosts = (simData.posts || []).filter((p) => p._id !== id);
  }

  // Prepare metadata for the client component
  const description = post.message?.slice(0, 150) || "Read this post on Oreblogda";
  const postUrl = `https://oreblogda.com/post/${post._id}`;
  const postImage = post.mediaUrl || "https://oreblogda.com/ogimage.png";

  return (
    <ClientPostPage
      post={post}
      similarPosts={similarPosts}
      description={description}
      postUrl={postUrl}
      postImage={postImage}
    />
  );
}

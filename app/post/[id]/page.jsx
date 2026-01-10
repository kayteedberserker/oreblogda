import ClientPostPage from "./ClientPostPage"; // client component
import Head from "next/head";

export const dynamic = "force-dynamic"; // ensures full server render

import { notFound } from "next/navigation";

export async function generateMetadata({ params }) {
  const awaitParams = await params;
	const { id } = awaitParams;

  const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/posts/${id}`);
  if (!res.ok) return notFound();

  const post = await res.json();

  const description = post.message?.slice(0, 150) || "Read this post on Oreblogda";
  const postUrl = `https://oreblogda.com/post/${post.slug || post._id}`;
  const postImage = post.mediaUrl ? post.mediaUrl.includes("res.cloudinary.com") ? post.mediaUrl : "https://oreblogda.com/ogimage.png" : "https://oreblogda.com/ogimage.png";

  return {
    authors: [
      { name: post.authorName, url: `https://oreblogda.com/author/${post.authorId || post.authorUserId}` }
    ],
    title: post.title,
    description,

    // Open Graph for social previews
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

    // Twitter card
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

    // ✅ Article JSON-LD
    metadataBase: new URL("https://oreblogda.com"),
    icons: {
      icon: "https://oreblogda.com/iconblue.png",
    },
    // For structured data, Next.js app router supports this field:
    other: {
      "application/ld+json": {
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
      },
    },
  };
}

export default async function PostPage({ params }) {
	const awaitParams = await params;
	const { id } = awaitParams;

	// Fetch main post
	const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/posts/${id}`, {
		next: { revalidate: 30 },
	});
	if (!res.ok) return <p className="text-center mt-8 min-h-[50vh]">Post not found</p>;
	const post = await res.json();

	// Fetch similar posts
	const simRes = await fetch(
		`${process.env.NEXT_PUBLIC_SITE_URL}/api/posts?category=${post.category}&limit=6`,
		{ next: { revalidate: 120 } }
	);
	const simData = await simRes.json();
	const similarPosts = (simData.posts || []).filter((p) => p._id !== id);

	// Prepare SEO info
	const description = post.message?.slice(0, 150) || "Read this post on Oreblogda";
	const postUrl = `https://oreblogda.com/post/${post._id}`;
	const postImage = post.mediaUrl || "https://oreblogda.com/ogimage.png";

	return (
		<>
			{/* ------------------ SERVER-RENDERED SEO ------------------ */}
			<Head>
				{/* Basic Meta */}
				<title>{post.title} | Oreblogda</title>
				<meta name="description" content={description} />

				{/* Open Graph */}
				<meta property="og:type" content="article" />
				<meta property="og:title" content={post.title} />
				<meta property="og:description" content={description} />
				<meta property="og:image" content={postImage} />
				<meta property="og:image:width" content="1200" />
				<meta property="og:image:height" content="630" />
				<meta property="og:url" content={postUrl} />
				<meta property="og:site_name" content="Oreblogda" />

				{/* Twitter Card */}
				<meta name="twitter:card" content="summary_large_image" />
				<meta name="twitter:title" content={post.title} />
				<meta name="twitter:description" content={description} />
				<meta name="twitter:image" content={postImage} />

				{/* Canonical */}
				<link rel="canonical" href={postUrl} />

				{/* JSON-LD Structured Data */}
				<script
					type="application/ld+json"
					dangerouslySetInnerHTML={{
						__html: JSON.stringify({
							"@context": "https://schema.org",
							"@type": "BlogPosting",
							headline: post.title,
							image: [postImage],
							url: postUrl,
							datePublished: new Date(post.createdAt).toISOString(),
							dateModified: new Date(post.updatedAt || post.createdAt).toISOString(),
							author: { "@type": "Person", name: post.authorName || "Oreblogda" },
							description,
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

			{/* ------------------ CLIENT COMPONENT ------------------ */}
			<ClientPostPage
				post={post}
				similarPosts={similarPosts}
				description={description}
				postUrl={postUrl}
				postImage={postImage}
			/>
		</>
	);
}

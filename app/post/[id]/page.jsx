import ClientPostPage from "./ClientPostPage"; // safe: this is a client boundary

export const dynamic = "force-dynamic"; // optional but helps

export default async function PostPage({ params }) {
  const checkedParams = await params
  const { id } = checkedParams; 

  // Fetch main post
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/posts/${id}`, 
  {
    next: { revalidate: 30 }, // Revalidate every 10 minutes
  });
  if (!res.ok) {
    return <p className="text-center mt-8 min-h-[50vh]">Post not found</p>;
  }
  const post = await res.json();

  // Fetch similar posts
  const simRes = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/posts?category=${post.category}&limit=6`,
    {
    next: { revalidate: 120 }, // Revalidate every 10 minutes
    }
  );
  const simData = await simRes.json();

  const similarPosts = (simData.posts || []).filter((p) => p._id !== id);
  // Prepare strings for SEO
  const description = post.message?.slice(0, 150) || "Read this post on Oreblogda";
  const postUrl = `https://oreblogda.vercel.app/post/${post._id}`;
  const postImage = post.mediaUrl || "https://oreblogda.vercel.app/og-image.png";

  // 🚨 VERY IMPORTANT:
  // No client-only component is rendered directly here.
  // Instead, everything is passed into a client wrapper.
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

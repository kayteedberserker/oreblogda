// app/post/[id]/page.jsx
import PostContent from "./PostContent";
import { notFound } from "next/navigation";

// Fetch post by ID (or slug)
async function getPostById(id) {
  console.log(id) 
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/posts/${id}`, {
      next: { revalidate: 10 }, // ISR caching
    });

    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export default async function PostPage({ params }) {
  // Get the dynamic 'id' from the URL
  const { id } = params;

  const post = await getPostById(id);

  if (!post) return notFound();

  return <PostContent post={post} />;
}

// app/post/[id]/page.jsx
import PostContent from "./PostContent";
import { notFound } from "next/navigation";

// Replace with your actual fetch function or API call
async function getPostById(id) {
  const res = await fetch(`${process.env.NEXT_PUBLIC_URL}/api/posts/${id}`, {
    next: { revalidate: 10 },
  });
  if (!res.ok) return null;
  return res.json();
}

export default async function PostPage({ params }) {
  const { id } = params;
  const post = await getPostById(id);

  if (!post) return notFound();

  return <PostContent post={post} />;
}

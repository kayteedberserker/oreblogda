import { connectDB } from "@/app/lib/connectDB";
import Post from "@/app/models/PostModel";

export async function GET() {
  await connectDB();
  const posts = await Post.find().sort({ createdAt: -1 });

  const baseUrl = "https://yourdomain.com";

  const urls = posts
    .map(
      (post) => `
    <url>
      <loc>${baseUrl}/post/${post._id}</loc>
      <lastmod>${new Date(post.updatedAt).toISOString()}</lastmod>
    </url>
  `
    )
    .join("");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
    <url>
      <loc>${baseUrl}</loc>
      <lastmod>${new Date().toISOString()}</lastmod>
    </url>
    ${urls}
  </urlset>`;

  return new Response(xml, {
    headers: { "Content-Type": "application/xml" },
  });
}

import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";



export async function GET() {
  try {
    await connectDB();
    const posts = await Post.find().sort({ createdAt: -1 });
    const baseUrl = "https://oreblogda.vercel.app";

    const urls = posts
      .map(
        (post) => `
      <url>
        <loc>${baseUrl}/post/${post.slug || post._id}</loc>
        <lastmod>${new Date(post.updatedAt).toISOString()}</lastmod>
      </url>`
      )
      .join("");
      const categories = ["memes", "videos-edits", "news", "polls", "review", "gaming"]
      const otherUrls = categories
      .map(
        (category) => `
      <url>
        <loc>${baseUrl}/categories/${category}</loc>
      </url>`
      )
      .join("");
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>${baseUrl}</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
      </url>
      ${urls}
      ${otherUrls}
    </urlset>`;

    return new Response(xml, {
      headers: { "Content-Type": "application/xml" },
    });
  } catch (err) {
    const fallback = `<?xml version="1.0" encoding="UTF-8"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
      <url>
        <loc>https://oreblogda.vercel.app</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
      </url>
    </urlset>`;
    return new Response(fallback, {
      headers: { "Content-Type": "application/xml" },
      status: 200,
    });
  }
}

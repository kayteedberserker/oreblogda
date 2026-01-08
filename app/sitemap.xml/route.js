import connectDB from "@/app/lib/mongodb";
import Post from "@/app/models/PostModel";
import User from "@/app/models/UserModel";
import MobileUser from "@/app/models/MobileUserModel";


export async function GET() {
  try {
    await connectDB();
    const posts = await Post.find().sort({ createdAt: -1 });
    const authors = await User.find().sort({ createdAt: -1 });
    const mobileUsers = await MobileUser.find().sort({ createdAt: -1 });
    const baseUrl = "https://oreblogda.com";

    const urls = posts
      .map(
        (post) => `
      <url>
        <loc>${baseUrl}/post/${post.slug || post._id}</loc>
        <lastmod>${new Date(post.updatedAt).toISOString()}</lastmod>
      </url>`
      )
      .join("");
    const authorUrls = authors
      .map(
        (author) => `
      <url>
        <loc>${baseUrl}/author/${author.deviceId || author._id}</loc>
        <lastmod>${new Date(author.updatedAt).toISOString()}</lastmod>
      </url>`
      )
      .join("");
    const mobileUserUrls = mobileUsers
      .filter((user) => user.lastStreak) // Only include users with a streak
      .map((user) => {
        // Explicitly return the string
        return `
    <url>
      <loc>${baseUrl}/author/${user.deviceId || user._id}</loc>
      <lastmod>${new Date(user.updatedAt).toISOString()}</lastmod>
    </url>`;
      })
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
      ${authorUrls}
      ${mobileUserUrls}
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
        <loc>https://oreblogda.com</loc>
        <lastmod>${new Date().toISOString()}</lastmod>
      </url>
    </urlset>`;
    return new Response(fallback, {
      headers: { "Content-Type": "application/xml" },
      status: 200,
    });
  }
}

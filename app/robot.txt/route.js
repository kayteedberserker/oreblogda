// app/robots.txt/route.js

export async function GET() {
  return new Response(
    `User-agent: *
Allow: /
Allow: /categories/news
Allow: /categories/memes 
Allow: /categories/videos-edits
Allow: /categories/gaming
Allow: /categories/review
Allow: /categories/polls
Disallow: /authordiary
Disallow: /authordiary/profile

Sitemap: https://oreblogda.com/sitemap.xml
`,
    {
      headers: {
        "Content-Type": "text/plain",
      },
    }
  );
}

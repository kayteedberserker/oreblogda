// app/robots.txt/route.js

export async function GET() {
  return new Response(
    `User-agent: *
Allow: /
Disallow: /authordiary
Disallow: /authordiary/profile

Sitemap: https://oreblogda.vercel.app/sitemap.xml
`,
    {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    }
  );
}

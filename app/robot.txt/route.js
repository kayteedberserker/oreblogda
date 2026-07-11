export async function GET() {
    return new Response(
        `# Block aggressive AI scrapers and scrapers completely
User-agent: GPTBot
Disallow: /

User-agent: ClaudeBot
Disallow: /

User-agent: Applebot-Extended
Disallow: /

User-agent: CCBot
Disallow: /

User-agent: PerplexityBot
Disallow: /

User-agent: Omgilibot
Disallow: /

# Rules for SEO Search Engines (Google, Bing, etc.)
User-agent: *
Disallow: /api/
Disallow: /authordiary/
Disallow: /authordiary/profile

Sitemap: https://oreblogda.com/sitemap.xml
`,
        {
            headers: {
                "Content-Type": "text/plain",
                "Cache-Control": "public, max-age=86400, must-revalidate",
            },
        }
    );
}

import AuthorPageClient from "./AuthorPageClient.jsx";
import { notFound } from "next/navigation";

export const revalidate = 60; 

// This ensures our server-side fetch is recognized by your middleware
const INTERNAL_HEADERS = {
    "x-oreblogda-secret": process.env.APP_INTERNAL_SECRET,
    "Content-Type": "application/json",
};

export async function generateMetadata({ params }) {
    const awaitParams = await params;
    const { id } = awaitParams;

    // Fetch author info with the secret header
    const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/users/${id}`, {
        headers: INTERNAL_HEADERS,
    });
    
    if (!res.ok) return notFound();

    const author = await res.json();

    const description =
        author.user.description?.slice(0, 150) ||
        `Posts by ${author.user.username} on Oreblogda`;

    const authorUrl = `https://oreblogda.com/author/${id}`;
    const authorImage = author.user.profilePic?.url || "https://oreblogda.com/default-avatar.png";

    return {
        title: `${author.user.username} – Oreblogda`,
        description,
        openGraph: {
            title: `${author.user.username} – Oreblogda`,
            description,
            url: authorUrl,
            siteName: "Oreblogda",
            images: [
                {
                    url: authorImage,
                    width: 1200,
                    height: 630,
                    alt: author.user.username,
                },
            ],
            type: "profile",
        },
        twitter: {
            card: "summary_large_image",
            title: `${author.user.username} – Oreblogda`,
            description,
            images: [authorImage],
            creator: "@oreblogda",
        },
        alternates: {
            canonical: authorUrl,
        },
        authors: [
            {
                name: author.user.username,
                url: authorUrl,
            },
        ],
        other: {
            "application/ld+json": {
                "@context": "https://schema.org",
                "@type": "Person",
                name: author.user.username,
                url: authorUrl,
                image: authorImage,
                description: description,
            },
        },
    };
}

export default async function AuthorPage({ params }) {
    const awaitParams = await params;
    const { id } = awaitParams;

    // Pre-fetch with the secret header to bypass middleware 401
    const [userRes, postRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/users/${id}`, {
            headers: INTERNAL_HEADERS,
        }),
        fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/posts?author=${id}&page=1&limit=6`, {
            headers: INTERNAL_HEADERS,
        }),
    ]);

    if (!userRes.ok) {
        console.error("User fetch failed:", userRes.status);
        return notFound();
    }
    if (!postRes.ok) {
        console.error("Posts fetch failed:", postRes.status);
        return notFound();
    }

    const userData = await userRes.json();
    const postData = await postRes.json();

    return (
        <AuthorPageClient
            author={userData.user}
            initialPosts={postData.posts}
            total={postData.total}
        />
    );
}

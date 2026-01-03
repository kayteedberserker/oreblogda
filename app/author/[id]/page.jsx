// app/author/[id]/page.js  (server component)
import AuthorPageClient from "./AuthorPageClient.jsx"; // your client component
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }) {
	const awaitParams = await params;
	const { id } = awaitParams;

	// Fetch author info
	const res = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/users/${id}`);
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

	// Pre-fetch first 6 posts server-side (optional)
	const [userRes, postRes] = await Promise.all([
		fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/users/${id}`),
		fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/posts?author=${id}&page=1&limit=6`),
	]);

	if (!userRes.ok || !postRes.ok) return notFound();

	const userData = await userRes.json();
	const postData = await postRes.json();

	return (
		<AuthorPageClient
			author={userData.user}
			initialPosts={postData.posts}
		/>
	);
}

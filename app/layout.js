import Navbar from "@/app/components/Navbar";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import Footer from "@/app/components/Footer";
import { fetcher } from "./lib/fetcher";
import CategoryNav from "@/app/components/CategoryNav";
import { ThemeProvider } from "next-themes";
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react"
import { SWRConfig } from "swr";
import { ToastContainer } from "react-toastify";
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

export const metadata = {
	title: "Ore blogda - My Anime Blog",
	description: "A modern anime blog where users can post, share, and explore trending anime stories, memes, and news.",

	keywords: "anime, anime blog, anime news, anime memes, anime stories, trending anime, anime edits, oreblogda, anime votes",

	authors: [
		{ name: "Kaytee", url: "https://oreblogda.vercel.app" }
	],

	creator: "Kaytee",

	robots: "index, follow",

	// Open Graph (for social previews)
	openGraph: {
		title: "Ore blogda – My Anime Blog",
		description: "A modern anime blog where users can post, share, and explore trending anime stories, memes, and news.",
		url: "https://oreblogda.vercel.app",
		siteName: "Oreblogda",
		images: [
			{
				url: "https://oreblogda.vercel.app/og-image.png",
				width: 1200,
				height: 630,
				alt: "Ore blogda - Anime Blog",
			},
		],
		type: "website",
	},

	// Twitter card
	twitter: {
		card: "summary_large_image",
		title: "Ore blogda – My Anime Blog",
		description: "A modern anime blog where users can post, share, and explore trending anime stories, memes, and news.",
		images: ["https://oreblogda.vercel.app/og-image.png"],
		creator: "@YourTwitterHandle",
	},

	alternates: {
		canonical: "https://oreblogda.vercel.app",
	},

	icons: {
		icon: "/favicon.ico",
	},
};




export default function RootLayout({ children }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8021671365048667"
					crossorigin="anonymous"></script>
			</head>
			<body className={`antialiased ${spaceGrotesk.className} min-h-screen`}>
				{/* ✅ Only client-side hook component */}
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
					<SWRConfig value={{
						fetcher,
						refreshInterval: 0, // default no polling globally
						revalidateOnFocus: true,
						shouldRetryOnError: true,
						dedupingInterval: 2000, // cache identical requests for 2s
					}}>
						<Navbar />
						<main>
							<div className="mt-15 pt-1 bg-linear-to-br from-blue-50 via-white to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 transition-colors relative">
								<CategoryNav />
								{children}
							</div>
							<ToastContainer />
						</main>
						<Footer postsContainerId="postsContainer" />
					</SWRConfig>
				</ThemeProvider>
				<Analytics />
				<SpeedInsights />
			</body>
		</html>
	);
}

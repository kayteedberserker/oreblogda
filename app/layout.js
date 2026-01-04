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
import Adsense from "./components/Adsense";
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });

export const metadata = {
	title: "Oreblogda - My Anime Blog",
	description: "A modern anime and gaming blog where users can post, share, and explore trending anime stories, memes, news, reviews, gaming updates, trending games, community reviews on both anime and games.",

	keywords: "anime, gaming, anime blog, gaming blog, anime news, gaming news, anime memes, anime stories, trending anime, anime edits, gaming, gaming news, game updates, games, mobile games, freefire, callofduty, pubg, efootball, minecraft, amoung us, dream league soccer, oreblogda, anime votes",

	authors: [
		{ name: "Kaytee", url: "https://oreblogda.com" }
	],

	creator: "Kaytee",

	robots: "index, follow",

	// Open Graph (for social previews)
	openGraph: {
		title: "Oreblogda – My Anime Blog",
		description: "A modern anime and gaming blog where users can post, share, and explore trending anime stories, memes, news, reviews, gaming updates, trending games, community reviews on both anime and games.",
		url: "https://oreblogda.com",
		siteName: "Oreblogda",
		images: [
			{
				url: "https://oreblogda.com/ogimage.png",
				width: 1200,
				height: 630,
				alt: "Oreblogda - Anime Blog",
			},
		],
		type: "website",
	},

	// Twitter card
	twitter: {
		card: "summary_large_image",
		title: "Oreblogda – My Anime Blog",
		description: "A modern anime and gaming blog where users can post, share, and explore trending anime stories, memes, news, reviews, gaming updates, trending games, community reviews on both anime and games.",
		images: ["https://oreblogda.com/ogimage.png"],
		creator: "@oreblogda",
	},

	alternates: {
		canonical: "https://oreblogda.com",
	},

	icons: {
		icon: [
			{
				url: "/iconblue.png",
				type: "image/png",
				sizes: "96x96",
			},
		],
	},

};




export default function RootLayout({ children }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<head>
				<meta name="google-adsense-account" content="ca-pub-8021671365048667"></meta>
				<meta name="google-site-verification" content="nEJnQtr1-BvGpKFLOPz9Asxv4iJx_-j03w-obSlaedU" />
				<Adsense />
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

						<div className="mt-15 pt-1 bg-linear-to-br from-blue-50 via-white to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 transition-colors relative">
							<CategoryNav />
							<main>
								{children}
							</main>
						</div>
						<ToastContainer />
						<Footer postsContainerId="postsContainer" />
					</SWRConfig>
				</ThemeProvider>
				<Analytics />
				<SpeedInsights />
			</body>
		</html>
	);
}

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
import TesterRecruitment from "./components/TesterRecruitment";
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
			<body className="antialiased min-h-screen bg-white dark:bg-[#050505] selection:bg-blue-500 selection:text-white">
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
					<SWRConfig
						value={{
							fetcher,
							refreshInterval: 0,
							revalidateOnFocus: true,
							shouldRetryOnError: true,
							dedupingInterval: 2000,
						}}
					>
						{/* Global Navigation Hardware */}
						<Navbar />

						{/* MAIN SYSTEM CONTAINER */}
						{/* We use a relative container with a global grid overlay */}
						<div className="mt-16 relative min-h-screen flex flex-col bg-gradient-to-br from-slate-50 via-white to-blue-50 dark:from-[#0a0a0a] dark:via-[#050505] dark:to-[#0d1117] transition-colors duration-500">

							{/* --- GLOBAL NEURAL GRID OVERLAY --- */}
							{/* This pattern will now persist across every single page */}
							<div
								className="absolute inset-0 opacity-[0.03] dark:opacity-[0.1] pointer-events-none z-0"
								style={{
									backgroundImage: `linear-gradient(#2563eb 1px, transparent 1px), linear-gradient(90deg, #2563eb 1px, transparent 1px)`,
									backgroundSize: '45px 45px'
								}}
							/>

							{/* Top scanning line decoration for the header area */}
							<div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent z-10" />

							<CategoryNav />
							{/* 2. THE RECRUITMENT BLOCK (Integrated directly into the feed) */}
							<section className="px-4 py-8">
								<TesterRecruitment />
							</section>
							{/* MAIN CONTENT ENGINE */}
							<main className="relative z-10 flex-grow">
								{children}
							</main>

							<Footer postsContainerId="postsContainer" />
						</div>

						<ToastContainer
							position="bottom-right"
							autoClose={3000}
							theme="colored"
						// Optional: Add a custom font class if you have one globally for that "Anime" look
						/>
					</SWRConfig>
				</ThemeProvider>

				<Analytics />
				<SpeedInsights />
			</body>
		</html>
	);
}

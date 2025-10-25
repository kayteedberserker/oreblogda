import Navbar from "@/app/components/Navbar";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import Footer from "@/app/components/Footer";
import { fetcher } from "./lib/fetcher";
import CategoryNav from "@/app/components/CategoryNav";
import { ThemeProvider } from "next-themes";
import { SpeedInsights } from "@vercel/speed-insights/next"
import { Analytics } from "@vercel/analytics/next"
import { SWRConfig } from "swr";
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });


export const metadata = {
  title: "Oreblogda - My Anime Blog",
  description: "An anime blog for anime fans",
  openGraph: {
    title: "Oreblogda – My Anime blog",
    description:
      "A modern blog where users can post, share, and explore trending anime stories, anime memes, anime news etc.",
    url: "https://oreblogda.vercel.app",
    siteName: "Oreblogda",
    images: [
      {
        url: "https://oreblogda.vercel.app/og-image.png",
        width: 1200,
        height: 630,
        alt: "Oreblogda",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Oreblogda – My Anime blog",
    description: "A modern anime blog",
    images: ["https://oreblogda.vercel.app/og-image.png"],
  },
};



export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>

      <body className={`antialiased ${spaceGrotesk.className} `}>
        <Analytics />
        <SpeedInsights />
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
              {children}
            </div>
            <Footer />
        </SWRConfig>
          </ThemeProvider>
      </body>
    </html>
  );
}

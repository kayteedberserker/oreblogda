import SeoClient from "@/components/seoClient";
import Navbar from "@/components/Navbar";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import Footer from "./components/Footer";

const spaceGrotesk = Space_Grotesk({ subsets: ["latin"] });


export const metadata = {
  title: "Oreblogda - My Anime Blog",
  description: "An anime blog for anime fans",
};
const defaultSEOConfig = {
  titleTemplate: "%s | Oreblogda",
  defaultTitle: "Oreblogda – My Anime blog",
  description:
    "A modern blog where users can post, share, and explore trending anime stories, anime memes, anime news etc.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://yourdomain.com/",
    site_name: "Oreblogda",
    images: [
      {
        url: "https://yourdomain.com/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "Oreblogda",
      },
    ],
  },
  twitter: {
    handle: "@yourhandle",
    site: "@yourhandle",
    cardType: "summary_large_image",
  },
};


export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={`antialiased ${spaceGrotesk.className}`}>
        {/* ✅ Only client-side hook component */}
        <SeoClient config={defaultSEOConfig} />

        <Navbar />
        <div className="mt-15 pt-1 bg-linear-to-br from-blue-50 via-white to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 transition-colors relative">
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
}
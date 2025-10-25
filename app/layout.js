import Navbar from "@/app/components/Navbar";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import Footer from "@/app/components/Footer";
import CategoryNav from "@/app/components/CategoryNav";

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
        url: "https://oreblogda.vercel.app/og-image.jpg",
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
    images: ["https://oreblogda.vercel.app/og-image.jpg"],
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        {/* Inline script to set theme immediately */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const theme = localStorage.getItem('theme');
                  if(theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className={`antialiased ${spaceGrotesk.className}`}>
        <Navbar />
        <div className="mt-15 pt-1 bg-linear-to-br from-blue-50 via-white to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 transition-colors relative">
          <CategoryNav />
          {children}
        </div>
        <Footer />
      </body>
    </html>
  );
          }

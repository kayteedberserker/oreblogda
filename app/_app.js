import { useEffect } from "react";
import Head from "next/head";
import "@/styles/globals.css"; // your global styles
import { ThemeProvider } from "next-themes";

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Load TikTok embed script globally once
    const script = document.createElement("script");
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return (
    <ThemeProvider attribute="class">
      <Head>
        {/* PWA manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Theme color for browser UI */}
        <meta name="theme-color" content="#1D4ED8" />

        {/* Optional: Apple icons */}
        <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
      </Head>

      <Component {...pageProps} />
    </ThemeProvider>
  );
}

export default MyApp;

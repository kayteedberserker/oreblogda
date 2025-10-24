import { useEffect } from "react";

function MyApp({ Component, pageProps }) {
  useEffect(() => {
    // Load TikTok embed script globally once
    const script = document.createElement("script");
    script.src = "https://www.tiktok.com/embed.js";
    script.async = true;
    document.body.appendChild(script);
  }, []);

  return <Component {...pageProps} />;
}

export default MyApp;

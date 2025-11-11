"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

export default function Adsense() {
  const pathname = usePathname();

  // Pages where you don't want ads
  const noAdsPages = [
    "/auth/login",
    "/auth/signup",
    "/not-found",
    "/authordiary",
    "/contact",
    "/about",
    "/terms",
    "/privacy",
    "/authordiary/profile"
  ];

  const showAds = !noAdsPages.includes(pathname);

  if (!showAds) return null; // Don't render anything on excluded pages

  return (
    <Script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8021671365048667"
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}

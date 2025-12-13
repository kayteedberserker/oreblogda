"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

export default function Adsense() {
  const pathname = usePathname();

  // Static pages where you don't want ads
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

  // Pages that should block ads by prefix (e.g. /author/*)
  const noAdsPrefixes = [
    "/authordiary/", // blocks /author/anything
  ];

  // Check if pathname exactly matches one of the static pages
  const isExactBlocked = noAdsPages.includes(pathname);

  // Check if pathname starts with a blocked prefix
  const isPrefixBlocked = noAdsPrefixes.some(prefix =>
    pathname.startsWith(prefix)
  );

  // Final decision
  const showAds = !(isExactBlocked || isPrefixBlocked);

  if (!showAds) return null;

  return (
    <Script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8021671365048667"
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}

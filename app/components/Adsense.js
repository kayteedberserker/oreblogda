"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";

export default function Adsense() {
  const pathname = usePathname();

  // Only show ads on the homepage
  if (pathname !== "/") return null;

  return (
    <Script
      async
      src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8021671365048667"
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}

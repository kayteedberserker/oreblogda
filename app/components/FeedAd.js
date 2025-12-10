"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export default function FeedAd() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      // Ensure adsbygoogle array exists
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch (e) {
      console.error("Adsense error:", e);
    }
  }, [pathname]); // re-run whenever pathname changes

  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-format="fluid"
      data-ad-layout-key="-fl+5w+4e-db+86"
      data-ad-client="ca-pub-8021671365048667"
      data-ad-slot="9691605458"
    ></ins>
  );
}

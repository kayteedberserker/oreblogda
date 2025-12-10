"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function FeedAd() {
  const pathname = usePathname();
  const adRef = useRef(null);

  useEffect(() => {
    if (!adRef.current) return;

    // Reset so the ad can reload on pagechange
    adRef.current.dataset.loaded = "false";

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      adRef.current.dataset.loaded = "true";
    } catch (e) {
      console.error("Adsense error:", e);
    }
  }, [pathname]); // load again when navigating

  return (
    <div style={{ minWidth: "300px", minHeight:"100px" }}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-format="fluid"
        data-ad-layout-key="-fl+5w+4e-db+86"
        data-ad-client="ca-pub-8021671365048667"
        data-ad-slot="9691605458"
      ></ins>
    </div>
  );
}

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
    } catch (e) {}
  }, [pathname]); // load again when navigating

  return (
    <div style={{ minWidth: "300px", minHeight:"100px" }}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "inline-block", width: "300px", height: "90px"}}
        data-ad-format="fluid"
        data-ad-client="ca-pub-8021671365048667"
        data-ad-slot="1288851657"
      ></ins>
    </div>
  );
}

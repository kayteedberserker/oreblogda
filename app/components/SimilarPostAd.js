"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function SimilarPostAd() {
  const adRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!adRef.current) return;

    // Reset the ad slot so AdSense can reload it cleanly
    adRef.current.innerHTML = "";

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch (err) {}
  }, [pathname]); // run on first load + every route change

  return (
    <div className="flex justify-center py-2">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: "inline-block",
          width: "300px",
          height: "400px",
        }}
        data-ad-client="ca-pub-8021671365048667"
        data-ad-slot="6738246854"
      ></ins>
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";

export default function SimilarPostAd() {
  const adRef = useRef(null);

  useEffect(() => {
    if (!adRef.current) return;

    // prevent double load
    if (adRef.current.dataset.loaded === "true") return;

    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
      adRef.current.dataset.loaded = "true";
    } catch (err) {
      console.log("AdSense error:", err);
    }
  }, []);

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

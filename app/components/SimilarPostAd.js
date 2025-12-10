"use client";

import { useEffect } from "react";

export default function SimilarPostAd() {
  useEffect(() => {
    try {
      if (window.adsbygoogle) {
        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      }
    } catch (err) {
      console.error("Adsense error:", err);
    }
  }, []);

  return (
    <div style={{ maxHeight: "500px" }}>
      <ins
        className="adsbygoogle"
        style={{ display: "block" }}
        data-ad-client="ca-pub-8021671365048667"
        data-ad-slot="6738246854"
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
}

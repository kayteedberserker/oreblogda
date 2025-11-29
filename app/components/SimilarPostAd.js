"use client";

import { useEffect } from "react";

export default function SimilarPostAd() {
  useEffect(() => {
    try {
      if (window.adsbygoogle) {
        (adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (err) {
      console.error("Adsense error:", err);
    }
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={{ display: "inline-block", width: "210px", height: "430px" }}
      data-ad-client="ca-pub-8021671365048667"
      data-ad-slot="5936193275"
    ></ins>
  );
}

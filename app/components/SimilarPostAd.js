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
<ins class="adsbygoogle"
     style={{display: "block"}}
     data-ad-client="ca-pub-8021671365048667"
     data-ad-slot="6738246854"
     data-ad-format="auto"
     data-full-width-responsive="true"></ins>
  );
}

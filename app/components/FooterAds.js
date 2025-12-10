"use client";
import { useEffect } from "react";

export default function FooterAds() {
  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      }
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, []);

  return (
    <div className=" flex mb-2.5 justify-center w-full">
        <ins class="adsbygoogle"
     style={{display: "inline-block", width: "300px", height: "200px"}}
     data-ad-client="ca-pub-8021671365048667"
     data-ad-slot="9897041432"></ins>
    </div>
  );
}

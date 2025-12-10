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
    
        <div className="max-h-[200px]">
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client="ca-pub-8021671365048667"
      data-ad-slot="9897041432"
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
    </div>
  );
}

"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function AuthorPageAd() {
  const adRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    if (!adRef.current) return;

    // reset when route changes so AdSense can refill
    adRef.current.innerHTML = "";
    delete adRef.current.dataset.adStatus;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch (err) {
      console.warn("AdSense AuthorPageAd error:", err);
    }
  }, [pathname]); // re-run on page navigation

  return (
    <div className="w-full flex justify-center my-4">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "block", width: "100%" }}
        data-ad-client="ca-pub-8021671365048667"
        data-ad-slot="8822410097"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}

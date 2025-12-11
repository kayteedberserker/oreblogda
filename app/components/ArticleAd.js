"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function ArticleAd() {
  const pathname = usePathname();
  const adRef = useRef(null);

  useEffect(() => {
    if (!adRef.current) return;

    // reset load state on route change
    adRef.current.dataset.loaded = "false";

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
      adRef.current.dataset.loaded = "true";
    } catch (e) {}
  }, [pathname]);

  return (
    <ins
      ref={adRef}
      className="adsbygoogle"
      style={{
        display: "block",
        textAlign: "center",
      }}
      data-ad-layout="in-article"
      data-ad-format="fluid"
      data-ad-client="ca-pub-8021671365048667"
      data-ad-slot="7363888575"
    ></ins>
  );
}

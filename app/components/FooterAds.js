"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function FooterAds() {
  const adRef = useRef(null); // <--- Add this
  const pathname = usePathname();

  useEffect(() => {
    if (!adRef.current) return;

    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch (e) {}
  }, [pathname]);

  return (
    <div className="flex mb-2.5 justify-center w-full">
      <ins
        ref={adRef} // now valid
        className="adsbygoogle"
        style={{ display: "inline-block", width: "300px", height: "200px" }}
        data-ad-client="ca-pub-8021671365048667"
        data-ad-slot="9897041432"
      ></ins>
    </div>
  );
}

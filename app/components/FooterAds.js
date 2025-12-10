"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

export default function FooterAds() {
  const pathname = usePathname();
  const adRef = useRef<HTMLModElement | null>(null);

  useEffect(() => {
    try {
      if (typeof window !== "undefined") {
        // Reset the ad container so AdSense can load again on every route
        if (adRef.current) {
          adRef.current.innerHTML = "";
        }

        window.adsbygoogle = window.adsbygoogle || [];
        window.adsbygoogle.push({});
      }
    } catch (e) {
      console.error("AdSense error:", e);
    }
  }, [pathname]); // runs immediately on load + on route change

  return (
    <div className="flex mb-2.5 justify-center w-full">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: "inline-block", width: "300px", height: "200px" }}
        data-ad-client="ca-pub-8021671365048667"
        data-ad-slot="9897041432"
      ></ins>
    </div>
  );
          }

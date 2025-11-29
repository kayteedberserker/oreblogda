"use client";
import { useEffect } from "react";

export default function FooterAd() {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {}
  }, []);

  return (
 
      <ins class="adsbygoogle"
     style="display:inline-block;width:400px;height:50px"
     data-ad-client="ca-pub-8021671365048667"
     data-ad-slot="6738246854"></ins>
  );
}

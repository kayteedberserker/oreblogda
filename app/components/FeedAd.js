import { useEffect } from "react";

export default function FeedAd() {
  useEffect(() => {
    try {
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {
      // ignore AdSense errors to avoid crashes
    }
  }, []);

  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-format="fluid"
      data-ad-layout-key="-fl+5w+4e-db+86"
      data-ad-client="ca-pub-8021671365048667"
      data-ad-slot="9691605458"
    ></ins>
  );
}

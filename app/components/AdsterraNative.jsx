// components/AdsterraNative.jsx
import { useEffect } from "react";

export default function AdsterraNative() {
  useEffect(() => {
    // prevent duplicate script injection
    if (document.getElementById("adsterra-native-script")) return;

    const script = document.createElement("script");
    script.id = "adsterra-native-script";
    script.async = true;
    script.setAttribute("data-cfasync", "false");
    script.src =
      "https://pl28321415.effectivegatecpm.com/9740100d8b85e3ff6f266e16a7d43c32/invoke.js";

    document.body.appendChild(script);
  }, []);

  return (
    <div
      className="my-6"
      id="container-9740100d8b85e3ff6f266e16a7d43c32"
    />
  );
}

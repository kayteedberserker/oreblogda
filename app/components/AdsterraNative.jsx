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
      "https://pl28313019.effectivegatecpm.com/6452f17517ce377b3db19dc7ffef8407/invoke.js";

    document.body.appendChild(script);
  }, []);

  return (
    <div
      className="my-6"
      id="container-6452f17517ce377b3db19dc7ffef8407"
    />
  );
}

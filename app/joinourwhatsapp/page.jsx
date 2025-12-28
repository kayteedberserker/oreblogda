"use client";
import { useEffect } from "react";

export default function JoinWhatsApp() {
  const channelLink = "https://whatsapp.com/channel/0029VbBkiupCRs1wXFWtDG3N";

  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = channelLink;
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="min-h-screen grid place-items-center text-center px-4">
      <div>
        <h1 className="text-2xl font-bold mb-3">
          Redirecting to WhatsApp…
        </h1>
        <p className="text-gray-600 mb-4">
          You’ll be redirected to our WhatsApp Channel shortly.
        </p>

        <a
          href={channelLink}
          className="text-green-600 underline font-medium"
        >
          Click here if you’re not redirected
        </a>
      </div>
    </main>
  );
}

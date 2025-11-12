"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";

export default function Footer({ postsContainerId }) {
  const pathname = usePathname();
  const hideNavbarRoutes = ["/auth/login", "/auth/signup"];
  if (hideNavbarRoutes.includes(pathname)) return null;

  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const { systemTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  // Show back-to-top button
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    setMounted(true);

    const handleScroll = () => {
      const windowScroll = window.scrollY;
      let postsScroll = 0;
      if (postsContainerId) {
        const container = document.getElementById(postsContainerId);
        if (container) postsScroll = container.scrollTop;
      }
      // Show button if either scroll is > 300px
      setShowBackToTop(windowScroll > 300 || postsScroll > 300);
    };

    // Listen to window scroll
    window.addEventListener("scroll", handleScroll);

    // Listen to posts container scroll if exists
    let container;
    if (postsContainerId) {
      container = document.getElementById(postsContainerId);
      container?.addEventListener("scroll", handleScroll);
    }

    return () => {
      window.removeEventListener("scroll", handleScroll);
      container?.removeEventListener("scroll", handleScroll);
    };
  }, [postsContainerId]);

  if (!mounted) return null;

  const scrollToTop = () => {
    // Scroll window
    window.scrollTo({ top: 0, behavior: "smooth" });
    // Scroll posts container
    if (postsContainerId) {
      const container = document.getElementById(postsContainerId);
      if (container) container.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();
      if (res.ok) {
        setMessage("Subscribed successfully!");
        setEmail("");
      } else {
        setMessage(data.error || "Something went wrong.");
      }
    } catch (err) {
      setMessage("Failed to subscribe.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <footer
      className={`py-10 relative transition-colors flex flex-col duration-300 ${
        systemTheme === "dark" ? "bg-gray-900 text-gray-100" : "bg-gray-100 text-gray-900"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 grow sm:px-6 lg:px-8">
        {/* Newsletter Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center mb-8"
        >
          <h3 className="text-2xl font-bold mb-2">Subscribe to our Newsletter</h3>
          <p className={systemTheme === "dark" ? "text-gray-400 mb-4" : "text-gray-700 mb-4"}>
            Get updates when we post new content!
          </p>
          <form
            onSubmit={handleSubscribe}
            className="flex flex-col sm:flex-row justify-center items-center gap-2"
          >
            <input
              type="email"
              placeholder="Your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`p-2 border shadow rounded-md w-full sm:w-auto flex-1 transition-colors duration-300 ${
                systemTheme === "dark"
                  ? "bg-gray-800 text-gray-100 border-gray-700"
                  : "bg-white text-gray-900 border-gray-300"
              }`}
              required
            />
            <button
              aria-label="Subscribe"
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-md font-semibold text-white"
            >
              {loading ? "Subscribing..." : "Subscribe"}
            </button>
          </form>
          {message && (
            <p className={systemTheme === "dark" ? "mt-2 text-green-400" : "mt-2 text-green-600"}>
              {message}
            </p>
          )}
        </motion.div>

        {/* Socials */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className={`flex justify-center gap-3 mb-6 transition-colors duration-300 ${
            systemTheme === "dark" ? "text-gray-400" : "text-gray-600"
          }`}
        >
          <a href="https://x.com/oreblogda" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500">
            Twitter
          </a>
          <a href="https://www.instagram.com/oreblogda/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500">
            Instagram
          </a>
          <a href="https://whatsapp.com/channel/0029VbBkiupCRs1wXFWtDG3N" target="_blank" rel="noopener noreferrer" className="hover:text-blue-500">
            Whatsapp
          </a>
          <a
            href="https://web.facebook.com/profile.php?id=61582505145912"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-blue-500"
          >
            Facebook
          </a>
        </motion.div>

        {/* Legal & Copyright */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.5 }}
          className={`flex flex-col sm:flex-row justify-between items-center text-sm transition-colors duration-300 ${
            systemTheme === "dark" ? "text-gray-500" : "text-gray-700"
          }`}
        >
          <div className="mb-2 sm:mb-0">
            <a href="/terms" className="hover:text-blue-500 mr-4">
              Terms & Conditions
            </a>
            <a href="/privacy" className="hover:text-blue-500">
              Privacy Policy
            </a>
          </div>
          <div>&copy; {new Date().getFullYear()} Oreblogda. All rights reserved.</div>
        </motion.div>
      </div>

      {/* Back to top */}
      {showBackToTop && (
        <button
          aria-label="Go to top"
          onClick={scrollToTop}
          className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 hover:cursor-pointer text-white p-3 w-10 h-10 text-2xl flex items-center justify-center rounded-full shadow-lg transition-opacity duration-300"
        >
          ↑
        </button>
      )}
    </footer>
  );
}

"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import Image from "next/image";

const FeedAd = dynamic(() => import("./FeedAd"), {
  ssr: false,
});
export default function Footer({ postsContainerId }) {

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
      className={`py-12 relative transition-colors flex flex-col duration-500 overflow-hidden border-t border-gray-100 dark:border-blue-900/20 ${
        systemTheme === "dark" ? "bg-[#050505] text-gray-100" : "bg-gray-50 text-gray-900"
      }`}
    >
      {/* --- DECORATIVE HUD ELEMENTS --- */}
      <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-500/50 to-transparent" />
      <div className="absolute top-0 left-1/4 w-[1px] h-full bg-blue-500/5 pointer-events-none" />
      <div className="absolute top-0 right-1/4 w-[1px] h-full bg-blue-500/5 pointer-events-none" />

      <div className="max-w-7xl mx-auto px-4 grow sm:px-6 lg:px-8 relative z-10">
        <div className="my-10 w-full p-4 border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl flex justify-center bg-gray-50/50 dark:bg-white/5">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">Sponsored Transmission</span>
                       <FeedAd /> 
                  </div>
        {/* Newsletter Section */}
        <div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 mb-3">
             <div className="w-1 h-1 bg-blue-600 rounded-full animate-ping" />
             <span className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600">Sync Signal</span>
          </div>
          
          <h3 className="text-3xl font-black italic uppercase tracking-tighter mb-2">
            Stay Connected
          </h3>
          <p className={`text-xs font-bold uppercase tracking-widest mb-6 ${systemTheme === "dark" ? "text-gray-500" : "text-gray-400"}`}>
            Receive direct intelligence updates
          </p>

          <form
            onSubmit={handleSubscribe}
            className="flex flex-col sm:flex-row justify-center items-stretch gap-0 max-w-md mx-auto group"
          >
            <input
              type="email"
              placeholder="TERMINAL@USER.COM"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={`p-4 border-2 shadow-none rounded-t-xl sm:rounded-l-xl sm:rounded-tr-none w-full flex-1 transition-all outline-none text-xs font-black tracking-widest uppercase ${
                systemTheme === "dark"
                  ? "bg-gray-900/50 border-gray-800 focus:border-blue-600 focus:bg-gray-900"
                  : "bg-white border-gray-200 focus:border-blue-600"
              }`}
              required
            />
            <button
              aria-label="Subscribe"
              type="submit"
              disabled={loading}
              className="relative px-8 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black uppercase italic tracking-widest text-xs transition-all overflow-hidden rounded-b-xl sm:rounded-r-xl sm:rounded-bl-none"
            >
              {loading ? (
                /* LOADING ANIMATION per instructions */
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Syncing...</span>
                </div>
              ) : (
                "Link Intel"
              )}
              {/* Button Glitch Effect on Hover */}
              <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
            </button>
          </form>

          {message && (
            <motion.p 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }}
              className={`mt-4 text-[10px] font-black uppercase tracking-widest ${systemTheme === "dark" ? "text-blue-400" : "text-blue-600"}`}
            >
              {`> ${message}`}
            </motion.p>
          )}
        </div>
<div className="my-10 w-full p-4 border border-dashed border-gray-200 dark:border-gray-800 rounded-3xl flex justify-center bg-gray-50/50 dark:bg-white/5">
                      <span className="text-[9px] font-bold text-gray-400 uppercase tracking-widest italic">Sponsored Transmission</span>
                       <FeedAd /> 
                  </div>
        {/* Social Links HUD */}
        <div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="flex flex-wrap justify-center gap-6 mb-10"
        >
          {['Twitter', 'Instagram', 'Whatsapp', 'Facebook'].map((platform) => (
            <a 
              key={platform}
              href={platform === 'Twitter' ? 'https://x.com/oreblogda' : platform === 'Instagram' ? 'https://www.instagram.com/oreblogda/' : platform === 'Whatsapp' ? 'https://whatsapp.com/channel/0029VbBkiupCRs1wXFWtDG3N' : 'https://web.facebook.com/profile.php?id=61582505145912'}
              target="_blank" 
              rel="noopener noreferrer" 
              className="text-[10px] font-black uppercase tracking-[0.2em] hover:text-blue-500 transition-colors border-b border-transparent hover:border-blue-500 pb-1"
            >
              {platform}
            </a>
          ))}
        </div>

        {/* Legal & Copyright System Info */}
        <div
          className={`flex flex-col sm:flex-row justify-between items-center text-[10px] font-bold uppercase tracking-widest pt-8 border-t border-gray-100 dark:border-gray-800 ${
            systemTheme === "dark" ? "text-gray-600" : "text-gray-400"
          }`}
        >
          <div className="mb-4 sm:mb-0 space-x-6">
            <a href="/terms" className="hover:text-blue-500 transition-colors">Terms_Conditions</a>
            <a href="/privacy" className="hover:text-blue-500 transition-colors">Privacy_Policy</a>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span>&copy; {new Date().getFullYear()} OREBLOGDA.SYS_V4.0</span>
          </div>
        </div>
      </div>

      {/* --- FIXED HARDWARE BUTTONS --- */}
      
      {/* Whatsapp Floating Button */}
      <a 
        href="https://whatsapp.com/channel/0029VbBkiupCRs1wXFWtDG3N" 
        target="_blank" 
        rel="noopener noreferrer"
        aria-label="Whatsapp"
        className="fixed bottom-18 right-4 md:right-8 group z-40 transition-transform active:scale-90"
      >
        <div className="relative w-12 h-12 flex items-center justify-center bg-white dark:bg-gray-900 rounded-full shadow-2xl border border-gray-100 dark:border-gray-800">
          <Image fill priority src="/whatsapp.png" alt="WA" className="w-10 h-10 rounded-full" />
          <div className="absolute -inset-1 bg-green-500/20 rounded-full animate-ping pointer-events-none" />
        </div>
      </a>

      {/* Back to top - Tactical Version */}
      {showBackToTop && (
        <button
          aria-label="Go to top"
          onClick={scrollToTop}
          className="fixed bottom-6 right-4 md:right-8 z-40 bg-blue-600 text-white w-12 h-12 flex items-center justify-center rounded-xl shadow-2xl hover:bg-blue-700 transition-all active:scale-90 border-b-4 border-blue-800"
        >
          <span className="font-black text-xl">↑</span>
        </button>
      )}

      <style jsx>{`
        footer {
          background-image: radial-gradient(circle at 50% 100%, rgba(37, 99, 235, 0.05), transparent 50%);
        }
      `}</style>
    </footer>
  );
}

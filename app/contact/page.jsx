"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";


export const metadata = {
	title: "Contact Oreblogda – Get in Touch",
	description:
		"Contact Oreblogda to send feedback, bug reports, collaboration requests, or general inquiries.",

	keywords:
		"contact oreblogda, anime blog contact, gaming blog contact, oreblogda support",

	authors: [
		{ name: "Kaytee", url: "https://oreblogda.com" }
	],

	creator: "Kaytee",

	robots: "index, follow",

	openGraph: {
		title: "Contact Oreblogda – Get in Touch",
		description:
			"Send feedback, bug reports, collaboration requests, or general messages to Oreblogda.",
		url: "https://oreblogda.com/contact",
		siteName: "Oreblogda",
		images: [
			{
				url: "https://oreblogda.com/ogimage.png",
				width: 1200,
				height: 630,
				alt: "Contact Oreblogda",
			},
		],
		type: "website",
	},

	twitter: {
		card: "summary_large_image",
		title: "Contact Oreblogda – Get in Touch",
		description:
			"Send feedback, bug reports, collaboration requests, or general messages to Oreblogda.",
		images: ["https://oreblogda.com/ogimage.png"],
		creator: "@oreblogda",
	},

	alternates: {
		canonical: "https://oreblogda.com/contact",
	},
};


export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "", type: "General" });
  const [status, setStatus] = useState({ loading: false, success: "", error: "" });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, success: "", error: "" });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus({ loading: false, success: "Transmission successful. Intel received.", error: "" });
        setForm({ name: "", email: "", message: "", type: "General" });
      } else {
        setStatus({ loading: false, success: "", error: data.error || "Uplink failed. Check connection." });
      }
    } catch (err) {
      setStatus({ loading: false, success: "", error: "Signal lost. Network error." });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-20 relative overflow-hidden">
      
      {/* --- BACKGROUND HUD ELEMENTS --- */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[140px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[140px] animate-pulse pointer-events-none" />

      <div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5 }}
        className="max-w-2xl w-full bg-white/40 dark:bg-black/60 backdrop-blur-2xl p-8 md:p-12 rounded-3xl border border-gray-200 dark:border-blue-900/30 shadow-2xl z-10 relative"
      >
        {/* --- DECORATIVE BRACKETS --- */}
        <div className="absolute top-6 left-6 w-8 h-8 border-t-2 border-l-2 border-blue-600/30 rounded-tl-lg" />
        <div className="absolute bottom-6 right-6 w-8 h-8 border-b-2 border-r-2 border-blue-600/30 rounded-br-lg" />

        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 mb-2">
            <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-600">Uplink_Console</span>
          </div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">
            Establish <span className="text-blue-600 text-shadow-glow">Contact</span>
          </h1>
          <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-gray-400 mt-2">
            Send intel directly to our headquarters
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            <div className="relative">
              <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 text-blue-600 ml-1">Identity_Name</label>
              <input
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                required
                placeholder="USER_NAME"
                className="w-full px-4 py-3 rounded-xl border-2 dark:border-gray-800 dark:bg-gray-950/50 dark:text-white focus:border-blue-600 outline-none transition-all text-xs font-bold tracking-widest"
              />
            </div>
            <div className="relative">
              <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 text-blue-600 ml-1">Comms_Link</label>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
                placeholder="USER@DOMAIN.COM"
                className="w-full px-4 py-3 rounded-xl border-2 dark:border-gray-800 dark:bg-gray-950/50 dark:text-white focus:border-blue-600 outline-none transition-all text-xs font-bold tracking-widest"
              />
            </div>
          </div>

          <div className="relative">
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 text-blue-600 ml-1">Transmission_Type</label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full px-4 py-3 rounded-xl border-2 dark:border-gray-800 dark:bg-gray-950/50 dark:text-white focus:border-blue-600 outline-none transition-all text-xs font-bold tracking-widest appearance-none cursor-pointer"
            >
              <option>General</option>
              <option>Community Join Request</option>
              <option>Bug Report</option>
              <option>Suggestion</option>
              <option>Request Account Removal</option>
              <option>Request Account Recovery</option>
              <option>Collaboration</option>
            </select>
            <div className="absolute right-4 bottom-3.5 pointer-events-none text-blue-600">▼</div>
          </div>

          <div className="relative">
            <label className="block text-[10px] font-black uppercase tracking-widest mb-1.5 text-blue-600 ml-1">Intel_Packet</label>
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              required
              rows={5}
              placeholder="ENTER MESSAGE CONTENT..."
              className="w-full px-4 py-3 rounded-xl border-2 dark:border-gray-800 dark:bg-gray-950/50 dark:text-white focus:border-blue-600 outline-none transition-all text-xs font-bold tracking-widest resize-none"
            />
          </div>

          <button
            aria-label="Send message"
            type="submit"
            disabled={status.loading}
            className="w-full relative overflow-hidden group py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all shadow-lg shadow-blue-600/20 active:scale-95"
          >
            {/* LOADING ANIMATION per instructions */}
            <AnimatePresence mode="wait">
              {status.loading ? (
                <div 
                  key="loading"
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  exit={{ opacity: 0 }}
                  className="flex items-center justify-center gap-3"
                >
                  <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                  <span className="text-xs font-black uppercase tracking-[0.2em]">Transmitting...</span>
                </div>
              ) : (
                <div 
                  key="idle"
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }}
                  className="font-black uppercase italic tracking-[0.2em] text-sm"
                >
                  Initiate Uplink
                </div>
              )}
            </AnimatePresence>

            {/* Hover Glitch Effect */}
            <div className="absolute inset-0 bg-white/10 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-500 skew-x-12" />
          </button>

          {/* STATUS MESSAGES AS TERMINAL LOGS */}
          <AnimatePresence>
            {(status.success || status.error) && (
              <div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className={`p-3 rounded-lg font-mono text-[10px] border ${
                  status.success 
                    ? "bg-green-500/5 border-green-500/30 text-green-500" 
                    : "bg-red-500/5 border-red-500/30 text-red-500"
                }`}
              >
                &gt; {status.success || status.error}
              </div>
            )}
          </AnimatePresence>
        </form>
      </div>

      {/* Background Status Tag */}
      <div className="absolute bottom-10 right-10 hidden md:block opacity-20">
        <p className="text-[10px] font-mono text-gray-500 dark:text-blue-400">SESSION_ID: {Math.random().toString(16).slice(2, 10).toUpperCase()}</p>
        <p className="text-[10px] font-mono text-gray-500 dark:text-blue-400 text-right">ENCRYPTION: AES-256</p>
      </div>
    </div>
  );
}
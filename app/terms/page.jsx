"use client";
import React from "react";
import { motion } from "framer-motion";

export const metadata = {
	title: "Terms & Conditions – Oreblogda",
	description:
		"Read Oreblogda’s Terms & Conditions covering content usage, user conduct, and platform rules.",

	keywords:
		"oreblogda terms and conditions, anime blog terms, gaming blog terms",

	authors: [
		{ name: "Kaytee", url: "https://oreblogda.com" }
	],

	creator: "Kaytee",

	robots: "index, follow",

	openGraph: {
		title: "Terms & Conditions – Oreblogda",
		description:
			"Understand the rules and conditions governing the use of Oreblogda.",
		url: "https://oreblogda.com/terms",
		siteName: "Oreblogda",
		images: [
			{
				url: "https://oreblogda.com/ogimage.png",
				width: 1200,
				height: 630,
				alt: "Oreblogda Terms and Conditions",
			},
		],
		type: "article",
	},

	twitter: {
		card: "summary_large_image",
		title: "Terms & Conditions – Oreblogda",
		description:
			"Understand the rules and conditions governing the use of Oreblogda.",
		images: ["https://oreblogda.com/ogimage.png"],
		creator: "@oreblogda",
	},

	alternates: {
		canonical: "https://oreblogda.com/terms",
	},
};


const TermsAndConditions = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-20 relative overflow-hidden">
      
      {/* --- BACKGROUND ATMOSPHERE --- */}
      {/* Neural grid logic from layout will show through, but we add local glows */}
      <div className="absolute top-20 right-[-10%] w-72 h-72 bg-blue-600/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-20 left-[-10%] w-72 h-72 bg-indigo-600/10 rounded-full blur-[120px] animate-pulse" />

      <div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-4xl w-full bg-white/40 dark:bg-black/40 backdrop-blur-xl border border-gray-200 dark:border-blue-900/30 rounded-3xl p-8 md:p-12 shadow-2xl relative z-10"
      >
        {/* --- HEADER HUD --- */}
        <div className="relative mb-12 border-b border-gray-100 dark:border-gray-800 pb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-2 w-2 bg-blue-600 rounded-full animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-600">Protocol_Agreement</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white">
            Terms <span className="text-blue-600">&</span> Conditions
          </h1>
          
          {/* Custom Loading Bar per instructions - representing "System Verification" */}
          <div className="absolute -bottom-[1px] left-0 w-full h-[2px] bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full bg-blue-600 animate-[loading_3s_infinite] w-1/3" />
          </div>
        </div>

        <div className="grid md:grid-cols-[1fr_2fr] gap-10">
          {/* Sidebar Status */}
          <div className="hidden md:block border-r border-gray-100 dark:border-gray-800 pr-8">
            <div className="sticky top-24 space-y-6">
              <div>
                <p className="text-[10px] font-black uppercase text-blue-600 mb-1">Last Update</p>
                <p className="text-sm font-mono text-gray-500">2026.01.04_VER_4.0</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-blue-600 mb-1">Authority</p>
                <p className="text-sm font-mono text-gray-500">OREBLOGDA.SYS</p>
              </div>
              <div className="pt-4">
                <div className="p-3 bg-blue-600/5 rounded-xl border border-blue-600/10">
                   <p className="text-[9px] leading-relaxed font-medium text-gray-500 dark:text-gray-400 italic">
                     "By proceeding, you acknowledge that your neural link with this sector is governed by these parameters."
                   </p>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-10">
            <section className="group">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-xs font-black text-blue-600 font-mono">01</span>
                <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">Content & Use</h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                All posts, articles, and media on <span className="text-blue-600 font-bold">Oreblogda</span> are for entertainment and informational purposes only.  
                Please enjoy, share, and discuss — but do not copy or repost our intelligence without proper encryption credit.
              </p>
            </section>

            <section className="group">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-xs font-black text-blue-600 font-mono">02</span>
                <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">User Conduct</h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                Be respectful when engaging with the data feed.  
                We do not tolerate spam, hate speech, or harmful behavior. Violating this will result in immediate <span className="text-red-500 font-bold">Sector De-authorization</span> (account removal).
              </p>
            </section>

            <section className="group">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-xs font-black text-blue-600 font-mono">03</span>
                <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">External Links</h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                Sometimes we share links to other websites or anime sources.  
                We are not responsible for their content or privacy practices — navigate external nodes responsibly.
              </p>
            </section>

            <section className="group">
              <div className="flex items-center gap-4 mb-3">
                <span className="text-xs font-black text-blue-600 font-mono">04</span>
                <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white group-hover:text-blue-500 transition-colors">Updates</h2>
              </div>
              <p className="text-gray-600 dark:text-gray-400 leading-relaxed text-sm">
                These terms might change occasionally as the Oreblogda network expands.  
                The latest system version will always be available at this coordinate.
              </p>
            </section>

            <div className="pt-8 border-t border-gray-100 dark:border-gray-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">Inquiries</p>
              <a 
                href="mailto:oreblogda@gmail.com" 
                className="text-lg font-black text-blue-600 hover:underline underline-offset-4 decoration-2"
              >
                oreblogda@gmail.com
              </a>
            </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(300%); }
        }
      `}</style>
    </div>
  );
};

export default TermsAndConditions;
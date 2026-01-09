"use client";
import React from "react";
import { motion } from "framer-motion";
// export const metadata = {
// 	title: "About Oreblogda – Anime, Gaming & Pop Culture Hub",
// 	description:
// 		"Learn more about Oreblogda — your chill corner for anime, gaming, and pop culture. Episode breakdowns, game updates, and fan-first content.",

// 	keywords:
// 		"about oreblogda, anime blog, gaming blog, anime news, gaming updates, pop culture, oreblogda",

// 	authors: [
// 		{ name: "Kaytee", url: "https://oreblogda.com" }
// 	],

// 	creator: "Kaytee",

// 	robots: "index, follow",

// 	openGraph: {
// 		title: "About Oreblogda – Anime, Gaming & Pop Culture Hub",
// 		description:
// 			"Learn more about Oreblogda — your chill corner for anime, gaming, and pop culture.",
// 		url: "https://oreblogda.com/about",
// 		siteName: "Oreblogda",
// 		images: [
// 			{
// 				url: "https://oreblogda.com/ogimage.png",
// 				width: 1200,
// 				height: 630,
// 				alt: "About Oreblogda",
// 			},
// 		],
// 		type: "website",
// 	},

// 	twitter: {
// 		card: "summary_large_image",
// 		title: "About Oreblogda – Anime, Gaming & Pop Culture Hub",
// 		description:
// 			"Learn more about Oreblogda — your chill corner for anime, gaming, and pop culture.",
// 		images: ["https://oreblogda.com/ogimage.png"],
// 		creator: "@oreblogda",
// 	},

// 	alternates: {
// 		canonical: "https://oreblogda.com/about",
// 	},
// };


const AboutPage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-20 relative overflow-hidden">
      
      {/* --- BACKGROUND ATMOSPHERE --- */}
      <div className="absolute top-20 right-[-5%] w-96 h-96 bg-blue-600/10 rounded-full blur-[140px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-20 left-[-5%] w-96 h-96 bg-indigo-600/10 rounded-full blur-[140px] animate-pulse pointer-events-none" />

      <div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7 }}
        className="max-w-4xl w-full bg-white/40 dark:bg-black/60 backdrop-blur-2xl border border-gray-200 dark:border-blue-900/30 rounded-3xl p-8 md:p-16 shadow-2xl relative z-10 overflow-hidden"
      >
        {/* --- HEADER HUD --- */}
        <div className="relative mb-12 border-b border-gray-100 dark:border-gray-800 pb-8 text-center">
          <div className="flex justify-center items-center gap-3 mb-4">
            <div className="h-1.5 w-1.5 bg-blue-600 rounded-full animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-600">Core_Manifest_v4.0</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white">
            About <span className="text-blue-600 underline decoration-blue-600/20 underline-offset-8">Oreblogda</span>
          </h1>

          {/* Loading Animation per instructions - "System Calibration" */}
          <div className="absolute -bottom-[1px] left-0 w-full h-[2px] bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full bg-blue-600 animate-[loading_5s_infinite] w-1/4" />
          </div>
        </div>

        {/* --- CONTENT GRID --- */}
        <div className="space-y-12 text-center md:text-left">
          
          {/* Section 01: The Chill Corner */}
          <div className="grid md:grid-cols-[100px_1fr] gap-4 items-start">
            <span className="hidden md:block text-xs font-black text-blue-600/40 font-mono mt-2 tracking-tighter">DATA_01</span>
            <div>
              <p className="text-lg md:text-xl font-bold leading-relaxed text-gray-800 dark:text-gray-200">
                Welcome to <span className="text-blue-600 italic">Oreblogda</span> — your chill corner for everything anime, gaming, and pop culture. 
                From episode breakdowns to game updates, we cover what fans actually care about.
              </p>
            </div>
          </div>

          {/* Section 02: The Mission */}
          <div className="grid md:grid-cols-[100px_1fr] gap-4 items-start">
            <span className="hidden md:block text-xs font-black text-blue-600/40 font-mono mt-2 tracking-tighter">DATA_02</span>
            <div className="p-6 bg-blue-600/5 border-l-2 border-blue-600 rounded-r-2xl">
              <p className="text-md leading-relaxed text-gray-700 dark:text-gray-300 italic">
                Whether you’re grinding ranked matches, exploring open worlds, or hyped for the next anime drop — you’re in the right place. 
                Our goal is simple: <span className="font-black uppercase text-blue-600 dark:text-blue-400">Keep things fun, honest, and worth your scroll.</span>
              </p>
            </div>
          </div>

          {/* Section 03: Fans First */}
          <div className="grid md:grid-cols-[100px_1fr] gap-4 items-start">
            <span className="hidden md:block text-xs font-black text-blue-600/40 font-mono mt-2 tracking-tighter">DATA_03</span>
            <div>
              <p className="text-lg leading-relaxed text-gray-700 dark:text-gray-300">
                We’re fans first — writers second. So grab your controller 🕹️, queue the next episode 🍿, and join the Oreblogda community. 
                Stay updated, stay competitive, and never miss a drop.
              </p>
            </div>
          </div>

        </div>

        {/* --- FOOTER STATUS --- */}
        <div className="mt-16 pt-8 border-t border-gray-100 dark:border-gray-800 flex flex-col md:flex-row justify-between items-center gap-4">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-gray-400">System_Status: Optimal</span>
           </div>
           <div className="flex gap-6">
              <div className="text-[9px] font-mono text-gray-500 uppercase">Sector: Lagos_Nigeria</div>
              <div className="text-[9px] font-mono text-gray-500 uppercase">Node: Global_Fanbase</div>
           </div>
        </div>
      </div>

      {/* Decorative Floating Elements */}
      <div className="absolute top-1/4 right-10 text-[60px] font-black text-blue-500/5 select-none pointer-events-none italic">
        ANIME
      </div>
      <div className="absolute bottom-1/4 left-10 text-[60px] font-black text-blue-500/5 select-none pointer-events-none italic">
        GAMING
      </div>

      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}</style>
    </div>
  );
};

export default AboutPage;
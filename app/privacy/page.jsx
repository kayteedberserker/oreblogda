"use client";
import React from "react";
import { motion } from "framer-motion";

const PrivacyPolicy = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-20 relative overflow-hidden">
      
      {/* --- BACKGROUND ATMOSPHERE --- */}
      <div className="absolute top-20 left-[-5%] w-80 h-80 bg-blue-600/10 rounded-full blur-[130px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-20 right-[-5%] w-80 h-80 bg-blue-400/10 rounded-full blur-[130px] animate-pulse pointer-events-none" />

      <div 
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-4xl w-full bg-white/40 dark:bg-black/60 backdrop-blur-2xl border border-gray-200 dark:border-blue-900/30 rounded-3xl p-8 md:p-12 shadow-2xl relative z-10"
      >
        {/* --- HEADER HUD --- */}
        <div className="relative mb-12 border-b border-gray-100 dark:border-gray-800 pb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-2 w-2 bg-blue-600 rounded-full animate-ping" />
            <span className="text-[10px] font-black uppercase tracking-[0.5em] text-blue-600">Privacy_Encryption_Standard</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white">
            Privacy <span className="text-blue-600">Policy</span>
          </h1>
          <p className="text-[10px] font-mono text-gray-500 mt-2 uppercase tracking-widest">
            Last Link Update: January 2026 // Ver 4.0.1
          </p>
          
          {/* Custom Loading Bar for "Privacy Verification" */}
          <div className="absolute -bottom-[1px] left-0 w-full h-[2px] bg-gray-100 dark:bg-gray-800 overflow-hidden">
            <div className="h-full bg-blue-600 animate-[loading_4s_infinite] w-1/4" />
          </div>
        </div>

        <div className="space-y-12">
          {/* Intro Section */}
          <section>
            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
              Welcome to <span className="font-black italic text-blue-600">Oreblogda</span>.  
              Your privacy is treated as a high-clearance priority. This protocol explains how we collect, use, and shield your data within our web and Android nodes.
            </p>
          </section>

          {/* 1. Information Collection */}
          <section className="group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-8 h-[1px] bg-blue-600" />
              <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">01. Data Acquisition</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <h4 className="text-[10px] font-black text-blue-600 uppercase mb-1">User Identity</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">Emails and usernames for personalized synchronization.</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                <h4 className="text-[10px] font-black text-blue-600 uppercase mb-1">Media Assets</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">Profile photos and interaction content uploaded by the user.</p>
              </div>
              <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 sm:col-span-2">
                <h4 className="text-[10px] font-black text-blue-600 uppercase mb-1">Hardware & Advertising ID</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">Non-personal data via Google Advertising ID for fraud prevention and relevant content delivery.</p>
              </div>
            </div>
          </section>

          {/* 2. Usage */}
          <section className="group">
            <div className="flex items-center gap-4 mb-4">
              <div className="w-8 h-[1px] bg-blue-600" />
              <h2 className="text-xl font-black uppercase tracking-tight text-gray-900 dark:text-white">02. Logic & Utilization</h2>
            </div>
            <ul className="grid gap-2 text-sm text-gray-600 dark:text-gray-400 font-medium">
              <li className="flex items-start gap-2">
                <span className="text-blue-600">»</span> Core system functionality and account sync.
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">»</span> Transmission of intelligence (Anime News/Updates).
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-600">»</span> Deployment of non-intrusive AdMob assets.
              </li>
            </ul>
          </section>

          {/* 3. CSAE POLICY - HIGH ALERT STYLE */}
          <section className="relative overflow-hidden p-6 bg-red-500/5 dark:bg-red-500/10 border-l-4 border-red-600 rounded-r-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded shadow-lg shadow-red-600/20">
                High Alert
              </div>
              <h2 className="text-xl font-black uppercase tracking-tight text-red-600 dark:text-red-500">03. Child Safety (CSAE)</h2>
            </div>
            <p className="text-sm text-gray-800 dark:text-gray-200 leading-relaxed font-bold">
              Oreblogda maintains a <span className="underline decoration-red-600 decoration-2 underline-offset-4 uppercase">Zero-Tolerance Protocol</span> regarding Child Sexual Abuse Material (CSAM). 
              Breach of this protocol results in permanent terminal ban and immediate reporting to NCMEC and international law enforcement.
            </p>
          </section>

          {/* 4. Tracking & 5. Rights */}
          <div className="grid md:grid-cols-2 gap-8">
            <section>
              <h3 className="text-sm font-black uppercase text-blue-600 mb-3 tracking-widest">04. Tracking Nodes</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                We use cookies and Google Advertising IDs to optimize traffic. These can be reset in your Android System Settings.
              </p>
            </section>
            <section>
              <h3 className="text-sm font-black uppercase text-blue-600 mb-3 tracking-widest">05. Data Deletion</h3>
              <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                Access, update, or purge your data at any time. Requests are processed within <span className="text-blue-600 font-bold">48 hours</span> via our contact node.
              </p>
            </section>
          </div>

          {/* Footer of the content */}
          <div className="pt-10 border-t border-gray-100 dark:border-gray-800 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-400 mb-4">Secure Channel Contact</p>
            <a 
              href="mailto:oreblogda@gmail.com" 
              className="group relative inline-block text-2xl font-black text-gray-900 dark:text-white"
            >
              oreblogda@gmail.com
              <div className="h-1 w-0 bg-blue-600 group-hover:w-full transition-all duration-300" />
            </a>
          </div>
        </div>
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

export default PrivacyPolicy;
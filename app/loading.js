"use client";

import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useState } from 'react';

// --- INLINE WEB ICONS ---
const Icons = {
  AlertOctagon: ({ color }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="7.86 2 16.14 2 22 7.86 22 16.14 16.14 22 7.86 22 2 16.14 2 7.86 7.86 2"></polygon>
      <line x1="12" y1="8" x2="12" y2="12"></line>
      <line x1="12" y1="16" x2="12.01" y2="16"></line>
    </svg>
  ),
  Console: ({ color }) => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5"></polyline>
      <line x1="12" y1="19" x2="20" y2="19"></line>
    </svg>
  )
};

// 🎮 SCOPED GAME TIPS DICTIONARY
const SYSTEM_TIPS = {
  general: [
    "SYSTEM: Maintain your daily login streak. A broken streak can be restored by burning OC.",
    "SYSTEM: Lost in the meta? Consult the System Directory for complete operational intel.",
    "SYSTEM: Ensure your neural link (network connection) is stable to prevent transmission failure.",
    "SYSTEM: Modify your Operator Signature. A customized profile commands respect in the global feed.",
    "SYSTEM: Augment your Player Scroll with borders, watermarks, and glows, then dispatch it to the network."
  ],
  post: [
    "SYSTEM: Monarchs of the network who hoard the most AURA emit a unique visual resonance on their Player Card.",
    "SYSTEM: Cross-comm engagement is vital. Comment on allied transmissions to boost your algorithm presence.",
    "SYSTEM: Deploy Poll Transmissions to let the global network vote and settle syndicate disputes.",
    "SYSTEM: AURA is generated through network resonance. Broadcast high-value intel to farm it rapidly.",
    "SYSTEM: Consistency is power. Maintain a steady transmission rate to accelerate your Awakening."
  ],
  clan: [
    "SYSTEM: Initiate Clan Wars to plunder rival syndicates and secure massive point spikes.",
    "SYSTEM: In debt? A single successful transmission triggers the REDEMPTION protocol, resetting your balance to zero.",
    "WARNING: Syndicates that sink to -3,000 points are classified as dead weight and permanently purged by THE SYSTEM.",
    "SYSTEM: Display your acquired Clan Badges on your scroll to flex your syndicate's combat history.",
    "SYSTEM: Coordinate with your clanmates. The weekly point decay spares no one on the Global Leaderboard."
  ],
  wallet: [
    "SYSTEM: Burn OC in the Vault to decrypt exclusive player borders, backgrounds, and visual augments.",
    "SYSTEM: Clan Coins (CC) are locked to the Syndicate Vault. Pool resources to buff your entire clan.",
    "SYSTEM: Ascend to Peak Level 10 to unlock MYTHIC status and rewrite your system permissions.",
    "SYSTEM: Injecting external funds to acquire OC yields Peak Points. Ascend the VIP ranks.",
    "SYSTEM: Need to fund an ally? Execute a peer-to-peer OC transfer to keep their operations active."
  ]
};

export default function Loading({
  message = "FETCHING",
  subMessage = "Synchronizing Universe...",
  tipType = "general"
}) {
  const [currentTip, setCurrentTip] = useState("");

  useEffect(() => {
    const availableTips = SYSTEM_TIPS[tipType] || SYSTEM_TIPS.general;
    setCurrentTip(availableTips[Math.floor(Math.random() * availableTips.length)]);
  }, [tipType]);

  // ⚡️ TIP PARSING LOGIC
  const isWarning = currentTip.startsWith("WARNING:");
  const prefix = isWarning ? "WARNING:" : "SYSTEM:";
  const cleanMessage = currentTip.replace(prefix, "").trim();
  const prefixColor = isWarning ? "#ef4444" : "#06b6d4";

  return (
    // Using centralized theme colors if configured, otherwise falls back to exact hexes
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gray-50 dark:bg-[#020617] relative px-6 overflow-hidden">

      {/* ⚡️ BACKGROUND GLOW (Replacing Skia Canvas) */}
      <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
        <div className="w-[300px] h-[300px] rounded-full bg-cyan-500/15 dark:bg-cyan-500/10 blur-[60px]" />
      </div>

      {/* --- ANIMATION RINGS --- */}
      <div className="relative flex items-center justify-center w-32 h-32">

        {/* Expanding Energy Wave */}
        <motion.div
          className="absolute rounded-full border border-cyan-500"
          style={{ width: 60, height: 60 }}
          animate={{
            scale: [1, 2],
            opacity: [1, 0]
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeOut"
          }}
        />

        {/* Outer Orbital */}
        <motion.div
          className="absolute rounded-full border-[1.5px] border-cyan-500 opacity-50"
          style={{
            width: 100,
            height: 100,
            borderStyle: 'dashed'
          }}
          animate={{ rotate: 360 }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "linear"
          }}
        />

        {/* Inner Hex/Ring Frame */}
        <motion.div
          className="absolute rounded-[15px] border-t-transparent border-b-transparent"
          style={{
            width: 70,
            height: 70,
            borderWidth: 3,
            borderLeftColor: '#2563eb',
            borderRightColor: '#0ea5e9'
          }}
          animate={{ rotate: -720 }}
          transition={{
            duration: 2.5,
            repeat: Infinity,
            ease: "linear"
          }}
        />

        {/* Core Power Crystal */}
        <motion.div
          className="absolute bg-cyan-500 rounded border border-white z-10"
          style={{
            width: 28,
            height: 28,
            boxShadow: '0 0 15px rgba(6, 182, 212, 0.9)'
          }}
          animate={{
            scale: [1, 1.15, 1],
            rotate: 45 // Static 45deg rotation for diamond shape
          }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* --- HUD TEXT --- */}
      <motion.div
        className="mt-16 flex flex-col items-center z-10"
        animate={{ y: [-6, 0, -6] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div className="relative">
          {/* Shadow/Glow Text */}
          <span className="absolute -top-[2px] -left-[2px] text-4xl font-black italic uppercase text-cyan-500 opacity-20 select-none">
            {message}
          </span>
          <span className="relative text-4xl font-black italic uppercase text-slate-900 dark:text-cyan-50 tracking-tight">
            {message}
          </span>
        </div>

        {/* Status Badge */}
        <div
          className="flex items-center mt-3 bg-cyan-600 dark:bg-blue-600 px-4 py-1 shadow-[0_0_8px_rgba(6,182,212,0.4)]"
          style={{ transform: 'skewX(-15deg)' }}
        >
          <span
            className="text-[10px] font-bold text-white uppercase tracking-[0.4em] block"
            style={{ transform: 'skewX(15deg)' }}
          >
            {subMessage}
          </span>
        </div>

        {/* Experience Bar Style Loader */}
        <div className="w-40 h-1 bg-slate-200 dark:bg-slate-800 mt-10 overflow-hidden rounded-full border border-slate-300/30 dark:border-blue-900/30 relative">
          <motion.div
            className="absolute top-0 bottom-0 left-0 bg-cyan-500 w-full"
            style={{ boxShadow: '0 0 4px rgba(6, 182, 212, 1)' }}
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
          />
        </div>

        {/* Tech Bits */}
        <div className="flex gap-2 mt-4 opacity-40">
          <div className="w-3 h-0.5 bg-cyan-500 rounded-full" />
          <div className="w-1 h-0.5 bg-cyan-500 rounded-full" />
          <div className="w-3 h-0.5 bg-cyan-500 rounded-full" />
        </div>
      </motion.div>

      {/* ⚡️ SCOPED SYSTEM TIPS */}
      <AnimatePresence>
        {currentTip && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="absolute bottom-[80px] px-6 w-full flex justify-center"
          >
            <div className="bg-slate-900/5 dark:bg-white/5 border border-slate-900/10 dark:border-white/10 p-4 rounded-2xl w-full max-w-sm flex items-start backdrop-blur-sm">

              {/* Dynamic Icon */}
              <div className="mt-0.5 mr-2 opacity-80 shrink-0">
                {isWarning ? <Icons.AlertOctagon color={prefixColor} /> : <Icons.Console color={prefixColor} />}
              </div>

              {/* Dynamic Text Coloring */}
              <p className="text-slate-600 dark:text-slate-300 font-bold text-[10px] uppercase tracking-widest leading-relaxed m-0 flex-1">
                <span style={{ color: prefixColor, fontWeight: '900' }}>
                  {prefix}
                </span>
                {" " + cleanMessage}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
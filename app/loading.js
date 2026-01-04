"use client";

import React from 'react';

/**
 * Next.js Default Loading Screen
 * This file automatically handles Suspense for its directory.
 */
export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center bg-white dark:bg-[#0a0a0a] overflow-hidden relative">
      
      {/* BACKGROUND DECORATION */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-600/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-500/5 blur-[120px] rounded-full"></div>
      </div>

      <div className="flex flex-col items-center z-10">
        
        {/* [ ⌛ ] AUTOMATIC SUSPENSE TRIGGERED */}

        {/* MULTI-LAYER SCANNER */}
        <div className="relative w-24 h-24 mb-10">
          {/* Outer Ring */}
          <div className="absolute inset-0 rounded-full border-[1px] border-dashed border-blue-600/30 animate-[spin_8s_linear_infinite]"></div>
          
          {/* Main Spinner */}
          <div className="absolute inset-0 rounded-full border-t-4 border-blue-600 animate-spin"></div>
          
          {/* Reverse Inner Spinner */}
          <div className="absolute inset-4 rounded-full border-b-2 border-orange-500/50 animate-[spin_2s_linear_infinite_reverse]"></div>
          
          {/* Center Pulsing Diamond Core */}
          <div className="absolute inset-[38%] bg-blue-600 rounded-sm rotate-45 animate-pulse shadow-[0_0_20px_#2563eb]"></div>
          
          {/* Scanning Line Effect */}
          <div className="absolute inset-0 w-full h-[2px] bg-blue-400/20 top-1/2 -translate-y-1/2 animate-[scan_2s_ease-in-out_infinite]"></div>
        </div>

        {/* HUD TEXT AREA */}
        <div className="flex flex-col items-center">
            <div className="flex items-center gap-3 mb-2">
                <div className="h-[1px] w-6 bg-blue-600/40"></div>
                <h2 className="text-2xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white">
                    Fetching
                </h2>
                <div className="h-[1px] w-6 bg-blue-600/40"></div>
            </div>
          
          <div className="flex items-center gap-2">
             <span className="text-[10px] font-black text-blue-600 uppercase tracking-[0.4em] animate-pulse">
                Loading Page Data...
             </span>
          </div>

          {/* BOTTOM HUD DECORATIONS */}
          <div className="mt-8 grid grid-cols-3 gap-8 opacity-20">
              <div className="flex flex-col items-center">
                  <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Buffer</span>
                  <div className="h-1 w-8 bg-gray-400 mt-1"></div>
              </div>
              <div className="flex flex-col items-center">
                  <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Sector</span>
                  <div className="h-1 w-8 bg-gray-400 mt-1"></div>
              </div>
              <div className="flex flex-col items-center">
                  <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Sync</span>
                  <div className="h-1 w-8 bg-gray-400 mt-1"></div>
              </div>
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes scan {
          0% { transform: translateY(-40px); opacity: 0; }
          50% { opacity: 1; }
          100% { transform: translateY(40px); opacity: 0; }
        }
      `}</style>
      
      {/* [ ✅ ] BOOT SEQUENCE COMPLETE */}
    </div>
  );
}
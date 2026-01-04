"use client"
// app/not-found.js
import Link from "next/link";
import { motion } from "framer-motion";
export default function NotFound() {
  return (
    <div className="relative flex flex-col items-center justify-center h-[85vh] text-center px-4 overflow-hidden">
      
      {/* --- BACKGROUND GLITCH DECORATION --- */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-500/5 dark:bg-red-900/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.07]" 
             style={{ backgroundImage: `repeating-linear-gradient(0deg, #ff0000 0px, transparent 1px, transparent 2px)`, backgroundSize: '100% 3px' }} />
      </div>

      {/* --- ERROR CONTENT --- */}
      <div className="relative z-10">
        <div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
        >
          {/* Main Error Code */}
          <h1 className="text-8xl md:text-9xl font-black italic tracking-tighter text-red-600 dark:text-red-500 relative inline-block">
            404
            <span className="absolute top-0 left-0 w-full h-full text-blue-500 opacity-30 animate-[glitch_0.3s_infinite] translate-x-1">404</span>
            <span className="absolute top-0 left-0 w-full h-full text-green-500 opacity-30 animate-[glitch_0.3s_infinite] -translate-x-1">404</span>
          </h1>

          <div className="mt-4 mb-8">
            <h2 className="text-xl md:text-2xl font-black uppercase tracking-[0.3em] text-gray-900 dark:text-white mb-2">
              System Breach: Sector Not Found
            </h2>
            <div className="h-[2px] w-24 bg-red-600 mx-auto" />
          </div>

          {/* Terminal Style Description */}
          <div className="max-w-md mx-auto mb-10 p-4 bg-gray-100 dark:bg-gray-900/50 rounded-xl border border-gray-200 dark:border-red-900/30 font-mono text-left">
            <p className="text-[10px] text-red-500 mb-1 leading-relaxed">
              &gt; ERROR_CODE: 0x00000404 <br />
              &gt; STATUS: NULL_POINTER_EXCEPTION <br />
              &gt; MESSAGE: The requested intel folder has been purged or moved to a secure sector.
            </p>
            <div className="flex gap-1 mt-2">
              <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce" />
              <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce [animation-delay:-0.15s]" />
              <div className="w-2 h-2 bg-red-600 rounded-full animate-bounce [animation-delay:-0.3s]" />
            </div>
          </div>

          {/* --- ACTION BUTTON --- */}
          <Link href="/">
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="group relative px-10 py-4 bg-gray-900 dark:bg-white text-white dark:text-black overflow-hidden rounded-xl transition-all"
            >
              {/* Internal Loading Animation (Visual decoration) */}
              <div className="absolute bottom-0 left-0 h-1 bg-blue-600 animate-[loading_2s_infinite] w-full origin-left" />
              
              <span className="relative z-10 font-black uppercase italic tracking-widest text-sm flex items-center gap-2">
                Initiate Return Sequence
                <span className="group-hover:translate-x-2 transition-transform">→</span>
              </span>
            </motion.button>
          </Link>
        </div>
      </div>

      {/* --- FOOTER STATUS --- */}
      <div className="absolute bottom-10 left-0 w-full text-[8px] font-mono uppercase tracking-[0.5em] text-gray-400 opacity-50">
        Oreblogda_Kernel_v4.0 // Fatal_Error_Handler
      </div>

      <style jsx>{`
        @keyframes glitch {
          0% { clip-path: inset(10% 0 30% 0); transform: translate(-2px, 2px); }
          20% { clip-path: inset(30% 0 10% 0); transform: translate(2px, -2px); }
          40% { clip-path: inset(50% 0 5% 0); transform: translate(-2px, -2px); }
          60% { clip-path: inset(5% 0 60% 0); transform: translate(2px, 2px); }
          80% { clip-path: inset(15% 0 20% 0); transform: translate(-2px, 2px); }
          100% { clip-path: inset(10% 0 30% 0); transform: translate(2px, -2px); }
        }

        @keyframes loading {
          0% { transform: scaleX(0); }
          50% { transform: scaleX(1); }
          100% { transform: scaleX(0); transform-origin: right; }
        }
      `}</style>
    </div>
  );
}

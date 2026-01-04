"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";

const categories = ["News", "Memes", "Videos/Edits", "Polls", "Review", "Gaming"];

export default function CategoryNav() {
  const pathname = usePathname();
  const hideNavbarRoutes = ["/auth/login", "/auth/signup", "/about", "/terms", "/privacy", "/contact"];

  if (hideNavbarRoutes.includes(pathname)) return null;

  return (
    <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 mt-4 mb-2">
      <nav
        className="
          relative
          grid grid-cols-3 gap-1.5 
          sm:flex sm:flex-wrap sm:justify-center sm:gap-3
          p-1.5
          bg-white/40 dark:bg-black/40 backdrop-blur-md
          border border-gray-200 dark:border-blue-900/30
          rounded-xl shadow-2xl
        "
      >
        {/* Background Scanning Glow */}
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/5 to-transparent animate-[pulse_4s_infinite] pointer-events-none" />

        {categories.map((cat, index) => {
          const catSlug = cat.toLowerCase().replace("/", "-");
          const isActive = pathname.includes(catSlug);
          const displayName = cat === "Videos/Edits" ? "Videos" : cat;

          return (
            <Link
              key={cat}
              href={`/categories/${catSlug}`}
              className="relative group flex-1 sm:flex-none"
            >
              <motion.div
                whileHover={{ y: -2 }}
                whileTap={{ scale: 0.95 }}
                className={`
                  relative z-10
                  inline-flex justify-center items-center w-full
                  px-4 py-2 text-[10px] font-black uppercase tracking-widest
                  transition-all duration-300
                  clip-path-polygon rounded-lg
                  ${isActive
                    ? "bg-blue-600 text-white shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                    : "bg-gray-100 dark:bg-gray-900/80 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-blue-900/40 hover:text-blue-500"
                  }
                `}
              >
                {/* Active Indicator Dot */}
                {isActive && (
                  <span className="absolute top-1 right-1 w-1 h-1 bg-white rounded-full animate-ping" />
                )}
                
                {displayName}

                {/* Tactical Corner Brackets (Visible on Hover/Active) */}
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border-blue-400/50 ${isActive ? 'opacity-100' : ''}`}>
                   <div className="absolute top-0 left-0 w-1 h-1 border-t border-l border-blue-400" />
                   <div className="absolute bottom-0 right-0 w-1 h-1 border-b border-r border-blue-400" />
                </div>
              </motion.div>
              
              {/* Subtle underline for active state */}
              {isActive && (
                <div 
                  layoutId="cat-active"
                  className="absolute -bottom-1 left-2 right-2 h-0.5 bg-blue-600 rounded-full"
                />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Breadcrumb / Status Line */}
      <div className="flex justify-between items-center mt-2 px-2">
        <div className="flex items-center gap-2">
           <div className="h-[1px] w-8 bg-blue-600/50" />
           <span className="text-[8px] font-mono uppercase tracking-[0.3em] text-gray-500 dark:text-blue-400/60">
             Sector_Map // {pathname.split('/').pop() || 'Root'}
           </span>
        </div>
        <div className="hidden sm:block text-[8px] font-mono text-gray-400 uppercase tracking-tighter italic">
           Access_Point: Dynamic_Feed_v2
        </div>
      </div>
    </div>
  );
}
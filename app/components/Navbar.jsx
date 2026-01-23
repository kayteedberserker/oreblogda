"use client";
import Image from "next/image";
import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiMenu, HiX } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";

const Navbar = () => {
    const pathname = usePathname();
    const hideNavbarRoutes = ["/auth/login", "/auth/signup"];
    if (hideNavbarRoutes.includes(pathname)) return null;
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const {systemTheme} = useTheme()
    const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
   if (!mounted) return null;
    
    const logoSrc = systemTheme === "dark" ? "/logowhite.png" : "/og-image.png";

  const links = [
    { name: "Home", href: "/" },
      { name: "Leaderboard", href: "/leaderboard" }, 
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
  ];
  return (
    <nav
      className={`w-full fixed top-0 left-0 z-[100] transition-all duration-500 border-b ${
        systemTheme === "dark" 
          ? "bg-[#050505]/80 border-blue-900/30 text-white" 
          : "bg-white/80 border-gray-200 text-gray-900"
      } backdrop-blur-md shadow-sm`}
    >
      {/* HUD Accent Line */}
      <div className="absolute bottom-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-blue-600/50 to-transparent opacity-50" />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          
          {/* --- LOGO ENGINE --- */}
          <motion.div 
            className="shrink-0 relative group"
            whileHover={{ scale: 1.02 }}
          >
            <Link href="/" className="relative z-10">
              <Image 
                src={logoSrc} 
                alt="Oreblogda Logo" 
                loading="eager" 
                className="w-[130px] h-auto object-contain" 
                width={200} 
                height={60}
              />
            </Link>
            {/* Logo Glow Effect */}
            <div className="absolute inset-0 bg-blue-500/10 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </motion.div>

          {/* --- DESKTOP NAVIGATION --- */}
          <div className="hidden md:flex space-x-8 items-center">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <div key={link.name} className="relative group">
                  <Link
                    href={link.href}
                    className={`text-[11px] font-black uppercase tracking-[0.2em] transition-all duration-300 py-2 flex items-center gap-1 ${
                      isActive
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-300"
                    }`}
                  >
                    {isActive && <span className="w-1 h-1 bg-blue-600 dark:bg-blue-400 rounded-full animate-pulse" />}
                    {link.name}
                  </Link>
                  
                  {/* Tactical Underline */}
                  {isActive ? (
                    <div
                      layoutId="nav-underline"
                      className="absolute -bottom-[21px] left-0 w-full h-[3px] bg-blue-600 dark:bg-blue-400 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                    />
                  ) : (
                    <div className="absolute -bottom-[21px] left-0 w-0 h-[3px] bg-blue-500/40 group-hover:w-full transition-all duration-300" />
                  )}
                </div>
              );
            })}
          </div>

          {/* --- MOBILE TOGGLE --- */}
          <div className="md:hidden flex items-center">
            <button
              aria-label="Toggle Menu"
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              className={`p-2 rounded-lg transition-all ${
                isMobileOpen 
                  ? "bg-red-500/10 text-red-500" 
                  : "hover:bg-blue-500/10 text-blue-600"
              }`}
            >
              {isMobileOpen ? (
                <div initial={{ rotate: -90 }} animate={{ rotate: 0 }}><HiX size={24} /></div>
              ) : (
                <div initial={{ scale: 0.8 }} animate={{ scale: 1 }}><HiMenu size={24} /></div>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* --- MOBILE TERMINAL MENU --- */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "100vh", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
            className={`md:hidden fixed inset-0 top-16 z-[99] overflow-hidden ${
              systemTheme === "dark" 
                ? "bg-[#050505]/95 backdrop-blur-2xl" 
                : "bg-white/95 backdrop-blur-2xl"
            }`}
          >
            {/* Grid background for mobile menu */}
            <div 
              className="absolute inset-0 opacity-[0.05] pointer-events-none"
              style={{ 
                backgroundImage: `linear-gradient(#2563eb 1px, transparent 1px), linear-gradient(90deg, #2563eb 1px, transparent 1px)`, 
                backgroundSize: '30px 30px' 
              }} 
            />

            <div className="relative z-10 px-6 py-12 flex flex-col gap-6">
              <span className="text-[10px] font-black tracking-[0.5em] text-blue-600 uppercase opacity-50">Main_Menu</span>
              
              {links.map((link, index) => {
                const isActive = pathname === link.href;
                return (
                  <div
                    key={link.name}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={`text-4xl font-black italic uppercase tracking-tighter transition-all ${
                        isActive
                          ? "text-blue-600 stroke-text"
                          : "text-gray-400 dark:text-gray-600 hover:text-blue-500"
                      }`}
                    >
                      {link.name}
                    </Link>
                  </div>
                );
              })}

              <div className="mt-auto border-t border-gray-200 dark:border-gray-800 pt-8 pb-20">
                 <p className="text-[10px] font-mono text-gray-400">STATUS: SYSTEM_READY</p>
                 <p className="text-[10px] font-mono text-gray-400">LOC: LEKKI_NODE_NG</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style jsx>{`
        .stroke-text {
          text-shadow: 2px 2px 0px rgba(37,99,235,0.2);
        }
      `}</style>
    </nav>
  );
};

export default Navbar;

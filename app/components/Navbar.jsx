"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { HiMenu, HiX } from "react-icons/hi";
import { motion, AnimatePresence } from "framer-motion";
import { BsSun, BsMoon } from "react-icons/bs";

const Navbar = () => {
  const pathname = usePathname();
  const hideNavbarRoutes = ["/auth/login", "/auth/signup"];
  if (hideNavbarRoutes.includes(pathname)) return null;

  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [theme, setTheme] = useState("light");

  const links = [
    { name: "Home", href: "/" },
    { name: "About", href: "/about" },
    { name: "Contact", href: "/contact" },
  ];

  // On mount, get theme from localStorage
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    if (savedTheme) {
      setTheme(savedTheme);
      document.documentElement.classList.toggle("dark", savedTheme === "dark");
    }
  }, []);

  // Toggle theme
  const toggleTheme = () => {
  const html = document.documentElement;
  if(html.classList.contains("dark")){
    html.classList.remove("dark");
    localStorage.setItem("theme", "light");
  } else {
    html.classList.add("dark");
    localStorage.setItem("theme", "dark");
  }
};

  return (
    <nav
      className={`w-full fixed top-0 left-0 z-50 transition-colors duration-300 ${
        theme === "dark" ? "bg-gray-900 text-white" : "bg-white text-gray-900"
      } shadow-md`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {/* Logo */}
          <div className="shrink-0 font-bold text-xl">
            <Link href="/">MyLogo</Link>
          </div>

          {/* Desktop Links */}
          <div className="hidden md:flex space-x-6 items-center">
            {links.map((link) => {
              const isActive = pathname === link.href;
              return (
                <motion.div
                  key={link.name}
                  className="relative"
                  whileHover={{ scale: 1.1 }}
                  transition={{ type: "spring", stiffness: 300 }}
                >
                  <Link
                    href={link.href}
                    className={`px-1 py-2 font-medium transition-colors duration-200 ${
                      isActive
                        ? theme === "dark"
                          ? "text-blue-400"
                          : "text-blue-600"
                        : "hover:text-blue-500"
                    }`}
                  >
                    {link.name}
                  </Link>
                  {isActive && (
                    <motion.span
                      layoutId="underline"
                      className={`absolute left-0 bottom-0 h-0.5 w-full ${
                        theme === "dark" ? "bg-blue-400" : "bg-blue-600"
                      } rounded`}
                    />
                  )}
                </motion.div>
              );
            })}

            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="ml-4 p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {theme === "light" ? <BsMoon size={20} /> : <BsSun size={20} />}
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={() => setIsMobileOpen(!isMobileOpen)}
              className="p-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {isMobileOpen ? <HiX size={28} /> : <HiMenu size={28} />}
            </button>

            {/* Theme Toggle Mobile */}
            <button
              onClick={toggleTheme}
              className="ml-2 p-2 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {theme === "light" ? <BsMoon size={20} /> : <BsSun size={20} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMobileOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={`md:hidden overflow-hidden shadow-lg ${
              theme === "dark" ? "bg-gray-900" : "bg-white"
            }`}
          >
            <div className="px-2 pt-2 pb-4 space-y-1">
              {links.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <motion.div
                    key={link.name}
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <Link
                      href={link.href}
                      onClick={() => setIsMobileOpen(false)}
                      className={`block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${
                        isActive
                          ? theme === "dark"
                            ? "text-blue-400"
                            : "text-blue-600"
                          : "hover:text-blue-500"
                      }`}
                    >
                      {link.name}
                    </Link>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
};

export default Navbar;

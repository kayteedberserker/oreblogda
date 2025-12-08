"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const categories = ["News", "Memes", "Videos/Edits", "Polls", "Review", "Gaming"];

export default function CategoryNav() {
  const pathname = usePathname(); // current URL
  const hideNavbarRoutes = ["/auth/login", "/auth/signup", "/about", "/terms", "/privacy", "/contact"];

  if (hideNavbarRoutes.includes(pathname)) return null;

  return (
    <nav className="flex flex-wrap justify-center gap-2 sm:gap-3 py-2 px-2 sm:px-4 bg-gray-100 dark:bg-gray-800 rounded-md shadow-sm">
  {categories.map((cat) => {
    const isActive = pathname.includes(cat.toLowerCase().replace("/", "-"));
    const displayName = cat === "Videos/Edits" ? "Videos" : cat;

    return (
      <Link
        key={cat}
        href={`/categories/${cat.toLowerCase().replace("/", "-")}`}
        className={`inline-flex items-center px-2 text-sm py-1 rounded-md font-medium whitespace-nowrap ${
          isActive
            ? "bg-blue-600 text-white"
            : "bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 hover:bg-blue-500 hover:text-white transition"
        }`}
      >
        {displayName}
      </Link>
    );
  })}
</nav>

  );
}


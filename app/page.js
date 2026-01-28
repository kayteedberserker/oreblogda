import PostsViewer from "@/app/components/PostsViewer";
import { ToastContainer } from "react-toastify";

/**
 * HOME PAGE (SSR SERVER COMPONENT) - OPTIMIZED FOR PERFORMANCE
 * Simplified UI to match the Mobile App aesthetic.
 */

const INTERNAL_HEADERS = {
  "x-oreblogda-secret": process.env.APP_INTERNAL_SECRET,
  "Content-Type": "application/json",
};

export default async function HomePage() {
  const limit = 10;
  let initialPosts = [];

  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/posts?page=1&limit=${limit}`,
      {
        headers: INTERNAL_HEADERS,
        next: { revalidate: 600 }, 
      }
    );

    if (res.ok) {
      const initialData = await res.json();
      initialPosts = Array.isArray(initialData)
        ? initialData
        : initialData.posts || [];
    }
  } catch (error) {
    console.error("⛔ Home Feed Fetch Error:", error);
  }

  return (
    <div className="min-h-screen relative bg-white dark:bg-[#050505] selection:bg-blue-500/30">
      
      {/* --- MINIMAL BACKGROUND ENGINE --- */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Subtler Neural Lines - Static to save CPU */}
        <div 
          className="absolute inset-0 opacity-[0.02] dark:opacity-[0.04]" 
          style={{ 
            backgroundImage: `linear-gradient(#2563eb 0.5px, transparent 0.5px), linear-gradient(90deg, #2563eb 0.5px, transparent 0.5px)`, 
            backgroundSize: '60px 60px' 
          }} 
        />
        
        {/* Static Glows (No Blur filter, just Radial Gradients for speed) */}
        <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-[radial-gradient(circle,_rgba(37,99,235,0.08)_0%,_transparent_70%)]" />
        <div className="absolute top-[20%] -right-[10%] w-[30%] h-[30%] bg-[radial-gradient(circle,_rgba(59,130,246,0.05)_0%,_transparent_70%)]" />
      </div>

      {/* --- MAIN CONTENT AREA --- */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-20">
        
        {/* Section Header - Styled like your App Tabs */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-blue-600 font-black text-[10px] uppercase tracking-[0.4em]">
              Global_Feed
        </span>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter text-zinc-900 dark:text-white">
              Data Stream
            </h1>
          </div>
          
          <div className="hidden sm:flex items-center gap-2 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="px-4 py-1.5 rounded-lg bg-blue-600">
              <span className="text-[10px] font-black uppercase text-white tracking-widest">Trending</span>
            </div>
            <div className="px-4 py-1.5 rounded-lg">
              <span className="text-[10px] font-black uppercase text-zinc-500 tracking-widest">Recent</span>
            </div>
          </div>
        </div>

        {/* The Content Engine */}
        <div className="will-change-transform">
          <PostsViewer initialPosts={initialPosts} />
        </div>
      </main>

      {/* --- FOOTER DECOR --- */}
      <div className="fixed bottom-6 left-10 hidden xl:flex items-center gap-3 opacity-40 pointer-events-none">
        <div className="h-2 w-2 rounded-full bg-blue-600 animate-pulse" />
        <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-zinc-500 dark:text-zinc-400">
          Sync_Status: Optimized
        </span>
      </div>

      <ToastContainer 
        position="bottom-right" 
        autoClose={3000} 
        hideProgressBar
        theme={isDark ? "dark" : "light"}
      />
    </div>
  );
}

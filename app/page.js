// app/page.jsx
import PostsViewer from "@/app/components/PostsViewer";
import { ToastContainer } from "react-toastify";

/**
 * HOME PAGE (SSR SERVER COMPONENT)
 * NO 'use client' - NO 'style jsx'
 * ALL STYLING VIA TAILWIND ARBITRARY VALUES
 */
export default async function HomePage() {
  const limit = 10;

  // Fetch posts on the server BEFORE rendering
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SITE_URL}/api/posts?page=1&limit=${limit}`,
    {
      next: { revalidate: 600 }, // Revalidate every 10 minutes
    }
  );

  const initialData = await res.json();
  const initialPosts = Array.isArray(initialData)
    ? initialData
    : initialData.posts || [];

  return (
    /* FIX: Changed 'overflow-hidden' to 'overflow-clip'. 
       'overflow-clip' allows position: sticky to work while still 
       hiding the absolute glows that bleed off the screen.
    */
    <div className="min-h-[75vh] relative overflow-clip bg-white dark:bg-[#050505]">
      
      {/* --- LAYER 1: NEURAL GRID OVERLAY --- */}
      <div 
        className="absolute inset-0 opacity-[0.03] dark:opacity-[0.05] pointer-events-none" 
        style={{ 
          backgroundImage: `linear-gradient(#2563eb 1px, transparent 1px), linear-gradient(90deg, #2563eb 1px, transparent 1px)`, 
          backgroundSize: '40px 40px' 
        }} 
      />

      {/* --- LAYER 2: DYNAMIC ATMOSPHERIC GLOWS --- */}
      <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-blue-400/5 dark:bg-blue-900/10 blur-[150px] rounded-full animate-pulse [animation-duration:8s]" />
      <div className="absolute left-1/2 top-0 w-[1px] h-full bg-gradient-to-b from-transparent via-blue-500/10 to-transparent pointer-events-none" />

      {/* --- LAYER 3: THE CONTENT ENGINE --- */}
      <div className="relative z-1">
        Hi 
        {/* Pass SSR posts to PostsViewer (which is a Client Component) */}
        
        // <PostsViewer initialPosts={initialPosts} />
      <div>

      {/* --- LAYER 4: SYSTEM MARQUEE DECOR --- */}
      <div className="absolute bottom-4 left-8 hidden lg:flex items-center gap-4 opacity-30 pointer-events-none">
        <div className="flex gap-1">
          <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce" />
          <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce [animation-delay:0.2s]" />
          <div className="w-1 h-1 bg-blue-600 rounded-full animate-bounce [animation-delay:0.4s]" />
        </div>
        <span className="text-[8px] font-black uppercase tracking-[0.4em] text-blue-600">
          Neural_Link_Established // Stream_v4.0
        </span>
      </div>

      <ToastContainer 
        position="bottom-right" 
        autoClose={3000} 
        theme="colored"
      />
    </div>
  );
}

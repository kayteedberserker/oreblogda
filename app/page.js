import PostsViewer from "@/app/components/PostsViewer";
import { ToastContainer } from "react-toastify";

/**
 * HOME PAGE (SSR SERVER COMPONENT)
 * Security: Internal operative headers added to bypass middleware.
 */

// Define the headers to satisfy middleware security
const INTERNAL_HEADERS = {
  "x-oreblogda-secret": process.env.APP_INTERNAL_SECRET,
  "Content-Type": "application/json",
};

export default async function HomePage() {
  const limit = 10;

  let initialPosts = [];

  try {
    // Fetch posts on the server with the internal operative secret
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL}/api/posts?page=1&limit=${limit}`,
      {
        headers: INTERNAL_HEADERS,
        next: { revalidate: 600 }, // Revalidate every 10 minutes
      }
    );

    if (res.ok) {
      const initialData = await res.json();
      initialPosts = Array.isArray(initialData)
        ? initialData
        : initialData.posts || [];
    } else {
      console.error(`⛔ Home Feed fetch failed: ${res.status}`);
    }
  } catch (error) {
    console.error("⛔ Home Feed Fetch Error:", error);
  }

  return (
    /* FIX: Changed 'overflow-hidden' to 'overflow-clip'. 
       'overflow-clip' allows position: sticky to work while still 
       hiding the absolute glows that bleed off the screen.
       ⚡️ THEME FIX: Uses centralized app-bg colors
    */
    <div className="min-h-[75vh] relative overflow-clip transition-colors duration-500">


      {/* --- LAYER 2: DYNAMIC ATMOSPHERIC GLOWS --- */}
      <div className="absolute top-[-5%] left-[-5%] w-[40%] h-[40%] bg-blue-500/10 dark:bg-indigo-600/10 blur-[120px] rounded-full animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-blue-400/5 dark:bg-blue-900/10 blur-[150px] rounded-full animate-pulse [animation-duration:8s]" />
      <div className="absolute left-1/2 top-0 w-[1px] h-full bg-gradient-to-b from-transparent via-blue-500/10 to-transparent pointer-events-none" />

      {/* --- LAYER 3: THE CONTENT ENGINE --- */}
      <div className="relative z-1 flex flex-col items-center justify-center">
        {/* Pass SSR posts to PostsViewer (which is a Client Component) */}
        <PostsViewer initialPosts={initialPosts} />
      </div>
      <ToastContainer
        position="bottom-right"
        autoClose={3000}
        theme="colored"
      />
    </div>
  );
}
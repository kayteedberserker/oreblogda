// app/categories/[id]/page.jsx
import PostCard from "@/app/components/PostCard";
import RecentPollsCard from "@/app/components/RecentPollsCard";
import ClientPagination from "./ClientPagination"; // client-side pagination component
import { motion } from "framer-motion";
import { useScrollAnimation } from "@/app/components/useScrollAnimation";

const limit = 5;

export default async function CategoryPage({ params }) {
  const { id } = params;

  // Format category from URL
  const category = id
    ? id.includes("-")
      ? id.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("/")
      : id.charAt(0).toUpperCase() + id.slice(1).toLowerCase()
    : "";

  // Server-side fetch first page of posts
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/posts?category=${category}&page=1&limit=${limit}`,
    { cache: "no-store" } // ensures fresh data
  );
  const data = await res.json();
  const initialPosts = data.posts || [];

  const { ref, controls, variants } = useScrollAnimation();

  return (
    <motion.div ref={ref} initial="hidden" animate={controls} variants={variants} className="bg-transparent rounded-2xl shadow-md">
      <div className="max-w-7xl mx-auto px-2 md:px-8 py-6 relative min-h-[75vh]">
        <h1 className="text-2xl font-bold mb-6 capitalize">{category}</h1>

        {/* Background effects */}
        <div className="absolute top-10 left-10 w-48 h-48 bg-blue-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-56 h-56 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

        <div className="md:flex md:gap-8">
          {/* Server-rendered posts */}
          <div id="postsContainer" className="md:flex-2 max-h-[80vh] overflow-y-auto pr-2 scrollbar-hide">
            {initialPosts.length > 0 ? (
              initialPosts.map(post => (
                <div key={post._id} className="break-inside-avoid mb-6">
                  <PostCard post={post} posts={initialPosts} setPosts={() => {}} isFeed={true} />
                </div>
              ))
            ) : (
              <p className="text-center text-gray-500 mt-4">No posts found in this category</p>
            )}
          </div>

          {/* Sidebar */}
          <div className="hidden md:block md:w-1/3">
            <RecentPollsCard />
          </div>

          {/* Client Pagination for infinite scroll + mini drawer */}
          <ClientPagination category={category} initialPosts={initialPosts} />
        </div>

        <style jsx>{`
          .scrollbar-hide::-webkit-scrollbar { width: 0px; }
          .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
          div[style*="overflow-y: auto"]::-webkit-scrollbar { width: 6px; }
          div[style*="overflow-y: auto"]::-webkit-scrollbar-track { background: transparent; }
          div[style*="overflow-y: auto"]::-webkit-scrollbar-thumb { background-color: rgba(107, 114, 128, 0.5); border-radius: 10px; }
          .dark div[style*="overflow-y: auto"]::-webkit-scrollbar-thumb { background-color: rgba(156, 163, 175, 0.3); }
        `}</style>
      </div>
    </motion.div>
  );
        }

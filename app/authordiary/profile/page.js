"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Image from "next/image";

const ProfilePage = () => {
  const [user, setUser] = useState(null);
  const [description, setDescription] = useState("");
  const [preview, setPreview] = useState(null);
  const [file, setFile] = useState(null);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const limit = 5;
  const prevScrollHeight = useRef(0);
  const router = useRouter();

  // 🔹 Fetch logged-in user (secure, using JWT)
  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        const data = await res.json();

        if (!res.ok || !data?.user) {
          router.push("/login");
          return;
        }

        setUser(data.user);
        setDescription(data.user?.description || "");
      } catch (err) {
        toast.error("Failed to load user data");
      }
    };
    fetchUser();
  }, [router]);

  // 🔹 Fetch user's posts (with pagination + scroll fix)
  const fetchUserPosts = async (pageNum = 1) => {
    if (!user?._id) return;
    try {
      setLoadingPosts(true);
      const res = await fetch(`/api/posts?author=${user._id}&page=${pageNum}&limit=${limit}`);
      const data = await res.json();
      const newPosts = data.posts || [];

      if (newPosts.length < limit) setHasMore(false);

      // preserve scroll position
      prevScrollHeight.current = document.body.scrollHeight;

      setPosts(prev => [...prev, ...newPosts]);

      setTimeout(() => {
        const diff = document.body.scrollHeight - prevScrollHeight.current;
        window.scrollBy({ top: -diff, behavior: "instant" });
      }, 0);
    } catch (err) {
      toast.error("Failed to load posts");
    } finally {
      setLoadingPosts(false);
    }
  };

  // first load
  useEffect(() => {
    if (user?._id) fetchUserPosts(page);
  }, [user, page]);

  // infinite scroll
  useEffect(() => {
    const handleScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.body.offsetHeight - 200 &&
        hasMore &&
        !loadingPosts
      ) {
        setPage(prev => prev + 1);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [hasMore, loadingPosts]);

  // 🔹 Handle file selection
  const handleFileChange = e => {
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setPreview(selectedFile ? URL.createObjectURL(selectedFile) : null);
  };

  // 🔹 Update profile
  const handleUpdate = async e => {
    e.preventDefault();
    if (!user?._id) return toast.error("User not found");

    setLoading(true);
    try {
      const formData = new FormData();
      formData.append("userId", user._id);
      formData.append("description", description);
      if (file) formData.append("file", file);

      const res = await fetch("/api/users/upload", {
        method: "PUT",
        body: formData,
      });

      const result = await res.json();
      if (res.ok) {
        toast.success("Profile updated successfully!");
        setUser(result.user);
        setFile(null);
        setPreview(null);
      } else {
        toast.error(result.message || "Update failed");
      }
    } catch (err) {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Delete post (secure)
  const handleDelete = async postId => {
    if (!confirm("Are you sure you want to delete this post?")) return;

    try {
      const res = await fetch("/api/posts/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ postId }),
      });

      const data = await res.json();

      if (res.ok) {
        toast.success("Post deleted successfully!");
        setPosts(prev => prev.filter(p => p._id !== postId));
      } else {
        toast.error(data.message || "Delete failed");
      }
    } catch (err) {
      toast.error("Error deleting post");
    }
  };

  if (!user) {
    {/* [ ⌛ ] SYSTEM INITIALIZING...
     [ ████████░░ ] 80% - ESTABLISHING ENCRYPTED LINK
     [ ✅ ] RENDER COMPLETE 
  */}

    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900 overflow-hidden relative">

        {/* BACKGROUND GLOW EFFECTS */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-blue-500/20 blur-[60px] rounded-full animate-pulse"></div>

        <div className="flex flex-col items-center z-10">

          {/* TOP STATUS LINKS (HUD Style) */}
          <div className="flex items-center gap-4 mb-8">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse"></span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600/60">Uplink</span>
            </div>
            <div className="h-[1px] w-8 bg-gray-200 dark:bg-gray-800"></div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-ping"></span>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500/60">Auth_Secure</span>
            </div>
          </div>

          {/* CENTER SPINNER / LOGO */}
          <div className="relative mb-6">
            {/* Outer Rotating Ring */}
            <div className="h-20 w-20 rounded-full border-[3px] border-blue-600/10 border-t-blue-600 animate-spin"></div>
            {/* Inner Counter-Rotating Ring */}
            <div className="absolute top-2 left-2 h-16 w-16 rounded-full border-[3px] border-transparent border-t-orange-500 animate-[spin_1.5s_linear_infinite_reverse]"></div>
            {/* Static Center Point */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 bg-white dark:bg-gray-900 rounded-full shadow-[0_0_10px_#2563eb]"></div>
          </div>

          {/* TEXT CONTENT */}
          <div className="text-center">
            <h2 className="text-xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white mb-1">
              Verifying Admin Access
            </h2>

            {/* DYNAMIC PROGRESS BAR */}
            <div className="w-48 h-1 bg-gray-100 dark:bg-gray-800 rounded-full mt-4 overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 bg-blue-600 w-1/2 animate-[loading_2s_ease-in-out_infinite] rounded-full shadow-[0_0_10px_#2563eb]"></div>
            </div>

            <div className="mt-4 flex flex-col gap-1">
              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-[0.3em] animate-pulse">
                Establishing Encrypted Session...
              </p>
              <p className="text-[7px] font-mono text-gray-500/50 uppercase">
                Protocol: TLS_AES_256_GCM_SHA384
              </p>
            </div>
          </div>
        </div>

        {/* TAILWIND CUSTOM ANIMATION CONFIG (Add to your global CSS if needed) */}
        <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
      `}</style>
      </div>
    );
  }
  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white relative overflow-hidden p-4 md:p-10">

      {/* AMBIENT BACKGROUND DECO */}
      <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute top-1/2 left-0 w-[200px] h-[200px] bg-purple-600/5 blur-[80px] rounded-full pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10">

        {/* --- PAGE HEADER --- */}
        <div className="flex items-center gap-4 mb-10 border-b border-gray-100 dark:border-gray-800 pb-6">
          <div className="w-2 h-8 bg-blue-600" />
          <h1 className="text-3xl font-black italic tracking-tighter uppercase">Player Profile</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">

          {/* LEFT COLUMN: AVATAR & STATS */}
          <div className="lg:col-span-4 flex flex-col items-center">
            <div className="relative group">
              {/* Animated Scanner Ring */}
              <div className="absolute -inset-3 border border-dashed border-blue-600/30 rounded-full animate-[spin_10s_linear_infinite]" />
              <div className="absolute -inset-1 border-2 border-blue-600 rounded-full opacity-50" />

              <div className="w-40 h-40 rounded-full overflow-hidden border-4 border-white dark:border-[#0a0a0a] relative shadow-2xl">
                <Image
                  src={preview || user?.profilePic?.url || "/default-avatar.png"}
                  alt="Profile"
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                />
                <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <span className="text-[10px] font-black uppercase tracking-widest text-white">Change DNA</span>
                  <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
                </label>
              </div>
            </div>

            <div className="mt-6 text-center">
              <h2 className="text-xl font-black uppercase tracking-tighter text-blue-600">{user.username}</h2>
              <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em]">Class: Author / Hunter</p>
            </div>
          </div>

          {/* RIGHT COLUMN: CORE DATA */}
          <div className="lg:col-span-8">
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Read-only Data (HUD Style) */}
                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">Account ID</label>
                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-3 rounded-xl">
                    <span className="text-sm font-bold text-gray-500">{user.username}</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">Neural Uplink (Email)</label>
                  <div className="bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-3 rounded-xl">
                    <span className="text-sm font-bold text-gray-500">{user.email}</span>
                  </div>
                </div>
              </div>

              {/* Editable Description */}
              <div className="space-y-1">
                <label className="text-[9px] font-black uppercase tracking-widest text-gray-400 ml-1">Biography / Lore</label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Write your player bio here..."
                  className="w-full bg-white dark:bg-black/40 border-2 border-gray-100 dark:border-gray-800 rounded-2xl p-4 text-sm font-medium focus:border-blue-600 outline-none transition-all min-h-[120px]"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="group relative w-full py-4 bg-blue-600 rounded-xl overflow-hidden transition-all hover:scale-[1.01] active:scale-[0.98] disabled:opacity-50"
              >
                <span className="relative z-10 text-white font-black uppercase italic tracking-widest text-xs">
                  {loading ? "Syncing Changes..." : "Update Character Data"}
                </span>
                <div className="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform" />
              </button>
            </form>
          </div>
        </div>

        {/* --- POST INVENTORY (QUEST LOG) --- */}
        <div className="mt-20">
          <div className="flex items-center gap-4 mb-8">
            <h3 className="text-xl font-black uppercase tracking-tighter italic">Transmission Logs</h3>
            <div className="h-[1px] flex-1 bg-gradient-to-r from-gray-200 dark:from-gray-800 to-transparent" />
          </div>

          {loadingPosts && posts.length === 0 ? (
            <div className="flex justify-center p-10"><div className="animate-spin h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full" /></div>
          ) : posts.length === 0 ? (
            <div className="text-center p-12 bg-gray-50 dark:bg-gray-900/50 rounded-3xl border-2 border-dashed border-gray-100 dark:border-gray-800">
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Empty Logs - Go Post Something!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {posts.map(post => (
                <div
                  key={post._id}
                  className="group bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 p-5 rounded-2xl flex justify-between items-center hover:border-blue-600/50 transition-all shadow-sm"
                >
                  <div className="flex-1 pr-4">
                    <h3 className="font-black text-sm uppercase tracking-tight text-gray-800 dark:text-gray-200 line-clamp-1">{post.title || post.message}</h3>
                    <p className="text-[9px] font-bold text-blue-600 uppercase tracking-widest mt-1">
                      {new Date(post.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <button
                    onClick={() => handleDelete(post._id)}
                    className="p-3 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-lg transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          {loadingPosts && posts.length > 0 && <p className="text-center text-[10px] font-black uppercase tracking-widest text-gray-400 mt-6 animate-pulse">Loading more transmissions...</p>}
        </div>
      </div>

      <ToastContainer autoClose={2500} theme="dark" />
    </div>
  );
};

export default ProfilePage;

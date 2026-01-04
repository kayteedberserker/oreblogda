"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Link from "next/link";

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState(""); // main message + inline sections
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaUrlLink, setMediaUrlLink] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [hasPoll, setHasPoll] = useState(false);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("News");
  const [uploading, setUploading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.push("/auth/login");
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch {
        router.push("/auth/login");
      }
    };
    fetchUser();
  }, [router]);

  // --- Poll Logic ---
  const handlePollOptionChange = (i, val) => {
    const newOptions = [...pollOptions];
    newOptions[i] = val;
    setPollOptions(newOptions);
  };
  const addPollOption = () => setPollOptions([...pollOptions, ""]);
  const removePollOption = (i) => setPollOptions(pollOptions.filter((_, idx) => idx !== i));

  // --- Upload Media ---
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      // 1. Create FormData (Required for req.formData() on the server)
      const formData = new FormData();
      formData.append("file", file); // Use the key "file" to match your backend

      const res = await fetch("/api/upload", {
        method: "POST",
        // 2. Pass the formData as the body
        // 3. DO NOT set headers, the browser will do it automatically
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.url) {
        setMediaUrl(data.url);
        setMediaType(file.type.startsWith("video") ? "video" : "image");
        toast.success("File uploaded successfully!");
      } else {
        toast.error(data.message || "Upload failed.");
      }
    } catch (err) {
      toast.error("Something went wrong during upload.");
    } finally {
      setUploading(false);
    }
  };

  // --- Create Post ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const mediaToSend = mediaUrl || mediaUrlLink || null;
      const typeToSend = mediaUrl
        ? mediaType
        : mediaUrlLink
          ? mediaUrlLink.includes("video") || mediaUrlLink.includes("tiktok")
            ? "video"
            : "image"
          : null;

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          authorId: user.id,
          title,
          message, // message contains inline sections
          mediaUrl: mediaToSend,
          mediaType: typeToSend,
          hasPoll,
          pollMultiple,
          pollOptions: hasPoll
            ? pollOptions.filter((opt) => opt.trim() !== "").map((opt) => ({ text: opt }))
            : [],
          category,
        }),
      });

      const data = await res.json();
      if (!res.ok) toast.error(data.message || "Failed to create post");
      else {
        toast.success("Post created successfully!");
        setTitle("");
        setMessage("");
        setMediaUrl("");
        setMediaUrlLink("");
        setMediaType("image");
        setHasPoll(false);
        setPollMultiple(false);
        setPollOptions(["", ""]);
      }
    } catch (err) {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
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
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white relative overflow-hidden" style={{ padding: "2rem" }}>

      {/* --- AMBIENT BACKGROUND GLOWS --- */}
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-red-600/5 blur-[100px] rounded-full pointer-events-none" />

      {/* --- TOP NAVIGATION TERMINAL --- */}
      <header className="mb-12">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-200 dark:border-gray-800 pb-8">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="h-2 w-2 bg-blue-600 rounded-full animate-pulse shadow-[0_0_10px_#2563eb]" />
              <span className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Authorized Session</span>
            </div>
            <h1 className="text-4xl font-black italic tracking-tighter uppercase">
              Welcome, <span className="text-blue-600">{user.username}</span>
            </h1>
          </div>

          <nav className="flex flex-wrap gap-3">
            {[
              { label: 'Profile Settings', href: 'authordiary/profile', color: 'blue' },
              { label: 'Post Approval', href: 'authordiary/approvalpage', color: 'red' },
              { label: 'Mobile Dashboard', href: 'authordiary/dashboard', color: 'blue' },
            ].map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className={`group relative px-6 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95`}
              >
                <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity bg-${link.color}-600`} />
                <span className="relative text-[11px] font-black uppercase tracking-widest group-hover:text-blue-500 transition-colors">
                  {link.label}
                </span>
                <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-blue-600 transition-all group-hover:w-full" />
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {/* --- MAIN CREATION FORM --- */}
      <main className="max-w-4xl">
        <div className="flex items-center gap-4 mb-8">
          <h2 className="text-xl font-black uppercase tracking-tighter italic">Create New Intel</h2>
          <div className="h-[1px] flex-1 bg-gradient-to-r from-gray-200 dark:from-gray-800 to-transparent" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">

          {/* Title Input */}
          <div className="relative group">
            <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block ml-1">Subject Title</label>
            <input
              type="text"
              placeholder="ENTER POST TITLE..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 p-4 rounded-2xl text-lg font-bold focus:border-blue-600 transition-all outline-none"
            />
          </div>

          {/* Message Area */}
          <div className="relative group">
            <div className="flex justify-between items-end mb-2 px-1">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400">Content Module</label>
              <div className="flex gap-2">
                {['[section]', '[h]', '[li]'].map(tag => (
                  <span key={tag} className="text-[8px] font-mono bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded text-blue-500 border border-blue-500/20">{tag}</span>
                ))}
              </div>
            </div>
            <textarea
              placeholder="Type your message here..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={10}
              className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 p-4 rounded-2xl font-medium focus:border-blue-600 transition-all outline-none"
            />
          </div>

          {/* Category & Media Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Archive Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 p-4 rounded-2xl font-bold outline-none focus:border-blue-600 transition-all appearance-none"
              >
                {["News", "Memes", "Videos/Edits", "Polls", "Gaming", "Review"].map(opt => (
                  <option key={opt} value={opt}>{opt.toUpperCase()}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">External Uplink</label>
              <input
                type="text"
                placeholder="TikTok / URL (optional)"
                value={mediaUrlLink}
                onChange={(e) => setMediaUrlLink(e.target.value)}
                disabled={uploading}
                className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 p-4 rounded-2xl font-bold outline-none focus:border-blue-600 transition-all"
              />
            </div>
          </div>

          {/* Media Upload Box */}
          <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl p-8 transition-all hover:border-blue-600/50 bg-gray-50/50 dark:bg-gray-900/50 text-center">
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              disabled={uploading}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <div className="text-3xl mb-2">📁</div>
              <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                {uploading ? "Uploading to Cloud..." : "Drop Media Files or Click to Upload"}
              </p>
            </label>

            {mediaUrl && (
              <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <p className="text-green-500 text-[10px] font-bold uppercase tracking-tighter">
                  Successfully Synced {mediaType}
                </p>
              </div>
            )}
          </div>

          {/* Poll System */}
          <div className={`p-6 rounded-3xl border-2 transition-all ${hasPoll ? 'border-blue-600 bg-blue-600/5' : 'border-gray-100 dark:border-gray-800'}`}>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${hasPoll ? 'bg-blue-600 border-blue-600' : 'border-gray-400'}`}>
                {hasPoll && <span className="text-white text-xs">✓</span>}
              </div>
              <input type="checkbox" className="hidden" checked={hasPoll} onChange={(e) => setHasPoll(e.target.checked)} />
              <span className="font-black uppercase tracking-widest text-[11px]">Deploy Poll Module</span>
            </label>

            {hasPoll && (
              <div className="mt-6 space-y-4 animate-in fade-in slide-in-from-top-2">
                <label className="flex items-center gap-2 opacity-70">
                  <input type="checkbox" checked={pollMultiple} onChange={(e) => setPollMultiple(e.target.checked)} />
                  <span className="text-[10px] font-bold uppercase">Enable Multi-Select</span>
                </label>

                {pollOptions.map((option, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      type="text"
                      value={option}
                      onChange={(e) => handlePollOptionChange(i, e.target.value)}
                      placeholder={`Option ${i + 1}`}
                      className="flex-1 bg-white dark:bg-black/40 border border-gray-200 dark:border-gray-700 p-3 rounded-xl font-bold"
                    />
                    {pollOptions.length > 2 && (
                      <button type="button" onClick={() => removePollOption(i)} className="p-3 text-red-500">✕</button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addPollOption}
                  className="w-full py-3 border-2 border-dashed border-blue-600/30 text-blue-600 text-[10px] font-black uppercase tracking-[.2em] rounded-xl hover:bg-blue-600/5"
                >
                  + Add Response Option
                </button>
              </div>
            )}
          </div>

          {/* Submit Action */}
          <button
            type="submit"
            disabled={loading || uploading}
            className="w-full group relative py-6 bg-blue-600 rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-blue-800 opacity-0 group-hover:opacity-100 transition-opacity" />
            <span className="relative text-white font-black italic uppercase tracking-[.3em] text-lg">
              {loading ? "Initializing..." : "Publish to Universe"}
            </span>
          </button>
        </form>
      </main>
    </div>
  );
};

export default Dashboard;

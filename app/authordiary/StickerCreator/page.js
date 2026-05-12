"use client";
import PlayerCard from "@/app/components/PlayerCard";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const StickerCreator = () => {
  const [user, setUser] = useState(null);

  // --- Asset Meta State ---
  const [assetCategory, setAssetCategory] = useState("sticker"); // ⚡️ ADDED: sticker, background, watermark
  const [stickerId, setStickerId] = useState(""); // Only used manually during Edit mode
  const [type, setType] = useState("free");
  const [tier, setTier] = useState("COMMON");
  const [price, setPrice] = useState(0);
  const [isAnimated, setIsAnimated] = useState(false);
  const [tags, setTags] = useState("");
  const [author, setAuthor] = useState("");
  const [packId, setPackId] = useState("");

  // --- ⚡️ Watermark Visual Config State ---
  const [wmRotation, setWmRotation] = useState("-15deg");
  const [wmOpacity, setWmOpacity] = useState(0.4);
  const [wmScale, setWmScale] = useState(1);

  // --- Management State ---
  const [stickers, setStickers] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [loadingVault, setLoadingVault] = useState(false);

  // --- File & Upload State ---
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const router = useRouter();

  // --- 🛰️ Protocol: Fetch Vault Assets ---
  const fetchVault = useCallback(async () => {
    setLoadingVault(true);
    try {
      const res = await fetch("/api/admin/stickers/process");
      const data = await res.json();
      if (data.success) {
        setStickers(data.stickers);
      }
    } catch (err) {
      toast.error("Vault sync failed.");
    } finally {
      setLoadingVault(false);
    }
  }, []);

  // --- Auth Check ---
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
        fetchVault();
      } catch {
        router.push("/auth/login");
      }
    };
    fetchUser();
  }, [router, fetchVault]);

  // --- File Handling (Multiple) ---
  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e.target.files);
    if (!selectedFiles.length) return;

    setFiles(selectedFiles);

    // Generate object URLs for all selected files
    const filePreviews = selectedFiles.map(file => ({
      url: URL.createObjectURL(file),
      name: file.name
    }));
    setPreviews(filePreviews);
  };

  // --- 🛠️ Action: Edit Asset (Forces Single Mode) ---
  const handleEdit = (sticker) => {
    setEditingId(sticker._id);
    setStickerId(sticker.stickerId);
    setAssetCategory(sticker.category || "sticker"); // ⚡️ ADDED: Load category
    setType(sticker.type);
    setTier(sticker.tier);
    setPrice(sticker.price);
    setIsAnimated(sticker.isAnimated || false);
    setTags(sticker.tags ? sticker.tags.join(", ") : "");
    setAuthor(sticker.author || "");
    setPackId(sticker.packId || "");

    // ⚡️ ADDED: Load watermark configs if they exist
    setWmRotation(sticker.visualConfig?.rotation || "-15deg");
    setWmOpacity(sticker.visualConfig?.opacity || 0.4);
    setWmScale(sticker.visualConfig?.scale || 1);

    setPreviews([{ url: sticker.url, name: "existing_asset" }]);
    setFiles([]);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    toast.info(`Editing Asset: ${sticker.stickerId}`);
  };

  // --- 🗑️ Action: Purge Asset ---
  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to purge this asset?")) return;
    try {
      const res = await fetch(`/api/admin/stickers/process?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        toast.success("Asset purged from system.");
        fetchVault();
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error("Purge protocol failed.");
    }
  };

  // --- 🚀 Action: Process & Upload ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!editingId && files.length === 0) {
      toast.error("Please provide at least one asset to inject.");
      return;
    }

    setLoading(true);
    setUploading(true);

    try {
      const meta = {
        action: editingId ? "update" : "create",
        targetId: editingId,
        stickerId, // Only strictly used during update
        category: assetCategory, // ⚡️ ADDED: Pass category to backend
        type,
        tier,
        price: Number(price),
        isAnimated,
        tags: tags.split(",").map(tag => tag.trim()).filter(tag => tag !== ""),
        author: author.trim(),
        packId: packId.trim().toLowerCase().replace(/\s+/g, '_'),
        // ⚡️ ADDED: Pass visual configs only if it's a watermark
        visualConfig: assetCategory === "watermark" ? {
          rotation: wmRotation,
          opacity: Number(wmOpacity),
          scale: Number(wmScale)
        } : undefined
      };

      const formData = new FormData();
      // Append all selected files
      files.forEach(file => {
        formData.append("files", file);
      });
      formData.append("metadata", JSON.stringify(meta));

      const res = await fetch("/api/admin/stickers/process", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (res.ok && data.success) {
        toast.success(editingId ? "Asset metadata patched!" : `${files.length} Asset(s) successfully injected!`);

        // Reset Form
        setStickerId("");
        setTags("");
        setFiles([]);
        setPreviews([]);
        setPrice(0);
        setEditingId(null);
        // Reset watermark configs to default
        setWmRotation("-15deg");
        setWmOpacity(0.4);
        setWmScale(1);
        // Intentionally keeping author, category, and packId for continuous flow
        fetchVault();
      } else {
        toast.error(data.error || "Asset processing failed.");
      }
    } catch (err) {
      console.log(err);
      toast.error("Critical error during asset upload.", err);
    } finally {
      setLoading(false);
      setUploading(false);
    }
  };

  // --- EXACT SYSTEM LOADING ANIMATION ---
  if (!user) {
    return (
      <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900 overflow-hidden relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-blue-600/10 blur-[120px] rounded-full"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-blue-500/20 blur-[60px] rounded-full animate-pulse"></div>
        <div className="flex flex-col items-center z-10">
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
          <div className="relative mb-6">
            <div className="h-20 w-20 rounded-full border-[3px] border-blue-600/10 border-t-blue-600 animate-spin"></div>
            <div className="absolute top-2 left-2 h-16 w-16 rounded-full border-[3px] border-transparent border-t-orange-500 animate-[spin_1.5s_linear_infinite_reverse]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 bg-white dark:bg-gray-900 rounded-full shadow-[0_0_10px_#2563eb]"></div>
          </div>
          <div className="text-center">
            <h2 className="text-xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white mb-1">Verifying Admin Access</h2>
            <div className="w-48 h-1 bg-gray-100 dark:bg-gray-800 rounded-full mt-4 overflow-hidden relative">
              <div className="absolute inset-y-0 left-0 bg-blue-600 w-1/2 animate-[loading_2s_ease-in-out_infinite] rounded-full shadow-[0_0_10px_#2563eb]"></div>
            </div>
            <div className="mt-4 flex flex-col gap-1">
              <p className="text-[8px] font-bold text-gray-400 uppercase tracking-[0.3em] animate-pulse">Establishing Encrypted Session...</p>
              <p className="text-[7px] font-mono text-gray-500/50 uppercase">Protocol: TLS_AES_256_GCM_SHA384</p>
            </div>
          </div>
        </div>
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

  const getTierColor = (t = tier) => {
    switch (t) {
      case "MYTHIC": return "bg-purple-500";
      case "LEGENDARY": return "bg-yellow-500";
      case "EPIC": return "bg-pink-500";
      case "RARE": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };

  const existingPacks = [...new Set(stickers.map(s => s.packId).filter(Boolean))];

  const groupedStickers = stickers.reduce((acc, sticker) => {
    const pId = sticker.packId || "UNGROUPED_ASSETS";
    if (!acc[pId]) acc[pId] = [];
    acc[pId].push(sticker);
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white relative overflow-hidden" style={{ padding: "2rem" }}>
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-green-600/5 blur-[100px] rounded-full pointer-events-none" />

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
              { label: 'Profile Settings', href: '/authordiary/profile', color: 'blue' },
              { label: 'Post Approval', href: '/authordiary/approvalpage', color: 'red' },
              { label: 'Asset Studio', href: '/authordiary/StickerCreator', color: 'green' }, // ⚡️ Renamed label
              { label: 'Mobile Dashboard', href: '/authordiary/dashboard', color: 'blue' },
            ].map((link) => (
              <Link key={link.label} href={link.href} className="group relative px-6 py-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl overflow-hidden transition-all hover:scale-105 active:scale-95">
                <span className="relative text-[11px] font-black uppercase tracking-widest group-hover:text-blue-500 transition-colors">{link.label}</span>
                <div className="absolute bottom-0 left-0 w-0 h-[2px] bg-blue-600 transition-all group-hover:w-full" />
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto space-y-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Left Side: Form */}
          <div>
            <div className="flex items-center gap-4 mb-8">
              <h2 className="text-xl font-black uppercase tracking-tighter italic">
                {editingId ? "Patching Protocol" : "Universal Asset Factory"}
              </h2>
              <div className="h-[1px] flex-1 bg-gradient-to-r from-gray-200 dark:from-gray-800 to-transparent" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">

              {/* ⚡️ ADDED: Asset Category Selector */}
              <div className="bg-gray-50 dark:bg-gray-900 p-2 rounded-2xl flex gap-2 border-2 border-gray-100 dark:border-gray-800">
                {["sticker", "background", "watermark"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setAssetCategory(cat)}
                    className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${assetCategory === cat
                      ? "bg-blue-600 text-white shadow-lg"
                      : "text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-800"
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              {/* Only show Asset ID input if editing a specific single asset */}
              {editingId ? (
                <div className="relative group">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block ml-1">Unique Asset ID</label>
                  <input
                    type="text"
                    value={stickerId}
                    onChange={(e) => setStickerId(e.target.value)}
                    required
                    className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 p-4 rounded-2xl text-lg font-bold focus:border-blue-600 transition-all outline-none"
                  />
                </div>
              ) : (
                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-500">
                    ℹ️ Asset IDs will be auto-generated based on Pack + Author + Filename
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Author Name</label>
                  <input
                    type="text"
                    placeholder="e.g. kaytee"
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 p-4 rounded-2xl font-bold outline-none"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Pack ID</label>
                  <input
                    type="text"
                    list="existing-packs"
                    placeholder="e.g. pack2"
                    value={packId}
                    onChange={(e) => setPackId(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 p-4 rounded-2xl font-bold outline-none"
                  />
                  <datalist id="existing-packs">
                    {existingPacks.map(pack => <option key={pack} value={pack} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Market Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 p-4 rounded-2xl font-bold outline-none appearance-none">
                    <option value="free">FREE TAB</option>
                    <option value="event">EVENT (OWNED)</option>
                    <option value="rent">RENT (SINGLE-USE)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Visual Tier</label>
                  <select value={tier} onChange={(e) => setTier(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 p-4 rounded-2xl font-bold outline-none appearance-none">
                    <option value="COMMON">COMMON</option>
                    <option value="RARE">RARE</option>
                    <option value="EPIC">EPIC</option>
                    <option value="LEGENDARY">LEGENDARY</option>
                    <option value="MYTHIC">MYTHIC</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Coin Price</label>
                  <input type="number" min="0" value={price} onChange={(e) => setPrice(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 p-4 rounded-2xl font-bold outline-none" />
                </div>
                <div className="space-y-2">
                  <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Search Tags</label>
                  <input type="text" placeholder="anime, epic..." value={tags} onChange={(e) => setTags(e.target.value)} className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 p-4 rounded-2xl font-bold outline-none" />
                </div>
              </div>

              {/* ⚡️ ADDED: Conditional Watermark Configs */}
              {assetCategory === "watermark" && (
                <div className="bg-gray-50 dark:bg-gray-900 p-5 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 space-y-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-blue-500">🎨 Watermark Visual Engine</span>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Rotation</label>
                      <input type="text" placeholder="-15deg" value={wmRotation} onChange={(e) => setWmRotation(e.target.value)} className="w-full bg-white dark:bg-[#0a0a0a] border-2 border-gray-100 dark:border-gray-800 p-3 rounded-xl text-xs font-bold outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Opacity (0-1)</label>
                      <input type="number" step="0.1" min="0" max="1" value={wmOpacity} onChange={(e) => setWmOpacity(e.target.value)} className="w-full bg-white dark:bg-[#0a0a0a] border-2 border-gray-100 dark:border-gray-800 p-3 rounded-xl text-xs font-bold outline-none" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[8px] font-black uppercase tracking-[0.2em] text-gray-400 ml-1">Scale</label>
                      <input type="number" step="0.1" value={wmScale} onChange={(e) => setWmScale(e.target.value)} className="w-full bg-white dark:bg-[#0a0a0a] border-2 border-gray-100 dark:border-gray-800 p-3 rounded-xl text-xs font-bold outline-none" />
                    </div>
                  </div>
                </div>
              )}

              <div className={`p-4 rounded-2xl border-2 transition-all ${isAnimated ? 'border-green-500 bg-green-500/5' : 'border-gray-100 dark:border-gray-800'}`}>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" className="hidden" checked={isAnimated} onChange={(e) => setIsAnimated(e.target.checked)} />
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center ${isAnimated ? 'bg-green-500 border-green-500' : 'border-gray-400'}`}>
                    {isAnimated && <span className="text-white text-xs">✓</span>}
                  </div>
                  <span className="font-black uppercase tracking-widest text-[11px]">Format: Animated WebP</span>
                </label>
              </div>

              <div className="border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-3xl p-8 hover:border-blue-600/50 bg-gray-50/50 dark:bg-gray-900/50 text-center relative">
                {/* Notice the 'multiple' attribute here */}
                <input type="file" accept="image/*" multiple onChange={handleFileChange} disabled={uploading} className="hidden" id="sticker-upload" />
                <label htmlFor="sticker-upload" className="cursor-pointer block">
                  <div className="text-3xl mb-2">🏷️</div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-gray-500">
                    {files.length > 0
                      ? `${files.length} ASSETS READY FOR INJECTION`
                      : editingId
                        ? "Click to swap current image (optional)"
                        : "Drop Images to Batch Process"}
                  </p>
                </label>
              </div>

              <div className="flex gap-4">
                <button type="submit" disabled={loading} className="flex-1 group relative py-6 bg-blue-600 rounded-2xl overflow-hidden transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50">
                  <span className="relative text-white font-black italic uppercase tracking-[.3em] text-lg">
                    {loading ? "PROCESSING..." : editingId ? "PATCH ASSET" : "INITIATE BATCH INJECTION"}
                  </span>
                </button>
                {editingId && (
                  <button type="button" onClick={() => { setEditingId(null); setPreviews([]); setFiles([]); setStickerId(""); setWmRotation("-15deg"); setWmOpacity(0.4); setWmScale(1); }} className="px-8 py-6 bg-red-500/10 border-2 border-red-500 text-red-500 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-red-500 hover:text-white transition-all">
                    CANCEL
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Right Side: Simulation */}
          <div className="flex flex-col items-center pt-8">
            <p className="text-[9px] font-black uppercase tracking-[0.3em] text-gray-400 mb-8 text-center">Batch Preview Simulation</p>

            {previews.length > 0 ? (
              assetCategory === "sticker" ? (
                /* 🟩 STANDARD STICKER GRID PREVIEW */
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 w-full bg-gray-100 dark:bg-[#111] p-6 rounded-3xl border-2 border-gray-200 dark:border-gray-800 shadow-2xl max-h-[600px] overflow-y-auto">
                  {previews.map((prev, idx) => (
                    <div key={idx} className="relative flex flex-col items-center justify-center gap-2 p-2 bg-white dark:bg-gray-900 rounded-xl overflow-hidden aspect-square">
                      <img
                        src={prev.url}
                        className="w-20 h-20 object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.2)]"
                        alt="Preview"
                      />
                      {!editingId && (
                        <p className="text-[7px] font-mono text-gray-400 truncate w-full text-center absolute bottom-2 z-10 bg-black/50 px-1 rounded">
                          {packId || 'pack'}_{author || 'anon'}_{prev.name.split('.')[0]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                /* 🚀 LIVE PLAYER CARD PREVIEW (For Backgrounds & Watermarks) */
                <div className="w-full flex flex-col items-center gap-12 bg-gray-100 dark:bg-[#111] p-6 rounded-3xl border-2 border-gray-200 dark:border-gray-800 shadow-2xl max-h-[600px] overflow-y-auto overflow-x-hidden">
                  {previews.map((prev, idx) => (
                    <div key={idx} className="flex flex-col items-center w-full">
                      {/* Scaled down slightly to fit well in the sidebar */}
                      <div className="scale-90 origin-top w-full flex justify-center">
                        <PlayerCard
                          username={user?.username || "TEST_SUBJECT"}
                          backgroundImg={assetCategory === 'background' ? prev.url : null}
                          watermarkImg={assetCategory === 'watermark' ? prev.url : null}
                          wmRotation={wmRotation}
                          wmOpacity={wmOpacity}
                          wmScale={wmScale}
                          isDark={true}
                        />
                      </div>
                      {!editingId && (
                        <p className="text-[10px] font-mono text-gray-500 truncate mt-[-20px] bg-black/50 px-3 py-1 rounded-full z-10">
                          {packId || 'pack'}_{author || 'anon'}_{prev.name.split('.')[0]}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )
            ) : (
              /* 🚫 EMPTY STATE */
              <div className="relative w-72 h-72 bg-gray-100 dark:bg-[#111] rounded-3xl flex items-center justify-center overflow-hidden border-2 border-gray-200 dark:border-gray-800 shadow-2xl">
                <div className="flex flex-col items-center opacity-30">
                  <span className="text-4xl mb-2">🚫</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">AWAITING ASSETS</span>
                </div>
              </div>
            )}

            {/* Meta Tags Output */}
            {previews.length > 0 && (
              <div className="mt-6 flex flex-col items-center gap-2">
                <div className="flex gap-2">
                  <span className={`px-4 py-1.5 bg-gray-800 border border-gray-600 text-white rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg`}>
                    {assetCategory}
                  </span>
                  <span className={`px-4 py-1.5 ${getTierColor()} text-white rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg`}>{tier}</span>
                  {type === "rent" && <span className="px-4 py-1.5 bg-yellow-500 text-black rounded-full text-[10px] font-black tracking-widest uppercase shadow-lg">{price} COINS</span>}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* --- SYSTEM VAULT: MANAGEMENT INTERFACE (GROUPED BY PACK) --- */}
        <section className="mt-24">
          <div className="flex items-center justify-between mb-8 border-b border-gray-200 dark:border-gray-800 pb-4">
            <h2 className="text-2xl font-black italic uppercase tracking-tighter">System Vault <span className="text-blue-600">[{stickers.length}]</span></h2>
            <button onClick={fetchVault} className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 hover:text-blue-600 transition-colors">Re-Sync Vault</button>
          </div>

          {loadingVault ? (
            <div className="py-20 text-center opacity-50 font-black uppercase tracking-widest">Scanning Database...</div>
          ) : (
            <div className="space-y-12">
              {Object.entries(groupedStickers).map(([pack, packStickers]) => (
                <div key={pack} className="bg-gray-50/50 dark:bg-gray-900/30 p-6 rounded-3xl border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-4 mb-6">
                    <h3 className="text-lg font-black uppercase tracking-widest text-gray-800 dark:text-gray-200">
                      {pack === "UNGROUPED_ASSETS" ? "⚠️ Ungrouped Assets" : `📦 Pack: ${pack}`}
                    </h3>
                    <span className="text-[10px] font-bold text-gray-500">({packStickers.length} Items)</span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                    {packStickers.map((sticker) => (
                      <div key={sticker._id} className="group relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl p-4 transition-all hover:border-blue-600/50 hover:shadow-lg hover:shadow-blue-500/10">
                        {/* ⚡️ ADDED: Category Badge */}
                        <div className="absolute top-2 left-2 z-20">
                          <span className="text-[7px] font-black uppercase tracking-widest bg-black/60 text-white px-1.5 py-0.5 rounded backdrop-blur-sm">
                            {sticker.category === 'background' ? 'BG' : sticker.category === 'watermark' ? 'WM' : 'STK'}
                          </span>
                        </div>
                        <div className={`mb-4 flex items-center justify-center relative overflow-hidden rounded-lg ${sticker.category === 'background' ? 'aspect-[9/16]' : 'aspect-square'}`}>
                          <div className={`absolute inset-0 blur-2xl opacity-10 ${getTierColor(sticker.tier)}`} />
                          <img
                            src={sticker.url}
                            className={`relative z-10 ${sticker.category === 'background' ? 'w-full h-full object-cover' : 'w-20 h-20 object-contain'}`}
                            style={sticker.category === 'watermark' ? {
                              transform: `rotate(${sticker.visualConfig?.rotation || '-15deg'}) scale(${sticker.visualConfig?.scale || 1})`,
                              opacity: sticker.visualConfig?.opacity || 0.4
                            } : {}}
                            alt={sticker.stickerId}
                          />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black uppercase truncate mb-1">{sticker.stickerId}</p>
                          <div className="flex justify-center gap-1 mb-3">
                            <span className={`text-[7px] px-2 py-0.5 rounded-full text-white font-bold ${getTierColor(sticker.tier)}`}>{sticker.tier}</span>
                          </div>
                          {sticker.author && <p className="text-[8px] text-gray-500 truncate mb-2 text-center">By: {sticker.author}</p>}
                          <div className="flex gap-2">
                            <button onClick={() => handleEdit(sticker)} className="flex-1 text-[8px] font-black bg-blue-600/10 text-blue-600 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-blue-600 hover:text-white">EDIT</button>
                            <button onClick={() => handleDelete(sticker._id)} className="flex-1 text-[8px] font-black bg-red-600/10 text-red-600 py-2 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 hover:text-white">PURGE</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
};

export default StickerCreator;
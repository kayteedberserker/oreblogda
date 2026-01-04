"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "react-toastify";

// --- 1. THE WEB PREVIEWER LOGIC ---
const parseMessageSections = (msg) => {
    const regex = /\[section\](.*?)\[\/section\]|\[h\](.*?)\[\/h\]|\[li\](.*?)\[\/li\]|\[source="(.*?)" text:(.*?)\]|\[br\]/gs;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(msg)) !== null) {
        if (match.index > lastIndex) {
            parts.push({ type: "text", content: msg.slice(lastIndex, match.index) });
        }
        if (match[1] !== undefined) parts.push({ type: "section", content: match[1].trim() });
        else if (match[2] !== undefined) parts.push({ type: "heading", content: match[2].trim() });
        else if (match[3] !== undefined) parts.push({ type: "listItem", content: match[3].trim() });
        else if (match[4] !== undefined) parts.push({ type: "link", url: match[4], content: match[5] });
        else parts.push({ type: "br" });
        lastIndex = regex.lastIndex;
    }
    if (lastIndex < msg.length) parts.push({ type: "text", content: msg.slice(lastIndex) });
    return parts;
};

const PostPreviewContent = ({ message }) => {
    const rawParts = parseMessageSections(message || "");
    const finalElements = [];
    let inlineBuffer = [];

    const flushInlineBuffer = (key) => {
        if (inlineBuffer.length > 0) {
            finalElements.push(
                <span key={`inline-${key}`} className="block whitespace-pre-wrap text-base leading-relaxed text-gray-800 dark:text-gray-200">
                    {inlineBuffer}
                </span>
            );
            inlineBuffer = [];
        }
    };

    rawParts.forEach((p, i) => {
        if (p.type === "text") {
            inlineBuffer.push(p.content);
        } else if (p.type === "br") {
            inlineBuffer.push(<br key={`br-${i}`} />);
        } else if (p.type === "link") {
            inlineBuffer.push(
                <a key={`link-${i}`} href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-500 font-bold underline hover:text-blue-600 transition-colors">
                    {p.content}
                </a>
            );
        } else {
            flushInlineBuffer(i);
            if (p.type === "heading") {
                finalElements.push(<h3 key={i} className="text-xl font-bold mt-4 mb-2 text-black dark:text-white">{p.content}</h3>);
            } else if (p.type === "listItem") {
                finalElements.push(
                    <div key={i} className="flex items-start ml-4 my-1">
                        <span className="mr-2 text-blue-500">•</span>
                        <span className="text-gray-700 dark:text-gray-300 text-base">{p.content}</span>
                    </div>
                );
            } else if (p.type === "section") {
                finalElements.push(
                    <blockquote key={i} className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 my-3 rounded-r-md border-l-4 border-blue-500 italic text-gray-700 dark:text-gray-300">
                        {p.content}
                    </blockquote>
                );
            }
        }
    });

    flushInlineBuffer("end");
    return <div className="space-y-1">{finalElements}</div>;
};

// --- 2. THE MAIN ADMIN PAGE ---
export default function AdminPendingPosts() {
    const [user, setUser] = useState(null);
    const [posts, setPosts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [btnLoading, setbtnLoading] = useState(false);
    const [previewingId, setPreviewingId] = useState(null); // Track which post is showing full preview
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
                if (data.user.role !== "Admin") {
                    router.push("/");
                    return;
                }
                setUser(data.user);
            } catch {
                router.push("/auth/login");
            }
        };
        fetchUser();
    }, [router]);

    useEffect(() => {
        if (user) fetchPendingPosts();
    }, [user]);

    const fetchPendingPosts = async () => {
        try {
            const res = await fetch("/api/admin/posts/pending");
            const data = await res.json();
            setPosts(data.posts || []);
        } catch (err) {
            toast.error("Failed to fetch posts");
        } finally {
            setLoading(false);
        }
    };

    const handleAction = async (postId, status) => {
        setbtnLoading(true);
        try {
            const res = await fetch(`/api/admin/posts/${postId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status }),
            });

            if (res.ok) {
                setPosts(posts.filter(p => p._id !== postId));
                toast.success(`Post has been ${status}`);
            }
        } catch (err) {
            toast.error("Action failed");
        } finally {
            setbtnLoading(false);
        }
    };

    if (loading) {
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
        <div className="min-h-screen bg-white p-6 dark:bg-[#0a0a0a] relative overflow-hidden">

            {/* AMBIENT HUD DECORATION */}
            <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-blue-600/5 blur-[120px] rounded-full pointer-events-none" />

            <div className="mx-auto max-w-5xl relative z-10">

                {/* --- TERMINAL HEADER --- */}
                <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-gray-100 dark:border-gray-800 pb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="h-1.5 w-1.5 bg-orange-500 rounded-full animate-pulse shadow-[0_0_8px_#f97316]" />
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-orange-500">Security Clearance Required</span>
                        </div>
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white flex items-center gap-4">
                            Pending Approval
                            <span className="bg-blue-600 text-white text-xs px-3 py-1 rounded-sm skew-x-[-12deg] not-italic tracking-widest">
                                {posts.length} FILES
                            </span>
                        </h1>
                    </div>
                </header>

                {posts.length === 0 ? (
                    <div className="rounded-3xl bg-gray-50 dark:bg-gray-900/50 p-16 text-center border-2 border-dashed border-gray-200 dark:border-gray-800">
                        <div className="text-4xl mb-4">🛡️</div>
                        <h3 className="text-xl font-black uppercase italic text-gray-400">Database Clean</h3>
                        <p className="text-gray-500 text-sm mt-2 font-medium">All transmissions have been processed. No pending intel.</p>
                    </div>
                ) : (
                    <div className="grid gap-10">
                        {posts.map((post) => (
                            <div key={post._id} className="group overflow-hidden rounded-3xl bg-white dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 hover:border-blue-600/50 transition-all shadow-xl shadow-black/5">

                                <div className="p-6 md:p-8">
                                    <div className="flex flex-wrap justify-between items-start mb-6 gap-4">
                                        <div className="flex-1 min-w-[200px]">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className="text-[9px] font-black uppercase tracking-widest bg-blue-600/10 text-blue-600 px-2 py-0.5 rounded">
                                                    {post.category}
                                                </span>
                                                <span className="text-[9px] font-mono text-gray-400">ID: {post._id.slice(-6).toUpperCase()}</span>
                                            </div>
                                            <h2 className="text-2xl font-black uppercase italic tracking-tighter text-gray-900 dark:text-white group-hover:text-blue-600 transition-colors">
                                                {post.title}
                                            </h2>
                                        </div>

                                        <button
                                            onClick={() => setPreviewingId(previewingId === post._id ? null : post._id)}
                                            className={`text-[10px] font-black tracking-[0.2em] px-5 py-2.5 rounded-xl border-2 transition-all ${previewingId === post._id
                                                    ? "bg-red-600 border-red-600 text-white"
                                                    : "bg-transparent border-gray-200 dark:border-gray-700 text-gray-500 hover:border-blue-600 hover:text-blue-600"
                                                }`}
                                        >
                                            {previewingId === post._id ? "CLOSE DOSSIER" : "VIEW INTEL"}
                                        </button>
                                    </div>

                                    <div className="md:flex gap-8">
                                        {post.mediaUrl && (
                                            <div className="relative h-56 w-full md:w-56 flex-shrink-0 mb-6 md:mb-0 group-hover:scale-[1.02] transition-transform">
                                                <div className="absolute inset-0 border-2 border-blue-600/20 rounded-2xl z-10 pointer-events-none" />
                                                <Image
                                                    src={post.mediaUrl}
                                                    alt="Preview"
                                                    fill
                                                    className="rounded-2xl object-cover grayscale-[0.5] group-hover:grayscale-0 transition-all"
                                                />
                                            </div>
                                        )}

                                        <div className="flex-1 flex flex-col justify-between">
                                            {previewingId === post._id ? (
                                                <div className="p-6 bg-gray-50 dark:bg-black/40 rounded-2xl border border-gray-200 dark:border-gray-700 animate-in fade-in zoom-in-95 duration-300">
                                                    <PostPreviewContent message={post.message} />
                                                </div>
                                            ) : (
                                                <div className="relative">
                                                    <p className="text-gray-600 dark:text-gray-400 font-medium leading-relaxed line-clamp-4 italic bg-gradient-to-b from-gray-600 dark:from-gray-300 to-transparent bg-clip-text text-transparent">
                                                        {post.message}
                                                    </p>
                                                    <div className="absolute bottom-0 left-0 w-full h-8 bg-gradient-to-t from-white dark:from-gray-900 to-transparent" />
                                                </div>
                                            )}

                                            <div className="mt-6 pt-6 border-t border-gray-50 dark:border-gray-800 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-black text-white">
                                                        {post.authorName?.charAt(0).toUpperCase()}
                                                    </div>
                                                    <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                                                        SENDER: <span className="text-gray-900 dark:text-white">{post.authorName}</span>
                                                    </p>
                                                </div>
                                                <span className="text-[10px] font-mono text-gray-500">TIMESTAMP: 2026_LOG</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* --- ACTION CONTROLS --- */}
                                <div className="flex border-t-2 border-gray-100 dark:border-gray-800">
                                    <button
                                        disabled={btnLoading}
                                        onClick={() => handleAction(post._id, "approved")}
                                        className="flex-1 group/btn py-6 flex items-center justify-center gap-3 bg-transparent hover:bg-green-600 transition-all border-r-2 border-gray-100 dark:border-gray-800 disabled:opacity-50"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-green-500 group-hover/btn:bg-white animate-pulse" />
                                        <span className="font-black italic uppercase tracking-[0.3em] text-green-600 group-hover/btn:text-white text-sm">
                                            {btnLoading ? "PROCESSING..." : "AUTHORIZE"}
                                        </span>
                                    </button>

                                    <button
                                        disabled={btnLoading}
                                        onClick={() => handleAction(post._id, "rejected")}
                                        className="flex-1 group/btn py-6 flex items-center justify-center gap-3 bg-transparent hover:bg-red-600 transition-all disabled:opacity-50"
                                    >
                                        <span className="w-2 h-2 rounded-full bg-red-500 group-hover/btn:bg-white" />
                                        <span className="font-black italic uppercase tracking-[0.3em] text-red-600 group-hover/btn:text-white text-sm">
                                            {btnLoading ? "TERMINATING..." : "REJECT"}
                                        </span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
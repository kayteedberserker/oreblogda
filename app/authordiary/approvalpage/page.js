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
            <div className="flex h-screen items-center justify-center bg-white dark:bg-[#0a0a0a]">
                <div className="flex flex-col items-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                    <p className="mt-4 text-gray-500 dark:text-gray-400">Verifying Admin Access...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 dark:bg-[#0a0a0a]">
            <div className="mx-auto max-w-5xl">
                <h1 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                    Pending Approval 
                    <span className="bg-blue-600 text-white text-xs px-2 py-1 rounded-full">{posts.length}</span>
                </h1>

                {posts.length === 0 ? (
                    <div className="rounded-lg bg-white p-10 text-center shadow dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
                        <p className="text-gray-500">No posts waiting for review. Good job!</p>
                    </div>
                ) : (
                    <div className="grid gap-8">
                        {posts.map((post) => (
                            <div key={post._id} className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
                                <div className="p-5">
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <span className="text-xs font-bold uppercase text-blue-500">{post.category}</span>
                                            <h2 className="text-xl font-bold text-gray-900 dark:text-white">{post.title}</h2>
                                        </div>
                                        <button 
                                            onClick={() => setPreviewingId(previewingId === post._id ? null : post._id)}
                                            className="text-xs bg-gray-100 dark:bg-gray-700 px-3 py-1.5 rounded-md font-bold hover:bg-blue-600 hover:text-white transition-colors"
                                        >
                                            {previewingId === post._id ? "CLOSE PREVIEW" : "OPEN PREVIEW"}
                                        </button>
                                    </div>

                                    <div className="md:flex gap-6">
                                        {post.mediaUrl && (
                                            <div className="relative h-44 w-full md:w-44 flex-shrink-0 mb-4 md:mb-0">
                                                <Image src={post.mediaUrl} alt="Preview" fill className="rounded-lg object-cover" />
                                            </div>
                                        )}
                                        <div className="flex-1">
                                            {previewingId === post._id ? (
                                                <div className="p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg border border-gray-100 dark:border-gray-700">
                                                    <PostPreviewContent message={post.message} />
                                                </div>
                                            ) : (
                                                <p className="text-gray-600 dark:text-gray-300 line-clamp-3 italic">
                                                    {post.message}
                                                </p>
                                            )}
                                            <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-700">
                                                <p className="text-sm text-gray-400">By: <span className="font-bold text-gray-600 dark:text-gray-200">{post.authorName}</span></p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex border-t border-gray-100 dark:border-gray-700">
                                    <button 
                                        disabled={btnLoading}
                                        onClick={() => handleAction(post._id, "approved")}
                                        className="flex-1 py-4 font-bold text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors border-r border-gray-100 dark:border-gray-700"
                                    >
                                        {btnLoading ? "APPROVING" : "APPROVE"}  
                                    </button>
                                    <button 
                                        disabled={btnLoading}
                                        onClick={() => handleAction(post._id, "rejected")}
                                        className="flex-1 py-4 font-bold text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                        {btnLoading ? "REJECTING" : "REJECT"}  
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
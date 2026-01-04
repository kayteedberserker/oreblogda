"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import useSWR from "swr";
import { motion, AnimatePresence } from "framer-motion";

export default function CommentSection({ postId }) {
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  const fetcher = (url) => fetch(url).then((res) => res.json());

  // SWR for comments
  const { data, mutate } = useSWR(`/api/posts/${postId}/comment`, fetcher, {
    revalidateOnFocus: false,
  });

  const comments = data?.comments || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !text.trim())
      return toast.error("Please fill in all fields.");

    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, text }),
      });

      const data = await res.json();
      if (res.ok) {
        mutate({ comments: [data.comment, ...comments] }, false);
        setText("");
        toast.success("Signal transmitted.");
      } else {
        toast.error(data.message || "Failed to send signal.");
      }
    } catch (err) {
      toast.error("Uplink error.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white/80 dark:bg-black/40 backdrop-blur-xl p-5 rounded-3xl border border-gray-100 dark:border-blue-900/30 shadow-2xl static md:sticky top-24 max-h-[85vh] flex flex-col overflow-hidden">
      
      {/* --- SECTION HEADER --- */}
      <div className="flex items-center justify-between mb-6 flex-none">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse" />
          <h2 className="text-sm font-black uppercase tracking-[0.3em] text-gray-900 dark:text-white">
            Comms_Feed
          </h2>
        </div>
        <span className="text-[9px] font-mono text-gray-400 uppercase tracking-widest">
          {comments.length} Signals
        </span>
      </div>

      {/* --- INPUT FORM --- */}
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-6 flex-none">
        <div className="relative">
          <input
            type="text"
            placeholder="OPERATOR_NAME"
            className="w-full p-3 rounded-xl border-2 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs font-bold tracking-widest text-gray-900 dark:text-white focus:border-blue-600 outline-none transition-all placeholder:text-gray-500"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="relative">
          <textarea
            placeholder="ENTER ENCRYPTED MESSAGE..."
            className="w-full p-3 rounded-xl border-2 dark:border-gray-800 bg-gray-50 dark:bg-gray-950 text-xs font-bold tracking-widest text-gray-900 dark:text-white focus:border-blue-600 outline-none transition-all placeholder:text-gray-500 resize-none"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
          />
        </div>

        <button
          aria-label="Post comment"
          type="submit"
          disabled={loading}
          className="group relative bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-xl overflow-hidden transition-all active:scale-95 disabled:opacity-70 shadow-lg shadow-blue-600/20"
        >
          <div className="relative z-10 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest">
            {loading ? (
              <>
                <div className="w-3 h-3 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                <span>Broadcasting...</span>
              </>
            ) : (
              "Transmit Message"
            )}
          </div>

          {/* LOADING ANIMATION BAR (User instruction followed) */}
          <div className={`absolute bottom-0 left-0 h-1 bg-white/40 transition-all duration-500 ${loading ? 'w-full animate-[loading_1.5s_infinite]' : 'w-0'}`} />
        </button>
      </form>

      {/* --- SCROLLABLE MESSAGES --- */}
      <div className="space-y-4 overflow-y-auto flex-1 pr-2 custom-scrollbar">
        <AnimatePresence initial={false}>
          {comments.length > 0 ? (
            comments.map((c, i) => (
              <div 
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="group relative border-l-2 border-gray-100 dark:border-gray-800 pl-4 py-1 hover:border-blue-600 transition-colors"
              >
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[11px] font-black text-blue-600 uppercase tracking-tighter">
                    {c.name}
                  </p>
                  <p className="text-[8px] font-mono text-gray-400">
                    {new Date(c.date || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed font-medium">
                  {c.text}
                </p>
                <div className="mt-2 h-[1px] w-full bg-gradient-to-r from-gray-100 dark:from-gray-800 to-transparent" />
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-10 opacity-40">
              <div className="w-8 h-8 border border-dashed border-gray-500 rounded-full animate-spin mb-3" />
              <p className="text-[10px] font-mono uppercase tracking-widest">Awaiting First Signal...</p>
            </div>
          )}
        </AnimatePresence>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(37, 99, 235, 0.2);
          border-radius: 20px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(37, 99, 235, 0.5);
        }

        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
"use client";

import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import useSWR from "swr";
// Assuming you have your UserContext mapped for the web
// import { useUser } from "../context/UserContext"; 

const API_URL = "https://oreblogda.com";

const fetcher = (url) => fetch(url).then(res => res.json());

// --- Inline Web Icons ---
const Icons = {
  Poll: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11V3H8v6H2v12h20V11h-6Zm-6-6h4v14h-4V5Zm-6 6h4v8H4v-8Zm16 8h-4v-6h4v6Z" /></svg>,
  ChevronRight: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
};

export default function Poll({ poll, postId, setPosts, readOnly = false }) {
  // const { user } = useUser(); // Uncomment when ready
  const pathname = usePathname() || "";
  const router = useRouter();

  const [selectedOptions, setSelectedOptions] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [deviceId, setDeviceId] = useState(null);

  // ✅ Route Check
  const isPostPage = pathname.includes("/post/");

  // --- SWR: live post (poll source of truth) ---
  const { data, mutate } = useSWR(
    postId ? `${API_URL}/api/posts/${postId}` : null,
    fetcher,
    {
      refreshInterval: 5000,
      revalidateOnFocus: true,
      dedupingInterval: 0,
    }
  );

  const livePoll = data?.poll || poll;

  const displayOptions = isPostPage
    ? livePoll?.options
    : livePoll?.options?.slice(0, 2);

  const hasMoreOptions = !isPostPage && livePoll?.options?.length > 2;

  // --- Fingerprint Initialization ---
  let fpPromise;
  async function getFingerprint() {
    if (!fpPromise) fpPromise = FingerprintJS.load();
    const fp = await fpPromise;
    const result = await fp.get();
    return result.visitorId;
  }

  useEffect(() => {
    getFingerprint().then(id => setDeviceId(id));
  }, []);

  // --- 🛡️ TWO-LAYER VOTE DETECTION (Web Adapted) ---
  useEffect(() => {
    if (!postId || !deviceId || typeof window === 'undefined') return;

    const localVoteKey = `voted_poll_${postId}`;

    // 1. Check local fast-memory first
    const hasVotedLocally = localStorage.getItem(localVoteKey) === 'true';

    // 2. Check server truth
    const hasVotedOnServer = livePoll?.voters?.includes(deviceId);

    if (hasVotedLocally || hasVotedOnServer) {
      setSubmitted(true);

      // Auto-sync: Rewrite local cache if the server knows they voted but cache is empty
      if (hasVotedOnServer && !hasVotedLocally) {
        localStorage.setItem(localVoteKey, 'true');
      }
    }
  }, [livePoll?.voters, deviceId, postId]);

  const handleOptionChange = (optionIndex) => {
    if (readOnly || submitted) return;

    if (livePoll.pollMultiple) {
      setSelectedOptions((prev) =>
        prev.includes(optionIndex)
          ? prev.filter((i) => i !== optionIndex)
          : [...prev, optionIndex]
      );
    } else {
      setSelectedOptions([optionIndex]);
    }
  };

  const handleVote = async (e) => {
    e.stopPropagation();
    if (readOnly || selectedOptions.length === 0 || !deviceId || loading) {
      if (!deviceId) {
        toast.error("Device ID not found. Initializing...");
      }
      return;
    }

    setLoading(true);
    const localVoteKey = `voted_poll_${postId}`;

    // ⚡️ INSTANT LOCK: Lock the UI and save locally immediately
    setSubmitted(true);
    localStorage.setItem(localVoteKey, 'true');

    // --- Optimistic UI update ---
    const optimisticPoll = {
      ...livePoll,
      options: livePoll.options.map((opt, i) =>
        selectedOptions.includes(i)
          ? { ...opt, votes: opt.votes + 1 }
          : opt
      ),
      voters: [...(livePoll.voters || []), deviceId],
    };

    mutate(
      (current) => ({ ...current, poll: optimisticPoll }),
      false
    );

    try {
      const res = await fetch(`${API_URL}/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vote",
          fingerprint: deviceId,
          payload: { selectedOptions },
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.message === "Already voted") {
          toast.info("Identification confirmed: Vote already recorded.");
        } else {
          throw new Error(result.message || "Uplink failed");
        }
      } else {
        // Update parent state if provided
        if (setPosts) {
          setPosts((prev) =>
            Array.isArray(prev)
              ? prev.map((p) => p._id === postId ? { ...p, ...(result.post || result) } : p)
              : prev
          );
        }
        toast.success("Vote encrypted and stored.");
      }

      mutate();

    } catch (err) {
      // 🚨 REVERT IF FAILED: Unlock UI and set local memory to false
      setSubmitted(false);
      localStorage.setItem(localVoteKey, 'false');

      toast.error("Signal lost. Try again.");
      mutate();
    } finally {
      setLoading(false);
    }
  };

  const totalVotes = livePoll?.options?.reduce((sum, opt) => sum + opt.votes, 0) || 0;

  if (!livePoll || !livePoll.options) return null;

  return (
    <div className="mt-6 p-5 md:p-6 bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-gray-200 dark:border-blue-900/30 rounded-[24px] shadow-xl relative overflow-hidden">

      {/* Mobile HUD Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-900 dark:text-white">
            Consensus_Protocol
          </span>
        </div>
        <span className="text-[9px] font-mono text-blue-600/60 uppercase">
          Total_Data: {totalVotes}
        </span>
      </div>

      <div className={`grid grid-cols-1 ${isPostPage ? 'sm:grid-cols-2' : ''} gap-4`}>
        {displayOptions.map((opt, i) => {
          const percentage = totalVotes ? ((opt.votes / totalVotes) * 100).toFixed(1) : 0;
          const isSelected = selectedOptions.includes(i);

          return (
            <motion.div
              key={i}
              whileHover={!submitted && !readOnly ? { scale: 1.01 } : {}}
              onClick={() => handleOptionChange(i)}
              className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${isSelected
                  ? "border-blue-600 bg-blue-600/5 dark:bg-blue-600/10"
                  : "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 hover:border-gray-300 dark:hover:border-gray-700"
                } ${readOnly || submitted ? 'cursor-default' : ''}`}
            >
              <div className="flex justify-between items-start mb-2 relative z-10">
                <div className="flex items-center gap-2 pr-4">
                  {!readOnly && !submitted && (
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-400'}`}>
                      {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  )}
                  <span className={`text-xs font-bold uppercase tracking-tight leading-snug ${isSelected ? 'text-blue-600' : 'text-gray-800 dark:text-gray-200'}`}>
                    {opt.text}
                  </span>
                </div>
                <span className="text-[10px] font-mono font-bold text-blue-600 shrink-0">{percentage}%</span>
              </div>

              {/* Progress Bar Background */}
              <div className="w-full bg-gray-200 dark:bg-gray-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  style={{ width: `${percentage}%` }}
                  className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)] transition-all duration-1000 ease-out"
                />
              </div>

              <div className="mt-2 flex justify-between items-center text-[9px] font-mono text-gray-400 relative z-10">
                <span>Data_Points: {opt.votes}</span>
                {isSelected && (
                  <div className="flex items-center gap-1">
                    <div className="w-1 h-1 bg-blue-600 rounded-full animate-pulse" />
                    <span className="text-blue-600 font-black tracking-tighter uppercase">ACTIVE_SELECTION</span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* ✅ Check More Options Trigger (Only in Feed) */}
      {hasMoreOptions && (
        <Link href={`/post/${postId}`} className="group block mt-4 pt-4 border-t border-gray-100 dark:border-gray-800/50">
          <div className="flex items-center justify-center gap-2 text-blue-500 group-hover:text-blue-400 transition-colors">
            <Icons.Poll />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Check {livePoll.options.length - 2} more options
            </span>
            <div className="group-hover:translate-x-1 transition-transform">
              <Icons.ChevronRight />
            </div>
          </div>
        </Link>
      )}

      {!readOnly && !submitted && (
        <div className="mt-6">
          <button
            onClick={handleVote}
            disabled={loading || selectedOptions.length === 0}
            className="group relative w-full h-12 bg-gray-900 dark:bg-white rounded-xl flex items-center justify-center overflow-hidden shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <div className="relative z-10 flex items-center gap-3">
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-current border-t-transparent text-white dark:text-black rounded-full animate-spin" />
                  <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white dark:text-black">Processing_Vote...</span>
                </>
              ) : (
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white dark:text-black">
                  Transmit Selection
                </span>
              )}
            </div>

            {/* Mobile Loading Bar Animation */}
            <div className={`absolute bottom-0 left-0 h-1 bg-blue-600 transition-all duration-300 ${loading ? 'w-full animate-[loading_2s_infinite]' : 'w-0'}`} />
          </button>

          {loading && (
            <p className="text-[8px] font-mono text-blue-500 text-center mt-2 animate-pulse uppercase m-0">
              Encrypting Choice / Sending to Network...
            </p>
          )}
        </div>
      )}

      <AnimatePresence>
        {submitted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center gap-2"
          >
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
            <span className="text-[9px] font-black uppercase tracking-widest text-green-600">
              Verification Complete: Vote Logged
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <style dangerouslySetInnerHTML={{
        __html: `
                @keyframes loading {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }
            `}} />
    </div>
  );
}
"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import FingerprintJS from "@fingerprintjs/fingerprintjs";
import { motion, AnimatePresence } from "framer-motion";

export default function Poll({ poll, postId, setPosts, readOnly = false }) {
  const [selectedOptions, setSelectedOptions] = useState([]);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleOptionChange = (optionIndex) => {
    if (readOnly || submitted) return;
    if (poll.pollMultiple) {
      setSelectedOptions((prev) =>
        prev.includes(optionIndex)
          ? prev.filter((i) => i !== optionIndex)
          : [...prev, optionIndex]
      );
    } else {
      setSelectedOptions([optionIndex]);
    }
  };

  let fpPromise;
  async function getFingerprint() {
    if (!fpPromise) fpPromise = FingerprintJS.load();
    const fp = await fpPromise;
    const result = await fp.get();
    return result.visitorId;
  }

  const handleVote = async () => {
    if (readOnly || selectedOptions.length === 0) return;
    setLoading(true);

    try {
      const res = await fetch(`/api/posts/${postId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "vote",
          fingerprint: await getFingerprint(),
          payload: { selectedOptions },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.message === "Already voted") {
          toast.info("Identification confirmed: Vote already recorded.");
          setSubmitted(true);
        } else {
          toast.error(data.message || "Uplink failed");
        }
        return;
      }

      if (data.message === "Vote added") {
        setPosts((prev) =>
          Array.isArray(prev)
            ? prev.map((p) =>
                p._id === postId ? { ...p, ...(data.post || data) } : p
              )
            : prev
        );
        setSubmitted(true);
        toast.success("Vote encrypted and stored.");
      }
    } catch {
      toast.error("Signal lost. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes, 0);

  return (
    <div className="mt-6 p-5 md:p-6 bg-white/50 dark:bg-black/40 backdrop-blur-xl border border-gray-100 dark:border-blue-900/30 rounded-3xl shadow-xl overflow-hidden relative">
      
      {/* HUD Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-ping" />
          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-gray-900 dark:text-white">
            Consensus_Protocol
          </h4>
        </div>
        <span className="text-[9px] font-mono text-blue-600/60 uppercase">
          Total_Data: {totalVotes}
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {poll.options.map((opt, i) => {
          const percentage = totalVotes ? ((opt.votes / totalVotes) * 100).toFixed(1) : 0;
          const isSelected = selectedOptions.includes(i);

          return (
            <div 
              key={i} 
              whileHover={!submitted && !readOnly ? { scale: 1.02 } : {}}
              onClick={() => handleOptionChange(i)}
              className={`relative p-4 rounded-2xl border-2 transition-all cursor-pointer overflow-hidden ${
                isSelected 
                ? "border-blue-600 bg-blue-600/5 dark:bg-blue-600/10" 
                : "border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50 hover:border-gray-300 dark:hover:border-gray-700"
              }`}
            >
              <div className="flex justify-between items-start mb-2 relative z-10">
                <div className="flex items-center gap-2">
                  {!readOnly && !submitted && (
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? 'border-blue-600 bg-blue-600' : 'border-gray-400'}`}>
                      {isSelected && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                    </div>
                  )}
                  <span className="text-xs font-bold uppercase tracking-tight text-gray-800 dark:text-gray-200">{opt.text}</span>
                </div>
                <span className="text-[10px] font-mono font-bold text-blue-600">{percentage}%</span>
              </div>

              {/* Progress Bar Background */}
              <div className="w-full bg-gray-200 dark:bg-gray-800 h-1.5 rounded-full mt-3 overflow-hidden">
                <div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="h-full bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                />
              </div>
              
              <div className="mt-2 flex justify-between items-center text-[9px] font-mono text-gray-400 relative z-10">
                <span>Votes: {opt.votes}</span>
                {isSelected && <span className="text-blue-600 animate-pulse">SELECTED</span>}
              </div>
            </div>
          );
        })}
      </div>

      {!readOnly && !submitted && (
        <button
          onClick={(e) => { e.stopPropagation(); handleVote(); }}
          disabled={loading || selectedOptions.length === 0}
          className="group relative w-full mt-6 py-4 bg-gray-900 dark:bg-white text-white dark:text-black rounded-xl overflow-hidden shadow-lg transition-all active:scale-95 disabled:opacity-50"
        >
          <div className="relative z-10 flex items-center justify-center gap-3">
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                <span className="text-[10px] font-black uppercase tracking-[0.2em]">Processing_Vote...</span>
              </>
            ) : (
              <span className="text-[10px] font-black uppercase tracking-[0.2em]">Transmit Selection</span>
            )}
          </div>

          {/* User Instruction: Loading Animation */}
          <div className={`absolute bottom-0 left-0 h-1 bg-blue-600 transition-all duration-300 ${loading ? 'w-full animate-[loading_2s_infinite]' : 'w-0'}`} />
        </button>
      )}

      {submitted && (
        <div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-3 bg-green-500/10 border border-green-500/20 rounded-xl flex items-center justify-center gap-2"
        >
          <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
          <p className="text-[10px] font-black uppercase tracking-widest text-green-600">Verification Complete: Vote Logged</p>
        </div>
      )}

      <style jsx>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
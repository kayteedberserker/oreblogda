"use client";
import useSWR from "swr";
import Link from "next/link";
import Poll from "./Poll";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";

const FooterAds = dynamic(() => import("./FooterAds"), {
  ssr: false,
});

const fetcher = (url) => fetch(url).then((res) => res.json());

export default function RecentPollsCard() {
  const { data, error, isLoading } = useSWR(
    "/api/posts?category=Polls&page=1&limit=2",
    fetcher,
    { refreshInterval: 10000 } // refetch every 10s
  );

  const polls = Array.isArray(data) ? data : data?.posts || [];

  // --- LOADING STATE WITH ANIMATION ---
  if (isLoading) return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4 bg-white/50 dark:bg-black/20 backdrop-blur-md rounded-3xl border border-dashed border-blue-600/30">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-4 border-blue-600/20 rounded-full" />
        <div className="absolute inset-0 border-4 border-t-blue-600 rounded-full animate-spin" />
      </div>
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-blue-600 animate-pulse">
        Fetching_Directives...
      </p>
    </div>
  );

  if (error) return (
    <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-3xl text-center">
      <p className="text-[10px] font-black uppercase tracking-widest text-red-500">Uplink_Failure</p>
    </div>
  );

  return (
    <div className="bg-white/80 dark:bg-black/40 backdrop-blur-xl p-5 rounded-[2rem] border border-gray-100 dark:border-blue-900/20 shadow-2xl max-h-[60vh] md:max-h-[80vh] flex flex-col relative overflow-hidden group">
      
      {/* --- HEADER --- */}
      <div className="flex items-center justify-between mb-6 flex-none">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-600 rounded-full animate-pulse shadow-[0_0_8px_#2563eb]" />
          <h2 className="text-xs font-black uppercase tracking-[0.2em] text-gray-900 dark:text-white">
            Live_Consensus
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
            <span className="block w-1 h-1 bg-green-500 rounded-full" />
            <span className="text-[8px] font-mono text-gray-400 uppercase tracking-tighter">Live_Stream</span>
        </div>
      </div>

      {/* --- POLL LIST --- */}
      <div className="space-y-6 overflow-y-auto flex-1 pr-2 custom-scrollbar">
        {polls.length > 0 ? (
          <ul className="space-y-8 pb-4">
            {polls.map((poll) => (
              <motion.li
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                key={poll._id}
                className="relative group/item"
              >
                {/* Visual Connector */}
                <div className="absolute -left-3 top-0 bottom-0 w-[1px] bg-gradient-to-b from-blue-600/50 via-transparent to-transparent" />

                <p className="text-xs font-bold leading-relaxed text-gray-800 dark:text-gray-200 mb-4 px-1">
                  <span className="text-blue-600 mr-2">#</span>
                  {poll.message.length > 60
                    ? poll.message.slice(0, 60) + "..."
                    : poll.message}
                </p>

                <div className="bg-gray-50/50 dark:bg-gray-950/50 rounded-2xl border border-gray-100 dark:border-gray-800 p-1">
                    <Poll
                        poll={poll.poll}
                        postId={poll._id}
                        readOnly={false}
                    />
                </div>

                <div className="mt-3 flex justify-end">
                    <Link
                        href={`/post/${poll.slug}`}
                        className="inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-blue-600 hover:text-blue-500 transition-colors"
                    >
                        Access Full File
                        <span className="text-xs">→</span>
                    </Link>
                </div>
              </motion.li>
            ))}
          </ul>
        ) : (
          <div className="py-12 text-center opacity-30">
            <p className="text-[10px] font-mono uppercase tracking-[0.3em]">No_Active_Directives</p>
          </div>
        )}
      </div>

      {/* --- FOOTER DECOR --- */}
      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800 flex justify-between items-center opacity-40 flex-none">
         <span className="text-[8px] font-mono uppercase tracking-widest">Auto_Refresh: 10s</span>
         <span className="text-[8px] font-mono uppercase tracking-widest italic">Oreblogda_HQ</span>
      </div>

      <style jsx>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background-color: rgba(37, 99, 235, 0.2);
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background-color: rgba(37, 99, 235, 0.5);
        }
      `}</style>
    </div>
  );
}
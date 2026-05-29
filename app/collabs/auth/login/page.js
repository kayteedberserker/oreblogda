"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "react-toastify";

export default function CollabsLogin() {
    const [uid, setUid] = useState("");
    const [pin, setPin] = useState("");
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            const res = await fetch("/api/collabs/auth/me", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid, pin }),
            });

            const data = await res.json();

            if (res.ok) {
                // 🍪 Client-Side Cookie Storage Strategy
                // Extracts the root domain dynamically so the cookie works across all subdomains
                const token = data.token || data.jwt;

                if (token) {
                    const hostname = window.location.hostname;
                    const domainParts = hostname.split(".");

                    // If running on local or an IP, skip the wildcard dot attribute
                    const cookieDomain = domainParts.length > 2
                        ? `.${domainParts.slice(-2).join(".")}`
                        : hostname;

                    // 🔄 SYNCED: Key changed to 'collabs_token' to line up with middleware verification checks
                    document.cookie = `collabs_token=${token}; path=/; domain=${cookieDomain}; max-age=604800; SameSite=Lax; Secure`;
                }

                toast.success("Identity verified. Welcome back to the Node.");
                router.push("/");
            } else {
                toast.error(data.error || data.message || "Access denied. Invalid credentials.");
            }
        } catch (err) {
            toast.error("Uplink failed. Network connection error.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-white dark:bg-[#0a0a0a] px-4 relative overflow-hidden">
            {/* Visual HUD background styling elements */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-indigo-600/5 blur-[120px] rounded-full pointer-events-none"></div>

            <div className="w-full max-w-md z-10">
                {/* HUD Header Status Block */}
                <div className="flex flex-col items-center mb-8 text-center">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="h-2 w-2 rounded-full bg-indigo-600 animate-pulse shadow-[0_0_8px_#4f46e5]"></span>
                        <span className="text-[9px] font-black uppercase tracking-[0.25em] text-indigo-500">Secure Node Authorization</span>
                    </div>
                    <h1 className="text-3xl font-black italic uppercase tracking-tighter text-gray-900 dark:text-white">
                        System Portal
                    </h1>
                    <p className="text-xs text-gray-400 mt-1 uppercase font-semibold tracking-wider">
                        Collabs Subdomain Uplink
                    </p>
                </div>

                {/* Login Terminal Core Layout */}
                <div className="bg-gray-50/50 dark:bg-gray-900/40 border border-gray-100 dark:border-gray-800/80 p-8 rounded-3xl backdrop-blur-md">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-400 block mb-2 ml-1">
                                Node Identity (UID)
                            </label>
                            <input
                                type="text"
                                required
                                value={uid}
                                onChange={(e) => setUid(e.target.value)}
                                disabled={loading}
                                placeholder="ENTER YOUR APP UID"
                                className="w-full bg-white dark:bg-black/40 border-2 border-gray-100 dark:border-gray-800/60 p-4 rounded-xl font-bold focus:border-indigo-600 transition-all outline-none placeholder:text-gray-300 dark:placeholder:text-gray-700"
                            />
                        </div>

                        <div>
                            <label className="text-[9px] font-black uppercase tracking-[0.15em] text-gray-400 block mb-2 ml-1">
                                Secure Keyphrase (PIN)
                            </label>
                            <input
                                type="password"
                                required
                                value={pin}
                                onChange={(e) => setPin(e.target.value)}
                                disabled={loading}
                                placeholder="••••"
                                className="w-full bg-white dark:bg-black/40 border-2 border-gray-100 dark:border-gray-800/60 p-4 rounded-xl font-bold focus:border-indigo-600 transition-all outline-none placeholder:text-gray-300 dark:placeholder:text-gray-700"
                            />
                        </div>

                        {/* Submit Execution Action with integrated processing UI wrapper */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full group relative py-4 bg-indigo-600 rounded-xl overflow-hidden transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-60 shadow-lg shadow-indigo-600/10"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-700 opacity-0 group-hover:opacity-100 transition-opacity" />
                            <div className="relative flex items-center justify-center gap-3">
                                {loading && (
                                    <div className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin"></div>
                                )}
                                <span className="text-white font-black italic uppercase tracking-[0.2em] text-sm">
                                    {loading ? "Authenticating Matrix..." : "Establish Connection"}
                                </span>
                            </div>
                        </button>
                    </form>
                </div>

                <div className="text-center mt-6">
                    <p className="text-[8px] font-mono text-gray-400/60 uppercase">
                        Access Restricted // Tracking Protocol Active ID_LOG_v4
                    </p>
                </div>
            </div>
        </div>
    );
}
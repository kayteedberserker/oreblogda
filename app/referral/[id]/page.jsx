"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ReferralPage() {
    const params = useParams();
    const referralId = params?.id; // Pure JS: Removed the "as string" type assertion

    const [copied, setCopied] = useState(false);
    const [deviceOS, setDeviceOS] = useState("desktop"); // Pure JS: Removed the < "ios" | ... > generic types

    // Detect platform for tailored store routing
    useEffect(() => {
        const ua = navigator.userAgent.toLowerCase();
        if (/iphone|ipad|ipod/.test(ua)) {
            setDeviceOS("ios");
        } else if (/android/.test(ua)) {
            setDeviceOS("android");
        }
    }, []);

    const handleClaimRewards = async () => {
        if (!referralId) return;

        // 1. Copy to clipboard automatically so your app's useEffect reads it instantly
        try {
            await navigator.clipboard.writeText(referralId);
            setCopied(true);
        } catch (err) {
            console.error("Failed to copy code to clipboard:", err);
        }

        // 2. Short delay so they see the "Copied/Claimed" effect before redirecting
        setTimeout(() => {
            if (deviceOS === "ios") {
                // TODO: Replace with your actual App Store link
                window.location.href = "https://apps.apple.com/app/id123456789";
            } else if (deviceOS === "android") {
                window.location.href = `https://play.google.com/store/apps/details?id=com.kaytee.oreblogda&referrer=${referralId}`;
            } else {
                // Desktop fallback
                window.location.href = "https://play.google.com/store/apps/details?id=com.kaytee.oreblogda";
            }
        }, 1200);
    };

    return (
        <div className="min-h-screen bg-[#0a0a0c] text-white flex flex-col items-center justify-center p-6 relative overflow-hidden font-sans">

            {/* Ambient Background Glows */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-[#eab308]/10 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none" />

            {/* Main Content Box */}
            <div className="w-full max-w-md bg-[#111217] border border-[#1f2833] rounded-[35px] p-8 text-center relative z-10 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">

                {/* Active Tag */}
                <div className="inline-flex items-center gap-2 bg-[#0a0a0c] border border-[#2a2d3d] px-4 py-1.5 rounded-full mb-8">
                    <span className="w-2 h-2 rounded-full bg-[#eab308] animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                        Spirit Active
                    </span>
                </div>

                {/* Main Heading */}
                <h1 className="text-4xl font-extrabold tracking-tighter uppercase italic mb-2">
                    Aura <span className="text-[#eab308]">Resonance</span>
                </h1>
                <p className="text-xs text-gray-400 max-w-xs mx-auto mb-8 tracking-wide">
                    You have been summoned to link spirits and unlock exclusive tier rewards.
                </p>

                {/* Referral Code Display */}
                <div className="bg-black/40 border border-[#1f2833] border-dashed rounded-[24px] p-6 mb-8">
                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-[0.3em] mb-2">
                        Summoning Signature
                    </p>
                    <div className="text-2xl font-black tracking-[0.15em] text-white select-all font-mono">
                        {referralId || "ORE-UNKNOWN"}
                    </div>
                </div>

                {/* CENTER BUTTON */}
                <button
                    onClick={handleClaimRewards}
                    disabled={copied}
                    className="w-full py-5 rounded-[22px] font-black uppercase italic tracking-[0.15em] text-[15px] transition-all duration-300 relative overflow-hidden group active:scale-[0.98]"
                    style={{
                        backgroundColor: copied ? "#22c55e" : "#eab308",
                        boxShadow: copied
                            ? "0 10px 25px rgba(34, 197, 94, 0.3)"
                            : "0 10px 25px rgba(234, 179, 8, 0.25)"
                    }}
                >
                    <span className="relative z-10 flex items-center justify-center gap-2 text-black">
                        {copied ? (
                            <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                                </svg>
                                Code Linked! Opening App...
                            </>
                        ) : (
                            <>
                                <svg className="w-5 h-5 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364-6.364l-.707.707M6.343 17.657l-.707.707m12.728 0l-.707-.707M6.343 6.343l-.707-.707M12 8a4 4 0 100 8 4 4 0 000-8z" />
                                </svg>
                                Accept Invite
                            </>
                        )}
                    </span>
                    <div className="absolute inset-0 w-full h-full bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </button>

                {/* Value Perks Grid */}
                <div className="mt-8 pt-8 border-t border-[#1f2833]/60 grid grid-cols-3 gap-2">
                    <div className="p-3 bg-[#16171d] rounded-2xl border border-[#1f2833]/40">
                        <div className="text-[#eab308] text-sm font-black italic">+20</div>
                        <div className="text-[9px] uppercase font-bold text-gray-500 tracking-wider mt-0.5">Aura</div>
                    </div>
                    <div className="p-3 bg-[#16171d] rounded-2xl border border-[#1f2833]/40">
                        <div className="text-[#eab308] text-sm font-black italic">50</div>
                        <div className="text-[9px] uppercase font-bold text-gray-500 tracking-wider mt-0.5">OC Coins</div>
                    </div>
                    <div className="p-3 bg-[#16171d] rounded-2xl border border-[#1f2833]/40">
                        <div className="text-[#ef4444] text-sm font-black italic">2X</div>
                        <div className="text-[9px] uppercase font-bold text-gray-500 tracking-wider mt-0.5">Boost</div>
                    </div>
                </div>

                <p className="text-[9px] text-gray-500 mt-6 font-medium">
                    * Clicking automatically copies your code for instant activation on game launch.
                </p>
            </div>
        </div>
    );
}
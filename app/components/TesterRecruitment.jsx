"use client";
import React, { useState } from 'react';

const features = [
    {
        title: "SYSTEM_LINK_START",
        desc: "Welcome to Oreblogda. THE SYSTEM has initialized your neural link. Sync your profile to begin sharing intel with the collective.",
        intel: "THE_SYSTEM: INITIALIZING",
        color: "#6366f1"
    },
    {
        title: "INTEL_SUBMISSION",
        desc: "Submit your posts to the archives. THE SYSTEM will analyze and verify every entry. You will receive a notification from THE SYSTEM once your intel is APPROVED or REJECTED.",
        intel: "PROTOCOL: SYSTEM_VERIFICATION",
        color: "#60a5fa"
    },
    {
        title: "STREAK_STABILITY",
        desc: "Maintain your daily flame ⚡. THE SYSTEM monitors your consistency. Failure to provide intel every 48hrs will result in a SYSTEM_RESET of your streak.",
        intel: "STATUS: STREAK_MONITOR",
        color: "#f59e0b"
    },
    {
        title: "PROGRESSION_PATH",
        desc: "THE SYSTEM has defined your evolution: Novice (0+), Writer (50+), Elite (120+), to Master Writer (200+). Rise through the ranks to gain prestige.",
        intel: "DATA: EVOLUTION_LOGIC",
        color: "#10b981"
    },
    {
        title: "GLOBAL_RANKING",
        desc: "The top 200 operatives are recorded by THE SYSTEM. Earn your MEDAL by staying consistent. High-ranking writers are granted ultimate authority.",
        intel: "RANKING: SYSTEM_LEADERBOARD",
        color: "#fbbf24"
    },
    {
        title: "INTEGRITY_CHECK",
        desc: "THE SYSTEM does not tolerate SPAM or corrupted data. Ensure your posts add value. Protocol violations will lead to SYSTEM_RESTRICTIONS.",
        intel: "SECURITY: SYSTEM_SHIELD",
        color: "#f87171"
    }
];

const TesterRecruitment = () => {
    const [email, setEmail] = useState('');
    const [number, setNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);
    const [featureIndex, setFeatureIndex] = useState(0);
    const [showFeatures, setShowFeatures] = useState(false);

    const nextFeature = () => setFeatureIndex((prev) => (prev + 1) % features.length);
    const prevFeature = () => setFeatureIndex((prev) => (prev - 1 + features.length) % features.length);

    const handleJoin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        try {
            const res = await fetch('/api/testers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, number }),
            });
            const data = await res.json();
            let responseText = "";
            // System-style response
            if (number !== "") {
                responseText = res.ok 
                ? "ACCESS GRANTED. THE SYSTEM HAS RECORDED YOUR INTEL. YOU WILL RECEIVE A MESSAGE INCLUDING THE PLAY STORE DOWNLOAD LINK." 
                : (data.message || "SYSTEM ERROR. RETRY SUBMISSION.");  
            }else{
                responseText = res.ok 
                ? "ACCESS GRANTED. THE SYSTEM HAS RECORDED YOUR INTEL. YOU WILL RECEIVE A MAIL INCLUDING THE PLAY STORE DOWNLOAD LINK. PLEASE NOTE THAT PROVIDING A PHONE NUMBER ENHANCES YOUR OPERATIONAL CAPABILITIES." 
                : (data.message || "SYSTEM ERROR. RETRY SUBMISSION.");  
            }
            setMessage({ type: res.ok ? 'success' : 'error', text: responseText });
            if (res.ok) setEmail(''); setNumber('');
        } catch (err) {
            setMessage({ type: 'error', text: "SYSTEM_OFFLINE. CONNECTION TO THE SYSTEM LOST." });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="sticky top-0 z-[100] bg-slate-900 border-b-2 border-blue-500 w-full shadow-[0_4px_20px_rgba(0,0,0,0.8)]">
            <div className="max-w-6xl mx-auto px-4 py-4">
                <div className="flex flex-col gap-4">
                    
                    {/* Header Area */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-3 w-3 bg-red-500 animate-ping rounded-full" />
                                <h2 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter italic">
                                    THE SYSTEM: BETA RECRUITMENT
                                </h2>
                            </div>
                            <p className="text-sm md:text-lg text-slate-300 font-medium leading-tight">
                                THE SYSTEM is seeking <span className="text-blue-400 font-bold underline underline-offset-4">Elite Beta Testers</span> for the Android App. Submit your email to begin your trial.
                            </p>
                        </div>

                        {/* Call to Action Button for Features */}
                        <button 
                            onClick={() => setShowFeatures(!showFeatures)}
                            className={`px-6 py-3 rounded-lg font-black text-sm uppercase tracking-widest transition-all border-2 ${
                                showFeatures 
                                ? "bg-slate-800 border-slate-600 text-slate-400" 
                                : "bg-blue-600 border-blue-400 text-white animate-bounce shadow-[0_0_20px_rgba(59,130,246,0.6)]"
                            }`}
                        >
                            {showFeatures ? "[ CLOSE_INTEL ]" : "[ VIEW_SYSTEM_FEATURES ]"}
                        </button>
                    </div>

                    {/* Feature Carousel (Toggled) */}
                    {showFeatures && (
                        <div className="bg-slate-950 border border-blue-900/50 rounded-xl p-5 transition-all animate-in slide-in-from-top-2">
                            <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                                <span className="text-sm font-mono text-blue-500 font-bold">{features[featureIndex].intel}</span>
                                <span className="text-sm font-mono text-slate-500">{featureIndex + 1} / {features.length}</span>
                            </div>
                            
                            <div className="min-h-[100px] flex flex-col justify-center">
                                <h3 className="text-lg md:text-xl font-black uppercase mb-2" style={{ color: features[featureIndex].color }}>
                                    &gt; {features[featureIndex].title}
                                </h3>
                                <p className="text-base md:text-lg text-slate-300 leading-relaxed italic">
                                    "{features[featureIndex].desc}"
                                </p>
                            </div>

                            <div className="flex gap-4 mt-6">
                                <button onClick={prevFeature} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-lg text-sm uppercase border border-slate-700">PREVIOUS</button>
                                <button onClick={nextFeature} className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-black py-3 rounded-lg text-sm uppercase border border-slate-700">NEXT_INTEL</button>
                            </div>
                        </div>
                    )}

                    {/* Email Input Field - Larger for Mobile */}
                    <div className="w-full">
                        <form onSubmit={handleJoin} className="flex flex-col sm:flex-row gap-3">
                            <input
                                type="email"
                                required
                                placeholder="Enter Google Play Email Address..."
                                className="flex-grow bg-slate-950 border-2 border-slate-700 px-5 py-4 rounded-xl text-lg text-white placeholder:text-slate-600 focus:border-blue-500 outline-none transition-all"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Enter WhatsApp Phone Number(Optional)..."
                                className="flex-grow bg-slate-950 border-2 border-slate-700 px-5 py-4 rounded-xl text-lg text-white placeholder:text-slate-600 focus:border-blue-500 outline-none transition-all"
                                value={number}
                                onChange={(e) => setNumber(e.target.value)}
                            />
                            <button
                                type="submit"
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-500 disabled:bg-slate-800 text-white font-black px-10 py-4 rounded-xl text-lg uppercase tracking-tight transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-900/40"
                            >
                                {loading ? (
                                    <div className="animate-spin h-6 w-6 border-4 border-white/30 border-t-white rounded-full" />
                                ) : (
                                    "REQUEST ACCESS"
                                )}
                            </button>
                        </form>
                        
                        {message && (
                            <div className={`mt-4 p-3 rounded-lg text-sm font-mono font-bold text-center sm:text-left ${message.type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/30' : 'bg-red-500/10 text-red-400 border border-red-500/30'}`}>
                                &gt; {message.text}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TesterRecruitment;
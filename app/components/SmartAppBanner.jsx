"use client";

import React, { useState, useEffect } from 'react';

export default function SmartAppBanner() {
    // idle -> navigating (trying app) -> stay (app failed, show promo)
    const [status, setStatus] = useState<'idle' | 'navigating' | 'stayed'>('idle');
    const [currentPath, setCurrentPath] = useState('');

    const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.kaytee.oreblogda";
    const APP_SCHEME = "oreblogda";

    useEffect(() => {
        // 1. Only run on mobile
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        if (!isMobile) return;

        // 2. Don't show if they've already dismissed it in this session
        const hasOptedOut = sessionStorage.getItem('appPromoDismissed') === 'true';
        if (hasOptedOut) return;

        setCurrentPath(window.location.pathname + window.location.search);
        
        // Auto-trigger the app attempt
        handleAutoOpen();
    }, []);

    const handleAutoOpen = () => {
        setStatus('navigating');

        // Construct deep link
        const deepLink = `${APP_SCHEME}:/${window.location.pathname}${window.location.search}`;
        
        // Attempt to fire the scheme
        window.location.href = deepLink;

        // Detection logic: If the page is still visible after 2.5s, they don't have the app.
        const checkSelection = setTimeout(() => {
            if (!document.hidden) {
                setStatus('stayed');
            }
        }, 2500);

        return () => clearTimeout(checkSelection);
    };

    const handleDismiss = () => {
        setStatus('idle');
        sessionStorage.setItem('appPromoDismissed', 'true');
    };

    // UI Logic
    if (status === 'idle') return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/95 dark:bg-black/95 backdrop-blur-md p-6 text-center">
            <div className="max-w-xs w-full space-y-8 animate-in fade-in zoom-in duration-300">
                
                {/* Visual Header */}
                <div className="flex flex-col items-center space-y-4">
                    <div className="relative w-24 h-24">
                        {/* Rotating ring only shows during 'navigating' status */}
                        {status === 'navigating' && (
                            <div className="absolute inset-0 border-4 border-blue-600 rounded-3xl border-t-transparent animate-spin"></div>
                        )}
                        <div className="absolute inset-0 flex items-center justify-center bg-blue-500 rounded-3xl shadow-xl overflow-hidden">
                            {/* Replace with your actual app icon */}
                            <img src="/logo.png" alt="App Icon" className="w-full h-full object-cover" />
                        </div>
                    </div>
                    
                    <div>
                        <h2 className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">
                            {status === 'navigating' ? "Opening App..." : "Get the Full Experience"}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 px-4">
                            {status === 'navigating' 
                                ? "Checking if you have Otaku Archives installed..." 
                                : "Read your favorite blogs faster with our official Android app."}
                        </p>
                    </div>
                </div>

                {/* Actions */}
                <div className="space-y-3">
                    {status === 'stayed' && (
                        <a 
                            href={PLAY_STORE_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-center w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg transition-transform active:scale-95"
                        >
                            <svg className="w-5 h-5 mr-2" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.61 3,21.09 3,20.5M16.81,15.12L18.81,16.27C19.46,16.65 20,16.33 20,15.58V8.42C20,7.67 19.46,7.35 18.81,7.73L16.81,8.88L14.4,11.29L16.81,15.12Z" />
                            </svg>
                            Download on Play Store
                        </a>
                    )}

                    <button 
                        onClick={handleDismiss}
                        className="w-full py-3 text-sm font-semibold text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                    >
                        Continue to Website
                    </button>
                </div>
                
                {/* Trust Badge */}
                {status === 'stayed' && (
                    <div className="pt-4 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-[10px] uppercase tracking-widest text-gray-400 font-bold">
                            Free • No Ads • Offline Reading
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

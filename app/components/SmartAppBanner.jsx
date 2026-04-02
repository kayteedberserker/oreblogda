"use client";

import { useEffect, useState } from 'react';

export default function SmartAppBanner() {
    const [isVisible, setIsVisible] = useState(false);
    const [isAppInstalled, setIsAppInstalled] = useState(false);

    const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.kaytee.oreblogda";
    const APP_SCHEME = "oreblogda";
    const PACKAGE_ID = "com.kaytee.oreblogda";

    useEffect(() => {
        // 1. Only run on mobile
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (!isMobile) return;

        // 2. Check dismissal
        const isDismissed = sessionStorage.getItem('appBannerDismissed') === 'true';
        if (isDismissed) return;

        // 3. Optional: Try to detect if app is already installed (Android Chrome only)
        if ('getInstalledRelatedApps' in navigator) {
            navigator.getInstalledRelatedApps().then(apps => {
                const isInstalled = apps.some(app => app.id === PACKAGE_ID);
                setIsAppInstalled(isInstalled);
            });
        }

        setIsVisible(true);
    }, []);

    const handleOpenApp = () => {
        const path = window.location.pathname + window.location.search;
        const isAndroid = /Android/i.test(navigator.userAgent);

        // Android Intent handles fallback to Play Store automatically if not installed
        const androidIntent = `intent://${path.replace(/^\//, '')}#Intent;scheme=${APP_SCHEME};package=${PACKAGE_ID};S.browser_fallback_url=${encodeURIComponent(PLAY_STORE_URL)};end;`;

        const basicScheme = `${APP_SCHEME}://${path}`;

        if (isAndroid) {
            window.location.href = androidIntent;
        } else {
            // iOS Fallback logic
            window.location.href = basicScheme;
            setTimeout(() => {
                if (!document.hidden) window.location.href = PLAY_STORE_URL;
            }, 2000);
        }
    };

    const handleDismiss = () => {
        setIsVisible(false);
        sessionStorage.setItem('appBannerDismissed', 'true');
    };

    if (!isVisible) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] animate-in slide-in-from-top duration-500">
            {/* Banner Container */}
            <div className="bg-white dark:bg-[#111] border-b border-gray-200 dark:border-zinc-800 shadow-xl px-4 py-3 flex items-center justify-between">

                {/* Left: App Info */}
                <div className="flex items-center space-x-3">
                    <button
                        onClick={handleDismiss}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>

                    <div className="w-10 h-10 bg-blue-500 rounded-xl shadow-inner overflow-hidden flex-shrink-0">
                        <img src="/iconblue.png" alt="Icon" className="w-full h-full object-cover p-1.5" />
                    </div>

                    <div className="flex flex-col">
                        <span className="text-sm font-black text-gray-900 dark:text-white leading-tight">
                            Oreblogda App
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-zinc-500 font-bold uppercase tracking-tighter">
                            {isAppInstalled ? "Installed" : "Free on Play Store"}
                        </span>
                    </div>
                </div>

                {/* Right: Action Button */}
                <button
                    onClick={handleOpenApp}
                    className="bg-blue-600 active:bg-blue-700 text-white px-5 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-md transition-transform active:scale-95"
                >
                    {isAppInstalled ? "Open" : "Get"}
                </button>
            </div>

            {/* Subtle Gradient Spacer (prevents content jump) */}
            <div className="h-2 bg-gradient-to-b from-black/5 to-transparent dark:from-black/20 pointer-events-none" />
        </div>
    );
}
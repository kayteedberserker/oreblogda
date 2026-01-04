"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";

export default function AdminDashboard() {
    const [user, setUser] = useState(null);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    // 1. AUTH CHECK (Same as your Approval Page)
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

    // 2. FETCH ANALYTICS DATA
    useEffect(() => {
        if (user) fetchDashboardStats();
    }, [user]);

    const fetchDashboardStats = async () => {
        try {
            const res = await fetch("/api/admin/stats");
            const data = await res.json();
            if (data.success) {
                setStats(data);
            }
        } catch (err) {
            toast.error("Failed to fetch statistics");
        } finally {
            setLoading(false);
        }
    };

    // LOADING ANIMATION (Matching your style)
    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-white dark:bg-[#0a0a0a]">
                <div className="flex flex-col items-center">
                    <div className="h-12 w-12 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                    <p className="mt-4 text-gray-500 dark:text-gray-400 font-bold">Oreblogda Analytics Loading...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6 dark:bg-[#0a0a0a]">
            <div className="mx-auto max-w-6xl">
                
                <header className="mb-8">
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-white">
                        Mission Control
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Tracking growth and engagement for the January 15th launch.
                    </p>
                </header>

                {/* --- STAT CARDS GRID --- */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    <div className="p-5 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Users</p>
                        <h2 className="text-3xl font-black text-blue-600 mt-1">{stats?.totalUsers || 0}</h2>
                    </div>

                    <div className="p-5 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-orange-500/30 dark:border-orange-500/20">
                        <p className="text-xs font-bold text-orange-500 uppercase tracking-wider">Pending Posts</p>
                        <h2 className="text-3xl font-black text-orange-600 mt-1">{stats?.postStats?.pending || 0}</h2>
                    </div>

                    <div className="p-5 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Approved Posts</p>
                        <h2 className="text-3xl font-black text-green-600 mt-1">{stats?.postStats?.approved || 0}</h2>
                    </div>

                    <div className="p-5 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Rejected Posts</p>
                        <h2 className="text-3xl font-black text-red-600 mt-1">{stats?.postStats?.rejected || 0}</h2>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* --- 7-DAY ACTIVITY CHART --- */}
                    <div className="lg:col-span-2 p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                            <span className="h-2 w-2 bg-blue-600 rounded-full animate-pulse"></span>
                            App Active Trends (Last 7 Days)
                        </h3>
                        <div className="flex items-end justify-between h-48 gap-2 mt-4">
                            {stats?.dailyActivity?.map((day) => (
                                <div key={day._id} className="flex-1 flex flex-col items-center group">
                                    <div className="relative w-full flex flex-col items-center px-1">
                                        <div 
                                            className="w-full bg-blue-600/10 group-hover:bg-blue-600 rounded-t-md transition-all duration-300"
                                            style={{ 
                                                height: `${(day.count / (stats.totalUsers || 1)) * 140}px`, 
                                                minHeight: '4px' 
                                            }}
                                        ></div>
                                        <span className="absolute -top-6 text-[10px] font-bold text-blue-600 opacity-0 group-hover:opacity-100 transition-opacity">
                                            {day.count}
                                        </span>
                                    </div>
                                    <p className="text-[10px] font-bold text-gray-500 mt-3 uppercase">
                                        {new Date(day._id).toLocaleDateString('en-US', { weekday: 'short' })}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* --- COUNTRY LIST --- */}
                    <div className="p-6 rounded-xl bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6">
                            User Origins
                        </h3>
                        <div className="space-y-5">
                            {stats?.countries?.map((c) => (
                                <div key={c._id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">
                                            {c._id === "NG" ? "🇳🇬" : c._id === "US" ? "🇺🇸" : "🌐"}
                                        </span>
                                        <div>
                                            <p className="text-sm font-bold text-gray-700 dark:text-gray-200">
                                                {c._id === "NG" ? "Nigeria" : c._id === "Unknown" ? "VPN / Other" : c._id}
                                            </p>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tight">
                                                {Math.round((c.count / stats.totalUsers) * 100)}% of total
                                            </p>
                                        </div>
                                    </div>
                                    <span className="text-xs font-black bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-3 py-1 rounded-full">
                                        {c.count}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>
        </div>
    );
}
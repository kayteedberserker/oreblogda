"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";

const CollabsDashboard = () => {
    const [user, setUser] = useState(null);
    const [networkMembers, setNetworkMembers] = useState([]);
    const [loadingData, setLoadingData] = useState(false);
    const [countryFilter, setCountryFilter] = useState("All");
    const [sortOrder, setSortOrder] = useState("topups_desc");

    // Pagination & Global Metrics States
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalMembersCount, setTotalMembersCount] = useState(0);
    const [globalTotalTopups, setGlobalTotalTopups] = useState(0);

    // Dynamic Collab States
    const [collabType, setCollabType] = useState("followers");
    const [collabPercentage, setCollabPercentage] = useState(20);

    const router = useRouter();

    // --- Fetch Authenticated Creator Profile Context ---
    useEffect(() => {
        const fetchUserSession = async () => {
            try {
                const res = await fetch("/api/collabs/auth/profile");
                const data = await res.json();

                if (res.ok && data.user) {
                    setUser(data.user);
                } else {
                    toast.error("Session missing or expired.");
                }
            } catch (err) {
                console.error("Failed to authenticate creator network session:", err);
                toast.error("Network connection error synchronizing node user.");
            }
        };

        fetchUserSession();
    }, []);

    // --- Fetch Network Data on User Verification or Page Change ---
    useEffect(() => {
        if (user) {
            fetchNetworkMembers();
        }
    }, [user, page]);

    const fetchNetworkMembers = async () => {
        setLoadingData(true);
        try {
            const res = await fetch(`/api/collabs/clan?leaderId=${user.id}&page=${page}&limit=20`);
            const data = await res.json();

            if (res.ok) {
                setNetworkMembers(data.members || []);
                setTotalPages(data.pagination?.totalPages || 1);
                setTotalMembersCount(data.pagination?.totalMembers || (data.members?.length || 0)); // Fallback if pagination isn't strictly enforced yet

                // Calculate total top-ups dynamically from the fetched data if backend doesn't aggregate it
                const aggregatedTopups = data.metrics?.globalTotalTopups || data.members?.reduce((acc, m) => acc + (m.totalPurchasedCoins || 0), 0) || 0;
                setGlobalTotalTopups(aggregatedTopups);

                setCollabType(data.collabType || "followers");
                setCollabPercentage(data.collabPercentage || (data.collabType === 'referrals' ? 40 : 20));
            } else {
                toast.info("Connecting to Database...");
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingData(false);
        }
    };

    // --- DATA PROCESSING ---
    const uniqueCountries = ["All", ...new Set(networkMembers.map(m => m.country || "Unknown"))];

    const filteredMembers = networkMembers
        .filter(m => countryFilter === "All" || (m.country || "Unknown") === countryFilter)
        .sort((a, b) => {
            if (sortOrder === "topups_desc") return (b.totalPurchasedCoins || 0) - (a.totalPurchasedCoins || 0);
            if (sortOrder === "topups_asc") return (a.totalPurchasedCoins || 0) - (b.totalPurchasedCoins || 0);
            if (sortOrder === "recent") return new Date(b.lastActive || 0).getTime() - new Date(a.lastActive || 0).getTime();
            return 0;
        });

    // REVENUE METRIC FIX: Derived from global aggregate, deducting 30% store processing fee first, then taking the dynamic percentage
    const leaderShare = (globalTotalTopups * 0.7) * (collabPercentage / 100);

    // DOLLAR CONVERSION ENGINE: 100 Coins = $0.5 (1 Coin = $0.005)
    const leaderShareUSD = leaderShare * 0.005;

    // UI TEXT DYNAMICS
    const networkLabel = collabType === 'referrals' ? "Referral Network" : "Clan Forces";

    if (!user) {
        return (
            <div className="flex h-screen items-center justify-center bg-white dark:bg-[#0a0a0a] overflow-hidden relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-blue-500/20 blur-[60px] rounded-full animate-pulse"></div>

                <div className="flex flex-col items-center z-10">
                    <div className="flex items-center gap-4 mb-8">
                        <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600/60">Collab_Node</span>
                        </div>
                        <div className="h-[1px] w-8 bg-gray-200 dark:bg-gray-800"></div>
                        <div className="flex items-center gap-1.5">
                            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-ping"></span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-500/60">Data_Sync</span>
                        </div>
                    </div>

                    <div className="relative mb-6">
                        <div className="h-20 w-20 rounded-full border-[3px] border-indigo-600/10 border-t-indigo-600 animate-spin"></div>
                        <div className="absolute top-2 left-2 h-16 w-16 rounded-full border-[3px] border-transparent border-t-blue-500 animate-[spin_1.5s_linear_infinite_reverse]"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 bg-white dark:bg-[#0a0a0a] rounded-full shadow-[0_0_10px_#4f46e5]"></div>
                    </div>

                    <div className="text-center">
                        <h2 className="text-xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white mb-1">
                            Syncing Financial Ledger
                        </h2>
                        <div className="w-48 h-1 bg-gray-100 dark:bg-gray-800 rounded-full mt-4 mx-auto overflow-hidden relative">
                            <div className="absolute inset-y-0 left-0 bg-indigo-600 w-1/2 animate-[collabLoad_2s_ease-in-out_infinite] rounded-full shadow-[0_0_10px_#4f46e5]"></div>
                        </div>
                        <div className="mt-4 flex flex-col gap-1">
                            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-[0.3em] animate-pulse">
                                Authorizing Financial Uplinks...
                            </p>
                        </div>
                    </div>
                </div>
                <style jsx global>{`
                    @keyframes collabLoad {
                        0% { transform: translateX(-100%); }
                        50% { transform: translateX(100%); }
                        100% { transform: translateX(-100%); }
                    }
                `}</style>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto px-6 py-12">
            <header className="mb-12">
                <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-gray-200 dark:border-gray-800 pb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="h-2 w-2 bg-indigo-600 rounded-full animate-pulse shadow-[0_0_10px_#4f46e5]" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500">Collabs Subdomain Active</span>
                        </div>
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase">
                            Welcome, <span className="text-indigo-600">{user.username}</span>
                        </h1>
                    </div>
                </div>
            </header>

            <main className="w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="flex items-center gap-4 mb-8">
                    <h2 className="text-xl font-black uppercase tracking-tighter italic flex items-center gap-2">
                        {networkLabel} & Revenue
                        <span className="bg-indigo-600/10 text-indigo-500 px-2 py-0.5 rounded text-[9px] border border-indigo-500/20 font-sans tracking-normal not-italic font-bold">LIVE</span>
                    </h2>
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-gray-200 dark:from-gray-800 to-transparent" />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="p-6 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/10 blur-2xl rounded-full" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Total {networkLabel}</p>
                        <p className="text-4xl font-black tracking-tighter">{totalMembersCount.toLocaleString()}</p>
                    </div>

                    <div className="p-6 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/10 blur-2xl rounded-full" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Total Top-ups</p>
                        <p className="text-4xl font-black tracking-tighter text-green-600 dark:text-green-500">
                            {globalTotalTopups.toLocaleString()} <span className="text-lg text-gray-400">Coins</span>
                        </p>
                    </div>

                    <div className="p-6 bg-indigo-600 border border-indigo-500 rounded-3xl relative overflow-hidden shadow-[0_0_20px_rgba(79,70,229,0.2)]">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full" />
                        <div className="relative z-10">
                            <div className="flex justify-between items-start mb-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-200">
                                    Your Share ({collabPercentage}% on {collabType})
                                </p>
                                <span className="bg-white/20 text-white px-2 py-0.5 rounded text-[9px] font-bold">READY</span>
                            </div>
                            <p className="text-4xl font-black tracking-tighter text-white">
                                {Math.floor(leaderShare).toLocaleString()} <span className="text-lg text-indigo-200">Coins</span>
                            </p>
                        </div>
                    </div>

                    <div className="p-6 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 blur-2xl rounded-full" />
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 mb-2">Estimated Revenue (USD)</p>
                        <p className="text-4xl font-black tracking-tighter text-amber-500">
                            ${leaderShareUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </p>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row gap-4 mb-6">
                    <div className="flex-1">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block ml-1">Filter by Region</label>
                        <select
                            value={countryFilter}
                            onChange={(e) => setCountryFilter(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 p-3 rounded-xl font-bold outline-none focus:border-indigo-600 transition-all appearance-none"
                        >
                            {uniqueCountries.map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    <div className="flex-1">
                        <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block ml-1">Sort Network By</label>
                        <select
                            value={sortOrder}
                            onChange={(e) => setSortOrder(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-900 border-2 border-gray-100 dark:border-gray-800 p-3 rounded-xl font-bold outline-none focus:border-indigo-600 transition-all appearance-none"
                        >
                            <option value="topups_desc">Highest Top-ups</option>
                            <option value="topups_asc">Lowest Top-ups</option>
                            <option value="recent">Recently Active</option>
                        </select>
                    </div>
                </div>

                <div className="border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden bg-white dark:bg-[#0a0a0a]">
                    {loadingData ? (
                        <div className="flex flex-col items-center justify-center py-24 relative">
                            <div className="relative mb-4">
                                <div className="h-12 w-12 rounded-full border-[3px] border-indigo-600/10 border-t-indigo-600 animate-spin"></div>
                                <div className="absolute top-1 left-1 h-10 w-10 rounded-full border-[3px] border-transparent border-t-blue-500 animate-[spin_1.5s_linear_infinite_reverse]"></div>
                            </div>
                            <h3 className="text-[10px] font-black italic tracking-[0.3em] uppercase text-gray-400 animate-pulse">
                                Accessing Databases...
                            </h3>
                        </div>
                    ) : networkMembers.length === 0 ? (
                        <div className="py-24 text-center">
                            <div className="text-4xl mb-4 opacity-50">👥</div>
                            <p className="text-gray-500 font-bold uppercase tracking-widest text-sm">No Members Found</p>
                            <p className="text-gray-400 text-xs mt-2">Start recruiting to build your network.</p>
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
                                            <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Member</th>
                                            <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Region</th>
                                            <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Referred By You?</th>
                                            <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-500">Last Intel Sync</th>
                                            <th className="p-4 text-[9px] font-black uppercase tracking-widest text-gray-500 text-right">Total Top-ups</th>
                                            <th className="p-4 text-[9px] font-black uppercase tracking-widest text-indigo-500 text-right">Your Share</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {filteredMembers.map((member, idx) => {
                                            const isReferredByMe = member.referredBy === user?.referralCode;

                                            // Ensure the math uses totalPurchasedCoins since that's what the backend sends!
                                            const memberCoins = member.totalPurchasedCoins || 0;

                                            // The list is already strictly filtered in the backend to match the collab criteria.
                                            // We only calculate if they meet the exact parameter required.
                                            let memberShare = 0;
                                            if (collabType === 'followers' || (collabType === 'referrals' && isReferredByMe)) {
                                                memberShare = (memberCoins * 0.7) * (collabPercentage / 100);
                                            }

                                            const memberShareUSD = memberShare * 0.005;

                                            return (
                                                <tr key={idx} className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50/50 dark:hover:bg-gray-900/50 transition-colors">
                                                    <td className="p-4">
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-800 overflow-hidden flex-shrink-0">
                                                                {member.profilePic?.url ? (
                                                                    <img src={member.profilePic.url} alt={member.username} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    <div className="w-full h-full flex items-center justify-center text-xs font-black text-gray-400">
                                                                        {member.username?.charAt(0) || "?"}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <span className="font-bold text-sm truncate max-w-[120px]">{member.username || "Unknown Author"}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-4 text-xs font-medium text-gray-600 dark:text-gray-400">
                                                        {member.country || "Unknown"}
                                                    </td>
                                                    <td className="p-4">
                                                        <span className={`px-2 py-1 rounded text-[9px] font-black tracking-wider uppercase ${isReferredByMe ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'}`}>
                                                            {isReferredByMe ? 'YES' : 'NO'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-xs text-gray-500">
                                                        {member.lastActive ? new Date(member.lastActive).toLocaleDateString() : 'N/A'}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <span className="font-black text-sm">{memberCoins}</span>
                                                        <span className="text-[9px] font-bold text-gray-400 ml-1">COINS</span>
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        <div className="flex flex-col justify-end items-end">
                                                            <span className={`font-black text-sm ${memberShare > 0 ? 'text-indigo-500' : 'text-gray-400'}`}>
                                                                +{Math.floor(memberShare).toLocaleString()}
                                                            </span>
                                                            <span className={`text-[10px] font-bold mt-0.5 ${memberShareUSD > 0 ? 'text-amber-500' : 'text-gray-500'}`}>
                                                                ${memberShareUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                            </span>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border-t border-gray-200 dark:border-gray-800">
                                <div className="text-xs text-gray-500 font-bold uppercase tracking-wider">
                                    Page {page} of {totalPages} <span className="text-gray-400 font-normal">({totalMembersCount} Total Forces)</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        disabled={page <= 1 || loadingData}
                                        onClick={() => setPage(p => Math.max(p - 1, 1))}
                                        className="px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl border border-gray-200 dark:border-gray-800 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all disabled:opacity-40 disabled:hover:bg-transparent"
                                    >
                                        Prev
                                    </button>
                                    <button
                                        disabled={page >= totalPages || loadingData}
                                        onClick={() => setPage(p => Math.min(p + 1, totalPages))}
                                        className="px-4 py-2 text-[10px] font-black tracking-widest uppercase rounded-xl bg-indigo-600 text-white shadow-[0_0_15px_rgba(79,70,229,0.3)] hover:bg-indigo-700 transition-all disabled:opacity-40 disabled:hover:bg-indigo-600"
                                    >
                                        Next
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
};

export default CollabsDashboard;
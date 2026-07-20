"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const ClanDashboard = () => {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);

    const [metrics, setMetrics] = useState(null);
    const [clans, setClans] = useState([]);
    const [primeRequests, setPrimeRequests] = useState([]);

    // ⚡️ NEW: UI States
    const [activeTab, setActiveTab] = useState("registry"); // 'registry' | 'prime'
    const [activeClanModal, setActiveClanModal] = useState(null); // Holds the clan object being viewed/edited
    const [editForm, setEditForm] = useState({ name: "", description: "" });

    const fetchData = async () => {
        try {
            const authRes = await fetch("/api/auth/me", { credentials: "include" });
            if (!authRes.ok) {
                router.push("/auth/login");
                return;
            }
            const authData = await authRes.json();
            setUser(authData.user);

            const clanRes = await fetch("/api/admin/clans");
            const clanData = await clanRes.json();

            if (clanData.success) {
                setMetrics(clanData.data.metrics);
                setClans(clanData.data.allClans);
                setPrimeRequests(clanData.data.primeRequests);

                // Refresh modal data if it's open
                if (activeClanModal) {
                    const updatedClan = clanData.data.allClans.find(c => c._id === activeClanModal._id);
                    if (updatedClan) setActiveClanModal(updatedClan);
                }
            }
        } catch (err) {
            toast.error("Failed to establish secure connection.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [router]);

    const handlePrimeAction = async (clanId, action) => {
        if (!confirm(`Are you sure you want to ${action} this Prime application?`)) return;
        setActionLoading(true);
        try {
            const res = await fetch("/api/admin/clans", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clanId, action }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.message);
                fetchData();
            } else toast.error(data.message || "Action failed.");
        } catch (err) {
            toast.error("Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleEditSubmit = async (e) => {
        e.preventDefault();
        if (!activeClanModal) return;

        setActionLoading(true);
        try {
            const res = await fetch("/api/admin/clans", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clanId: activeClanModal._id,
                    action: 'edit',
                    updateData: editForm
                }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success("Clan intel updated.");
                fetchData();
                setActiveClanModal(null);
            } else toast.error(data.message || "Edit failed.");
        } catch (err) {
            toast.error("Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    const handleDeleteClan = async (clanId, clanName) => {
        if (!confirm(`WARNING: You are about to permanently delete the clan [${clanName}]. Proceed?`)) return;
        setActionLoading(true);
        try {
            const res = await fetch("/api/admin/clans", {
                method: "DELETE",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clanId }),
            });
            if (res.ok) {
                toast.success(`Clan ${clanName} terminated.`);
                setActiveClanModal(null);
                fetchData();
            } else toast.error("Deletion failed.");
        } catch (err) {
            toast.error("Network error.");
        } finally {
            setActionLoading(false);
        }
    };

    const openClanModal = (clan) => {
        setActiveClanModal(clan);
        setEditForm({ name: clan.name, description: clan.description || "" });
    };

    if (loading || !user) {
        return (
            <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900 overflow-hidden relative">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-purple-600/10 blur-[120px] rounded-full"></div>
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 bg-purple-500/20 blur-[60px] rounded-full animate-pulse"></div>
                <div className="flex flex-col items-center z-10">
                    <div className="relative mb-6">
                        <div className="h-20 w-20 rounded-full border-[3px] border-purple-600/10 border-t-purple-600 animate-spin"></div>
                        <div className="absolute top-2 left-2 h-16 w-16 rounded-full border-[3px] border-transparent border-t-orange-500 animate-[spin_1.5s_linear_infinite_reverse]"></div>
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 bg-white dark:bg-gray-900 rounded-full shadow-[0_0_10px_#9333ea]"></div>
                    </div>
                    <h2 className="text-xl font-black italic tracking-tighter uppercase">Loading Registry...</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white dark:bg-[#0a0a0a] text-gray-900 dark:text-white relative overflow-hidden" style={{ padding: "2rem" }}>
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-purple-600/5 blur-[120px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-[300px] h-[300px] bg-orange-600/5 blur-[100px] rounded-full pointer-events-none" />

            {/* --- TOP NAVIGATION --- */}
            <header className="mb-8">
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-200 dark:border-gray-800 pb-8">
                    <div>
                        <div className="flex items-center gap-2 mb-2">
                            <span className="h-2 w-2 bg-purple-600 rounded-full animate-pulse shadow-[0_0_10px_#9333ea]" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em] text-purple-600">Clan Command Center</span>
                        </div>
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase">
                            Registry <span className="text-purple-600">Overview</span>
                        </h1>
                    </div>
                    <nav className="flex flex-wrap gap-3">
                        <Link href="/authordiary/dashboard" className="group relative px-6 py-3 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden hover:scale-105 transition-all">
                            <span className="text-[11px] font-black uppercase tracking-widest text-blue-500">Post Dashboard</span>
                        </Link>
                    </nav>
                </div>
            </header>

            <main className="max-w-7xl mx-auto space-y-8">

                {/* --- METRICS HUD --- */}
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 p-6 rounded-2xl relative overflow-hidden">
                        <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">Registered Clans</p>
                        <p className="text-4xl font-black italic tracking-tighter">{metrics?.totalClans}</p>
                    </div>
                    <div className="bg-purple-600/5 border border-purple-600/20 p-6 rounded-2xl relative overflow-hidden">
                        <p className="text-[10px] font-black uppercase tracking-widest text-purple-500 mb-2">Prime Clans</p>
                        <p className="text-4xl font-black italic tracking-tighter text-purple-500">{metrics?.primeClans}</p>
                    </div>
                    <div className="bg-red-600/5 border border-red-600/20 p-6 rounded-2xl relative overflow-hidden">
                        <p className="text-[10px] font-black uppercase tracking-widest text-red-500 mb-2">Wars / Bounties</p>
                        <p className="text-4xl font-black italic tracking-tighter text-red-500">{metrics?.activeWars} <span className="text-lg text-gray-500">/ {metrics?.activeBounties}</span></p>
                    </div>
                    <div className="bg-blue-600/5 border border-blue-600/20 p-6 rounded-2xl relative overflow-hidden">
                        <p className="text-[10px] font-black uppercase tracking-widest text-blue-500 mb-2">Clan Posts</p>
                        <p className="text-4xl font-black italic tracking-tighter text-blue-500">{metrics?.totalClanPosts}</p>
                    </div>
                </section>

                {/* --- TAB NAVIGATION --- */}
                <div className="flex gap-4 border-b border-gray-200 dark:border-gray-800 pb-1">
                    <button
                        onClick={() => setActiveTab('registry')}
                        className={`px-6 py-3 font-black uppercase tracking-widest text-[11px] transition-all border-b-2 ${activeTab === 'registry' ? 'text-purple-500 border-purple-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                    >
                        Global Registry
                    </button>
                    <button
                        onClick={() => setActiveTab('prime')}
                        className={`px-6 py-3 font-black uppercase tracking-widest text-[11px] transition-all border-b-2 flex items-center gap-2 ${activeTab === 'prime' ? 'text-orange-500 border-orange-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
                    >
                        Prime Requests
                        {primeRequests.length > 0 && (
                            <span className="bg-orange-500 text-white px-2 py-0.5 rounded-full text-[9px]">{primeRequests.length}</span>
                        )}
                    </button>
                </div>

                {/* --- PRIME REQUESTS TAB --- */}
                {activeTab === 'prime' && (
                    <section className="animate-in fade-in slide-in-from-bottom-4">
                        {primeRequests.length === 0 ? (
                            <div className="p-12 text-center border-2 border-dashed border-gray-800 rounded-3xl">
                                <p className="text-gray-500 font-bold uppercase tracking-widest">No pending prime applications.</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {primeRequests.map(clan => (
                                    <div key={clan._id} className="bg-gray-50 dark:bg-gray-900 border-2 border-orange-500/30 p-6 rounded-2xl relative">
                                        <div className="flex justify-between items-start mb-4">
                                            <div>
                                                <h3 className="text-xl font-black uppercase italic tracking-tighter">{clan.name}</h3>
                                                <p className="text-[11px] font-mono text-gray-500 mt-1">[{clan.tag}]</p>
                                            </div>
                                            <div className="bg-orange-500/10 px-3 py-1 rounded border border-orange-500/20">
                                                <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Req: Tier {clan.primeApplication.requestedLevel}</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3 mt-6">
                                            <button onClick={() => handlePrimeAction(clan._id, 'approve')} disabled={actionLoading} className="flex-1 bg-green-600 hover:bg-green-500 text-white font-black uppercase tracking-widest text-[10px] py-3 rounded-xl transition-colors">Approve</button>
                                            <button onClick={() => handlePrimeAction(clan._id, 'decline')} disabled={actionLoading} className="flex-1 bg-gray-800 hover:bg-red-600 text-gray-400 hover:text-white font-black uppercase tracking-widest text-[10px] py-3 rounded-xl transition-colors">Decline</button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </section>
                )}

                {/* --- REGISTRY TAB --- */}
                {activeTab === 'registry' && (
                    <section className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4">
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-100 dark:bg-black/40 border-b border-gray-200 dark:border-gray-800">
                                        <th className="p-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Clan Identity</th>
                                        <th className="p-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Status</th>
                                        <th className="p-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-right">Members</th>
                                        <th className="p-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-right">Points</th>
                                        <th className="p-5 text-[10px] font-black uppercase tracking-[0.2em] text-gray-500 text-center">Data</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
                                    {clans.map((clan) => (
                                        <tr key={clan._id} className="hover:bg-white dark:hover:bg-gray-800/50 transition-colors">
                                            <td className="p-5">
                                                <div className="flex items-center gap-3">
                                                    <div className={`w-2 h-2 rounded-full ${clan.primeLevel > 0 ? 'bg-purple-500 shadow-[0_0_8px_#a855f7]' : 'bg-gray-400'}`} />
                                                    <div>
                                                        <p className="font-black italic uppercase tracking-tight text-sm text-gray-900 dark:text-white">{clan.name}</p>
                                                        <p className="text-[10px] font-mono text-gray-500">[{clan.tag}]</p>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-5">
                                                <div className="flex flex-col gap-2 items-start">
                                                    {clan.primeLevel > 0 ? (
                                                        <span className="bg-purple-500/10 border border-purple-500/30 text-purple-500 text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest">Prime T{clan.primeLevel}</span>
                                                    ) : (
                                                        <span className="bg-gray-800 text-gray-500 text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest">Standard</span>
                                                    )}
                                                    {clan.isInWar && <span className="bg-red-500/10 border border-red-500/30 text-red-500 text-[9px] font-black px-2 py-1 rounded uppercase tracking-widest">In War</span>}
                                                </div>
                                            </td>
                                            <td className="p-5 text-right font-bold text-gray-300">{clan.members?.length || 0}</td>
                                            <td className="p-5 text-right font-black italic text-white">{clan.totalPoints?.toLocaleString() || 0}</td>
                                            <td className="p-5 text-center">
                                                <button
                                                    onClick={() => openClanModal(clan)}
                                                    className="px-4 py-2 bg-blue-600/10 border border-blue-600/30 text-blue-500 hover:bg-blue-600 hover:text-white rounded-lg transition-colors text-[10px] font-black uppercase tracking-widest"
                                                >
                                                    Inspect
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                )}
            </main>

            {/* --- DEEP DIVE / EDIT MODAL --- */}
            {activeClanModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
                    <div className="bg-gray-900 border border-gray-800 rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col md:flex-row">

                        {/* LEFT: Stats & Data Panel */}
                        <div className="flex-1 p-8 border-r border-gray-800">
                            <div className="flex justify-between items-start mb-8">
                                <div>
                                    <p className="text-[10px] text-purple-500 font-black uppercase tracking-[0.3em] mb-1">Dossier / Intel</p>
                                    <h2 className="text-3xl font-black uppercase italic tracking-tighter">{activeClanModal.name}</h2>
                                    <p className="text-sm font-mono text-gray-500">[{activeClanModal.tag}] • Rank #{activeClanModal.rank}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 mb-8">
                                <div className="bg-black/40 p-4 rounded-xl border border-gray-800">
                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Total Points</p>
                                    <p className="text-lg font-black text-white">{activeClanModal.totalPoints?.toLocaleString()}</p>
                                </div>
                                <div className="bg-black/40 p-4 rounded-xl border border-gray-800">
                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Total Views</p>
                                    <p className="text-lg font-black text-blue-400">{activeClanModal.stats?.views?.toLocaleString() || 0}</p>
                                </div>
                                <div className="bg-black/40 p-4 rounded-xl border border-gray-800">
                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Total Likes</p>
                                    <p className="text-lg font-black text-pink-500">{activeClanModal.stats?.likes?.toLocaleString() || 0}</p>
                                </div>
                                <div className="bg-black/40 p-4 rounded-xl border border-gray-800">
                                    <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest mb-1">Leader</p>
                                    <p className="text-sm font-bold text-gray-300">{activeClanModal.leader?.username || "Unknown"}</p>
                                </div>
                            </div>

                            {/* Weekly History */}
                            <h3 className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-3">Rank History (Last 4 Weeks)</h3>
                            <div className="space-y-2 mb-8">
                                {activeClanModal.weeklyPointHistory?.slice(-4).reverse().map((hist, idx) => (
                                    <div key={idx} className="flex justify-between items-center bg-black/40 px-4 py-2 rounded-lg border border-gray-800">
                                        <span className="text-[10px] font-mono text-gray-400">{new Date(hist.weekEnding).toLocaleDateString()}</span>
                                        <span className="text-xs font-bold text-gray-300">Rank #{hist.rankAtTime}</span>
                                        <span className="text-xs font-black text-white">{hist.points.toLocaleString()} pts</span>
                                    </div>
                                ))}
                                {(!activeClanModal.weeklyPointHistory || activeClanModal.weeklyPointHistory.length === 0) && (
                                    <p className="text-xs text-gray-600 font-medium italic">No historical data available.</p>
                                )}
                            </div>

                            {/* Roster Preview */}
                            <h3 className="text-[10px] text-gray-500 font-black uppercase tracking-[0.2em] mb-3">Member Roster ({activeClanModal.members?.length})</h3>
                            <div className="max-h-32 overflow-y-auto bg-black/40 rounded-xl border border-gray-800 p-2 flex flex-wrap gap-2">
                                {activeClanModal.members?.map(member => (
                                    <span key={member._id} className="bg-gray-800 px-2 py-1 rounded text-[10px] font-bold text-gray-300">
                                        {member.username || 'Agent'}
                                    </span>
                                ))}
                            </div>
                        </div>

                        {/* RIGHT: Edit Panel */}
                        <div className="flex-1 p-8 bg-gray-900 md:bg-gray-800/20 border-l border-gray-800 flex flex-col">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-[10px] text-blue-500 font-black uppercase tracking-[0.3em]">Override Systems</h3>
                                <button onClick={() => setActiveClanModal(null)} className="p-2 bg-gray-800 text-gray-400 hover:text-white rounded-full">✕</button>
                            </div>

                            <form onSubmit={handleEditSubmit} className="flex-1 space-y-6">
                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block">Display Name</label>
                                    <input
                                        type="text"
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                        className="w-full bg-black/50 border border-gray-700 p-4 rounded-xl font-bold text-white outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="text-[9px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 block">Manifesto / Description</label>
                                    <textarea
                                        value={editForm.description}
                                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                        rows={5}
                                        className="w-full bg-black/50 border border-gray-700 p-4 rounded-xl font-medium text-gray-300 outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div className="pt-4 border-t border-gray-800 flex flex-col gap-3 mt-auto">
                                    <button
                                        type="submit"
                                        disabled={actionLoading}
                                        className="w-full bg-blue-600 hover:bg-blue-500 text-white font-black uppercase tracking-[0.2em] text-[11px] py-4 rounded-xl transition-all"
                                    >
                                        {actionLoading ? 'Saving...' : 'Deploy Changes'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDeleteClan(activeClanModal._id, activeClanModal.name)}
                                        disabled={actionLoading}
                                        className="w-full bg-red-500/10 hover:bg-red-600 text-red-500 hover:text-white border border-red-500/30 font-black uppercase tracking-[0.2em] text-[11px] py-4 rounded-xl transition-all"
                                    >
                                        Terminate Clan
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ClanDashboard;
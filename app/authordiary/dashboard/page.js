"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "react-toastify";

// --- HELPERS ---

const getFlagEmoji = (countryCode, size = "w40") => {
  if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) {
    return <span className="text-lg">🌐</span>;
  }
  const code = countryCode.toLowerCase();
  return (
    <img 
      src={`https://flagcdn.com/${size}/${code}.png`} 
      alt={countryCode}
      className="inline-block w-6 h-auto rounded-sm shadow-sm"
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  );
};

const MetricCard = ({ title, value, color, loading, trend }) => (
  <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{title}</p>
    {loading ? (
      <div className="h-8 w-20 bg-gray-100 dark:bg-gray-700 animate-pulse rounded-lg"></div>
    ) : (
      <div className="flex items-baseline gap-2">
        <h2 className={`text-3xl font-black italic tracking-tighter ${color}`}>{value?.toLocaleString() || 0}</h2>
        {trend !== undefined && (
          <span className={`text-[10px] font-black ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
            {trend >= 0 ? '↑' : '↓'}{Math.abs(trend)}%
          </span>
        )}
      </div>
    )}
    <div className={`absolute bottom-0 left-0 h-1 bg-current opacity-10 ${color}`} style={{ width: '100%' }}></div>
  </div>
);

// --- MAIN COMPONENT ---

export default function FullAdminDashboard() {
    const [stats, setStats] = useState(null);
    const [userList, setUserList] = useState([]);
    const [dormantCount, setDormantCount] = useState(0);
    
    // Loading States
    const [initialLoading, setInitialLoading] = useState(true);
    const [statsLoading, setStatsLoading] = useState(false);
    const [tableLoading, setTableLoading] = useState(false);
    const [userMetaLoading, setUserMetaLoading] = useState(false);
    const [sendingPush, setSendingPush] = useState(false);

    // Selection & Notification State
    const [selectedUser, setSelectedUser] = useState(null);
    const [pushMessage, setPushMessage] = useState({ title: "", body: "" });

    // Updated Filters: "thisMonth" and "lastMonth" added
    const [range, setRange] = useState("7days");
    const [selectedCountry, setSelectedCountry] = useState("All");
    const [showOnlyActive, setShowOnlyActive] = useState(false);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // --- DATA FETCHING ---

    useEffect(() => {
        const init = async () => {
            await Promise.all([
                fetchDashboardData(true), 
                fetchUsers(true), 
                fetchDormantCount()
            ]);
            setInitialLoading(false);
        };
        init();
    }, []);

    useEffect(() => {
        if (!initialLoading) fetchDashboardData();
    }, [range]);

    useEffect(() => {
        if (!initialLoading) {
            fetchUsers();
            setSelectedUser(null);
        }
    }, [page, selectedCountry, showOnlyActive]);

    const fetchDormantCount = async () => {
        try {
            const res = await fetch('/api/admin/notifications');
            const data = await res.json();
            setDormantCount(data.dormantCount || 0);
        } catch (err) { console.error("Dormant fetch failed"); }
    };

    const fetchDashboardData = async (isInitial = false) => {
        if (!isInitial) setStatsLoading(true);
        try {
            // The range value (24h, 7days, thisMonth, lastMonth) is passed to your API
            const res = await fetch(`/api/admin/stats?range=${range}`);
            const json = await res.json();
            if (json.success) setStats(json.data);
        } catch (err) {
            toast.error("Overview relay error");
        } finally {
            // Simulated delay to ensure the loading animation is visible as requested
            setTimeout(() => setStatsLoading(false), 500);
        }
    };

    const fetchUsers = async (isInitial = false) => {
        setTableLoading(true);
        try {
            const res = await fetch(
                `/api/admin/users?page=${page}&country=${selectedCountry}&activeOnly=${showOnlyActive}`
            );
            const data = await res.json();
            setUserList(data.users || []);
            setTotalPages(data.pages || 1);
        } catch (err) {
            toast.error("User registry sync error");
        } finally {
            setTableLoading(false);
        }
    };

    // --- ACTIONS ---

    const handleUserSelect = async (user) => {
        setSelectedUser(user);
        setUserMetaLoading(true);
        setPushMessage({ title: "", body: "" });
        try {
            const res = await fetch(`/api/admin/users/posts?userId=${user._id}`);
            const data = await res.json();
            setSelectedUser(prev => ({ ...prev, postCount: data.count || 0 }));
        } catch (err) {
            console.error("Post intelligence sync failed");
        } finally {
            setUserMetaLoading(false);
        }
    };

    const sendSinglePush = async () => {
        if (!pushMessage.title || !pushMessage.body) return toast.warning("Enter signal parameters");
        setSendingPush(true);
        try {
            const res = await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: "SINGLE",
                    userId: selectedUser._id,
                    title: pushMessage.title,
                    message: pushMessage.body
                })
            });
            if (res.ok) {
                toast.success("Signal Transmitted to Operator");
                setPushMessage({ title: "", body: "" });
            }
        } catch (err) { toast.error("Transmission Failed"); }
        finally { setSendingPush(false); }
    };

    const sendBulkPush = async () => {
        const msg = prompt(`TRANSMISSION: Target ${dormantCount} users offline for 30+ days. Enter message:`);
        if (!msg) return;
        setSendingPush(true);
        try {
            const res = await fetch('/api/admin/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: "BULK_DORMANT",
                    title: "Oreblogda Update",
                    message: msg
                })
            });
            if (res.ok) toast.success("Mass Signal Broadcasted!");
        } catch (err) { toast.error("Broadcast Failed"); }
        finally { setSendingPush(false); }
    };

    // --- RENDER ---

    if (initialLoading) return (
        <div className="flex h-screen items-center justify-center bg-white dark:bg-[#0a0a0a]">
            <div className="flex flex-col items-center">
                <div className="h-16 w-16 animate-spin rounded-full border-4 border-blue-600 border-t-transparent shadow-[0_0_20px_rgba(37,99,235,0.3)]"></div>
                <p className="mt-6 text-[11px] font-black uppercase tracking-[0.3em] text-blue-600 animate-pulse">Initializing Systems...</p>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 dark:bg-[#0a0a0a] text-gray-900 dark:text-gray-100 transition-colors duration-500">
            <div className="mx-auto max-w-7xl">
                
                {/* --- HEADER HUD --- */}
                <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                    <div>
                        <h1 className="text-4xl font-black italic tracking-tighter uppercase">Command Center</h1>
                        <div className="flex items-center gap-2 mt-1">
                          <div className="h-1 w-12 bg-blue-600"></div>
                          <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">System v4.0.2</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={sendBulkPush}
                            disabled={sendingPush}
                            className="bg-orange-500/10 border border-orange-500/20 px-4 py-2 rounded-2xl flex items-center gap-4 group hover:bg-orange-500 transition-all active:scale-95 disabled:opacity-50"
                        >
                            <div className="text-left">
                                <p className="text-[8px] font-black text-orange-500 group-hover:text-white uppercase tracking-widest">Dormant (30d+)</p>
                                <p className="text-sm font-black group-hover:text-white">{dormantCount}</p>
                            </div>
                            <span className="bg-orange-500 text-white p-2 rounded-xl group-hover:bg-white group-hover:text-orange-500 transition-colors">
                              {sendingPush ? <div className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full"></div> : "🚀"}
                            </span>
                        </button>

                        {/* UPDATED RANGE SELECTOR */}
                        <div className="flex bg-white dark:bg-gray-800 p-1 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm">
                            {["today", "yesterday", "24h", "7days", "30days", "thisMonth", "lastMonth"].map((r) => (
                                <button 
                                    key={r}
                                    onClick={() => setRange(r)}
                                    className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${range === r ? "bg-blue-600 text-white shadow-lg shadow-blue-600/20" : "text-gray-400 hover:text-blue-500"}`}
                                >
                                    {r === 'today' ? 'Today' : 
                                     r === 'yesterday' ? 'Yesterday' : 
                                     r === '24h' ? 'Past 24H' : 
                                     r === '7days' ? 'Past 7 Days' : 
                                     r === '30days' ? 'Past 30 Days' : 
                                     r === 'thisMonth' ? 'This Month' : 
                                     'Last Month'}
                                </button>
                            ))}
                        </div>
                    </div>
                </header>

                {/* --- METRICS GRID --- */}
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
                    <MetricCard title="Total Users" value={stats?.totalUsers} color="text-blue-600" loading={statsLoading} />
                    <MetricCard title="App Opens" value={stats?.totalAppOpens} color="text-purple-500" loading={statsLoading} trend={stats?.activityTrend} />
                    <MetricCard title="Pending" value={stats?.postStats?.pending} color="text-orange-500" loading={statsLoading} />
                    <MetricCard title="Approved" value={stats?.postStats?.approved} color="text-green-500" loading={statsLoading} />
                    <MetricCard title="Rejected" value={stats?.postStats?.rejected} color="text-red-500" loading={statsLoading} />
                </div>

                {/* --- ANALYTICS ROW --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    {/* Activity Chart */}
                    <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-200 dark:border-gray-700 relative overflow-hidden">
                        <div className="flex justify-between items-center mb-10">
                          <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-400 flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping"></span>
                              Activity Flow
                          </h3>
                        </div>
                        
                        {/* LOADING ANIMATION FOR CHART */}
                        {statsLoading && (
                            <div className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 z-10 flex items-center justify-center backdrop-blur-[2px] transition-all">
                                <div className="flex flex-col items-center">
                                    <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                                    <p className="mt-2 text-[8px] font-black text-blue-600 uppercase tracking-widest">Updating Data...</p>
                                </div>
                            </div>
                        )}

                        <div className="flex items-end justify-between h-56 gap-2">
                            {stats?.dailyActivity?.map((data, idx) => {
                                const maxVal = Math.max(...stats.dailyActivity.map(d => d.count), 1);
                                const barHeight = (data.count / maxVal) * 160;
                                let displayDate = data._id;
                                if (range !== '24h' && range !== 'today' && range !== 'yesterday') {
                                    const d = new Date(data._id);
                                    displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                                }
                                return (
                                    <div key={idx} className="flex-1 flex flex-col items-center group relative">
                                        <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition-all bg-gray-900 text-white text-[9px] font-black px-2 py-1 rounded-lg shadow-xl z-20">
                                          {data.count} opens
                                        </div>
                                        <div 
                                          className={`w-full max-w-[20px] rounded-t-lg transition-all duration-1000 ease-out group-hover:brightness-110 ${data.count > 0 ? 'bg-blue-600 shadow-[0_0_15px_rgba(37,99,235,0.1)]' : 'bg-gray-100 dark:bg-gray-700'}`} 
                                          style={{ height: `${Math.max(barHeight, 5)}px` }}
                                        ></div>
                                        <p className="text-[8px] mt-3 text-gray-400 font-black uppercase text-center tracking-tighter group-hover:text-blue-600 transition-colors">{displayDate}</p>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Country Distribution */}
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-200 dark:border-gray-700">
                        <h3 className="font-black text-[10px] uppercase tracking-widest mb-6 text-gray-400 italic underline decoration-blue-600 decoration-2 underline-offset-4">Origin Pulse</h3>
                        <div className="space-y-2 overflow-y-auto max-h-[250px] pr-2 custom-scrollbar">
                            {stats?.countries?.map(c => (
                                <div key={c._id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-transparent hover:border-blue-500/20 transition-all cursor-default">
                                    <div className="flex items-center gap-3">
                                        <span className="text-lg leading-none">{getFlagEmoji(c._id)}</span>
                                        <span className="font-black text-[10px] text-gray-500 uppercase">{c._id || "Other"}</span>
                                    </div>
                                    <span className="font-black text-blue-600 text-xs px-2 py-1 bg-blue-600/5 rounded-lg">{c.count}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* --- USER TABLE --- */}
                <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl mb-20">
                    <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex flex-col md:flex-row justify-between items-center gap-4">
                        <h3 className="font-black text-xl italic uppercase tracking-tighter">User Registry</h3>
                        <div className="flex items-center gap-4">
                            <button 
                                onClick={() => setShowOnlyActive(!showOnlyActive)}
                                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase transition-all flex items-center gap-2 ${showOnlyActive ? 'bg-green-500 text-white shadow-lg shadow-green-500/30' : 'bg-gray-100 dark:bg-gray-900 text-gray-400 border border-gray-200 dark:border-gray-700'}`}
                            >
                                <span className={`h-1.5 w-1.5 rounded-full ${showOnlyActive ? 'bg-white animate-pulse' : 'bg-gray-400'}`}></span>
                                Active Pulse
                            </button>
                            <select 
                              value={selectedCountry} 
                              onChange={(e) => { setSelectedCountry(e.target.value); setPage(1); }} 
                              className="bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 p-2 px-4 rounded-xl text-[9px] font-black uppercase outline-none focus:ring-2 ring-blue-500"
                            >
                                <option value="All">Global Feed</option>
                                {stats?.countries?.map(c => <option key={c._id} value={c._id}>{c._id}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="overflow-x-auto min-h-[400px]">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 dark:bg-gray-900 text-[9px] uppercase font-black text-gray-400 tracking-[0.2em]">
                                <tr>
                                    <th className="px-8 py-5">Operator Info</th>
                                    <th className="px-8 py-5">Location</th>
                                    <th className="px-8 py-5">Activity</th>
                                    <th className="px-8 py-5">Last Comms</th>
                                    <th className="px-8 py-5 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                                {tableLoading ? (
                                    <tr>
                                        <td colSpan="5" className="p-20 text-center">
                                            <div className="flex flex-col items-center">
                                                <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mb-4"></div>
                                                <p className="font-black text-gray-300 text-[9px] uppercase tracking-[0.3em]">Querying Database...</p>
                                            </div>
                                        </td>
                                    </tr>
                                ) : userList.map((u) => (
                                    <tr 
                                        key={u._id} 
                                        onClick={() => handleUserSelect(u)}
                                        className={`cursor-pointer transition-all ${selectedUser?._id === u._id ? 'bg-blue-600/5 border-l-4 border-blue-600' : 'hover:bg-gray-50 dark:hover:bg-white/5 border-l-4 border-transparent'}`}
                                    >
                                        <td className="px-8 py-4">
                                            <div className="flex items-center gap-4">
                                                <img 
                                                    src={u.profilePic?.url || u.image || u.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'} 
                                                    className="h-10 w-10 rounded-2xl object-cover border border-gray-200 dark:border-gray-700 bg-gray-100 shadow-sm" 
                                                    alt="pfp" 
                                                />
                                                <div>
                                                    <p className="font-black text-gray-900 dark:text-white text-sm">{u.username || "ANONYMOUS"}</p>
                                                    <p className="text-[9px] text-gray-400 font-mono uppercase tracking-tighter">ID: {u._id.slice(-8)}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-8 py-4">
                                            <span className="font-black text-[10px] uppercase flex items-center gap-2">
                                                <span className="text-base leading-none">{getFlagEmoji(u.country)}</span>
                                                {u.country || "---"}
                                            </span>
                                        </td>
                                        <td className="px-8 py-4">
                                            <span className="font-black text-[11px] text-purple-500 bg-purple-500/10 px-2 py-1 rounded-lg">{u.appOpens || 0}</span>
                                        </td>
                                        <td className="px-8 py-4 text-[10px] font-bold text-gray-400 uppercase">
                                            {u.lastActive ? new Date(u.lastActive).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                                        </td>
                                        <td className="px-8 py-4">
                                            <div className="flex justify-center">
                                                <div className={`h-2.5 w-2.5 rounded-full ${Date.now() - new Date(u.lastActive) < 600000 ? 'bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-pulse' : 'bg-gray-200 dark:bg-gray-700'}`}></div>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="p-4 bg-gray-50 dark:bg-gray-900/30 flex justify-between items-center px-8 border-t border-gray-100 dark:border-gray-700">
                        <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Relay {page} / {totalPages}</span>
                        <div className="flex gap-2">
                            <button 
                              disabled={page === 1 || tableLoading} 
                              onClick={() => { setPage(p => p - 1); setSelectedUser(null); }} 
                              className="px-5 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 disabled:opacity-30 font-black text-[9px] uppercase hover:shadow-md transition-all active:scale-95"
                            >
                              PREV
                            </button>
                            <button 
                              disabled={page === totalPages || tableLoading} 
                              onClick={() => { setPage(p => p + 1); setSelectedUser(null); }} 
                              className="px-5 py-2 rounded-xl bg-blue-600 text-white font-black text-[9px] uppercase hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95"
                            >
                              NEXT
                            </button>
                        </div>
                    </div>
                </div>

                {/* --- USER INTELLIGENCE & SIGNAL PANEL --- */}
                {selectedUser && (
                    <div className="bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-blue-600/30 p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-500 mb-20 relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-6">
                            <button 
                              onClick={() => setSelectedUser(null)} 
                              className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-400 hover:text-red-500 transition-all hover:rotate-90"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        
                        <div className="flex flex-col lg:flex-row gap-10">
                            {/* Profile Part */}
                            <div className="flex flex-col items-center lg:items-start shrink-0">
                                <img 
                                    src={selectedUser.profilePic?.url || selectedUser.image || selectedUser.avatar || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'} 
                                    className="h-44 w-44 rounded-[3rem] object-cover border-4 border-white dark:border-gray-700 shadow-2xl mb-6 bg-gray-100" 
                                    alt="Avatar" 
                                />
                                <Link 
                                    href={`/author/${selectedUser.deviceId || selectedUser._id}`} 
                                    className="w-full bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-center hover:bg-blue-700 hover:shadow-xl transition-all flex items-center justify-center gap-2 group"
                                >
                                    Access Profile <span className="group-hover:translate-x-1 transition-transform">↗</span>
                                </Link>
                            </div>

                            {/* Info Part */}
                            <div className="flex-1">
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                    <div className="lg:col-span-2">
                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1 italic">Operator Signature</label>
                                        <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-1">{selectedUser.username || "ANONYMOUS OPERATOR"}</h2>
                                        <p className="text-[10px] font-mono text-blue-500 break-all bg-blue-500/5 p-2 rounded-lg inline-block border border-blue-500/10">{selectedUser._id}</p>
                                    </div>

                                    <div className="bg-blue-600/5 p-4 rounded-3xl border border-blue-600/10 text-center flex flex-col justify-center">
                                        <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Transmissions</label>
                                        {userMetaLoading ? (
                                            <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mx-auto"></div>
                                        ) : (
                                            <p className="text-4xl font-black text-blue-600">{selectedUser.postCount} <span className="text-[10px] tracking-widest italic opacity-50 uppercase">Posts</span></p>
                                        )}
                                    </div>

                                    {/* SIGNAL COMPOSER */}
                                    <div className="lg:col-span-3 bg-gray-50 dark:bg-gray-900/50 p-6 rounded-[2.5rem] border border-gray-200 dark:border-gray-700 shadow-inner">
                                        <div className="flex items-center gap-3 mb-6">
                                            <span className="p-2 bg-blue-600 rounded-xl text-white text-xs shadow-lg shadow-blue-500/30">🔔</span>
                                            <h4 className="font-black text-xs uppercase tracking-[0.2em]">Signal Composer</h4>
                                        </div>
                                        
                                        {!selectedUser.pushToken ? (
                                            <div className="p-6 bg-red-500/5 border border-red-500/20 rounded-2xl text-red-500 font-black text-[10px] uppercase text-center tracking-widest">
                                                Communication link offline. No Push Token detected.
                                            </div>
                                        ) : (
                                            <div className="space-y-4">
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <input 
                                                        type="text" 
                                                        placeholder="SIGNAL TITLE..." 
                                                        value={pushMessage.title}
                                                        onChange={(e) => setPushMessage({...pushMessage, title: e.target.value})}
                                                        className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 text-[11px] font-black uppercase outline-none focus:ring-2 ring-blue-500 transition-all placeholder:text-gray-300"
                                                    />
                                                    <input 
                                                        type="text" 
                                                        placeholder="OPERATOR MESSAGE..." 
                                                        value={pushMessage.body}
                                                        onChange={(e) => setPushMessage({...pushMessage, body: e.target.value})}
                                                        className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 text-[11px] font-black outline-none focus:ring-2 ring-blue-500 transition-all placeholder:text-gray-300"
                                                    />
                                                </div>
                                                <button 
                                                    onClick={sendSinglePush}
                                                    disabled={sendingPush}
                                                    className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-3"
                                                >
                                                    {sendingPush ? <div className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full"></div> : "Transmit Signal"}
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Additional Metadata */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:col-span-3">
                                      <div>
                                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Station Origin</label>
                                          <p className="font-black flex items-center gap-2 text-lg">
                                              <span className="text-2xl leading-none">{getFlagEmoji(selectedUser.country)}</span>
                                              {selectedUser.country || "UNKNOWN"}
                                          </p>
                                      </div>
                                      <div>
                                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Hardware ID</label>
                                          <p className="text-[10px] font-mono text-gray-500 break-all">{selectedUser.deviceId || "VIRTUAL_DEVICE"}</p>
                                      </div>
                                      <div>
                                          <label className="text-[9px] font-black text-gray-400 uppercase block mb-1">Relay Pulse</label>
                                          <div className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded-xl border border-gray-100 dark:border-gray-700 overflow-hidden">
                                              <p className="text-[9px] font-mono text-gray-400 truncate">
                                                  {selectedUser.pushToken || "COMM_LINK_DOWN"}
                                              </p>
                                          </div>
                                      </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
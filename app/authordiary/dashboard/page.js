"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "react-toastify";

// --- HELPERS ---

const getFlagEmoji = (countryCode, size = "w40") => {
  if (!countryCode || typeof countryCode !== 'string' || countryCode.length !== 2) {
    return <span className="text-lg">🌐</span>;
  }
  const code = countryCode.toLowerCase();
  return (
    <Image
      width={24}
      height={10}
      src={`https://flagcdn.com/${size}/${code}.png`}
      alt={countryCode}
      className="inline-block w-6 h-auto rounded-sm shadow-sm"
      onError={(e) => { e.target.style.display = 'none'; }}
    />
  );
};

const getOptimizedCloudinaryUrl = (url) => {
  if (!url || !url.includes("cloudinary.com")) return url || "/default-avatar.png";
  return url.replace("/upload/", "/upload/w_300,c_fill,g_face,f_auto,q_auto/");
};

const getDaysInactive = (lastActive) => {
  if (!lastActive) return 'Never';
  const days = Math.floor((Date.now() - new Date(lastActive)) / (24 * 60 * 60 * 1000));
  return `${days}d ago`;
};

// ⚡️ OS Logo Helper
const getPlatformIcon = (platform) => {
  const p = (platform || "").toLowerCase();

  if (p.includes('ios') || p.includes('apple')) {
    return (
      <svg className="w-5 h-5 text-neutral-800 dark:text-neutral-200" viewBox="0 0 170 170" fill="currentColor">
        <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.37.13-9.13-1.9-14.33-6.08-3.47-2.92-7.38-7.71-11.73-14.37-5.59-8.4-10.05-18.06-13.4-28.97-3.35-10.91-5.02-21.25-5.02-31.02 0-14.86 3.86-26.94 11.59-36.24 7.72-9.3 17.27-14.04 28.64-14.2 5.03 0 10.65 1.5 16.86 4.5 6.21 2.99 10.74 4.5 13.59 4.5 2.12 0 6.13-1.34 12.02-4.04 5.9-2.69 11.53-3.95 16.9-3.79 12.2.56 22.18 5.17 29.93 13.84-11.2 6.83-16.65 16.14-16.35 27.94.3 9.4 3.99 17.3 11.08 23.72 7.09 6.42 15.5 10.03 25.21 10.84-2.24 6.64-5.21 13.4-8.91 20.3zM119.22 30.45c0-6.94-2.52-13.33-7.56-19.16C106.63 5.46 99.8.92 91.17 0c-.11 1.01-.17 1.8-.17 2.36 0 6.62 2.65 12.98 7.96 19.06 5.3 6.09 11.96 10.19 19.98 12.31.11-.8.28-2.07.28-3.28z" />
      </svg>
    );
  }

  if (p.includes('web') || p.includes('windows') || p.includes('mac')) {
    return <span className="text-lg">🌐</span>;
  }

  // Default to Android
  return (
    <svg className="w-5 h-5 text-green-500" viewBox="0 0 512 650" fill="currentColor">
      <g id="android-robot">
        <path d="M178.6,183.1 L151.7,136.5 C149.3,132.3 150.7,126.9 154.9,124.5 C159.1,122.1 164.5,123.5 166.9,127.7 L194,174.6 C212.8,166 233.8,161.2 256,161.2 C278.2,161.2 299.2,166 318,174.6 L345.1,127.7 C347.5,123.5 352.9,122.1 357.1,124.5 C361.3,126.9 362.7,132.3 360.3,136.5 L333.4,183.1 C381.7,209.3 415.1,258.4 417.1,316.1 L94.9,316.1 C96.9,258.4 130.3,209.3 178.6,183.1 Z" />
        <circle fill="#FFFFFF" cx="194.2" cy="246.6" r="13.2" />
        <circle fill="#FFFFFF" cx="317.8" cy="246.6" r="13.2" />
        <path d="M51.9,335.7 C36.5,335.7 24,348.2 24,363.6 L24,472.9 C24,488.3 36.5,500.8 51.9,500.8 C67.3,500.8 79.8,488.3 79.8,472.9 L79.8,363.6 C79.8,348.2 67.3,335.7 51.9,335.7 Z" />
        <path d="M94.9,335.7 L94.9,510.9 C94.9,523.5 105.1,533.7 117.7,533.7 L171.1,533.7 L171.1,605.1 C171.1,620.5 183.6,633 199,633 C214.4,633 226.9,620.5 226.9,605.1 L226.9,533.7 L285.1,533.7 L285.1,605.1 C285.1,620.5 297.6,633 313,633 C328.4,633 340.9,620.5 340.9,605.1 L340.9,533.7 L394.3,533.7 C406.9,533.7 417.1,523.5 417.1,510.9 L417.1,335.7 L94.9,335.7 Z" />
        <path d="M460.1,335.7 C444.7,335.7 432.2,348.2 432.2,363.6 L432.2,472.9 C432.2,488.3 444.7,500.8 460.1,500.8 C475.5,500.8 488,488.3 488,472.9 L488,363.6 C488,348.2 475.5,335.7 460.1,335.7 Z" />
      </g>
    </svg>
  );
};

// ⚡️ METRIC CARD
const MetricCard = ({ title, value, color, loading, trend, prevValue }) => (
  <div className="bg-white dark:bg-gray-800 p-5 rounded-3xl border border-gray-200 dark:border-gray-700 shadow-sm relative overflow-hidden transition-all hover:shadow-md">
    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-2">{title}</p>
    {loading ? (
      <div className="h-8 w-20 bg-gray-100 dark:bg-gray-700 animate-pulse rounded-lg"></div>
    ) : (
      <div>
        <div className="flex items-baseline gap-2">
          <h2 className={`text-3xl font-black italic tracking-tighter ${color}`}>{value?.toLocaleString() || 0}</h2>
          {trend !== undefined && (
            <span className={`text-[10px] font-black ${trend >= 0 ? 'text-green-500' : 'text-red-500'}`}>
              {trend >= 0 ? '↑' : '↓'}{Math.abs(trend)}%
            </span>
          )}
        </div>
        {prevValue !== undefined && (
          <p className="text-[9px] font-bold text-gray-400 mt-1 uppercase tracking-widest">Prev: {prevValue.toLocaleString()}</p>
        )}
      </div>
    )}
    <div className={`absolute bottom-0 left-0 h-1 bg-current opacity-10 ${color}`} style={{ width: '100%' }}></div>
  </div>
);

// --- MAIN COMPONENT ---

export default function FullAdminDashboard() {
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState(null);
  const [userList, setUserList] = useState([]);
  const [dormantCounts, setDormantCounts] = useState({});

  // Posts Tab State
  const [activeTab, setActiveTab] = useState("users");
  const [postList, setPostList] = useState([]);
  const [postsPage, setPostsPage] = useState(1);
  const [postsTotalPages, setPostsTotalPages] = useState(1);
  const [editingPost, setEditingPost] = useState(null); // Now controls the inline expansion

  // Pill Modal State
  const [showPillModal, setShowPillModal] = useState(false);
  const [pillForm, setPillForm] = useState({
    text: "", type: "system", targetAudience: "global", targetId: "", expiresInHours: 24, priority: 0
  });

  // Dormant Modal Enhanced State
  const [showDormantModal, setShowDormantModal] = useState(false);
  const [selectedDays, setSelectedDays] = useState(30);
  const [dormantUsers, setDormantUsers] = useState([]);
  const [filteredDormantUsers, setFilteredDormantUsers] = useState([]);
  const [searchDormant, setSearchDormant] = useState("");
  const [selectedDormantUserIds, setSelectedDormantUserIds] = useState([]);
  const [bulkMessage, setBulkMessage] = useState("");
  const [dormantLoading, setDormantLoading] = useState(false);

  // Loading States
  const [initialLoading, setInitialLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);
  const [userMetaLoading, setUserMetaLoading] = useState(false);
  const [sendingPush, setSendingPush] = useState(false);
  const [taskLoading, setTaskLoading] = useState(false);

  // Selection & Details UI State
  const [selectedUser, setSelectedUser] = useState(null);
  const [showActivityLog, setShowActivityLog] = useState(false);
  const [pushMessage, setPushMessage] = useState({ title: "", body: "" });

  // Filters
  const [range, setRange] = useState("7days");
  const [selectedCountry, setSelectedCountry] = useState("All");
  const [showOnlyActive, setShowOnlyActive] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const router = useRouter();

  const DORMANT_PERIODS = [2, 5, 7, 14, 30];

  const fetchDormantCounts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notifications');
      const data = await res.json();
      if (res.ok) setDormantCounts(data.counts || {});
    } catch (err) {
      console.error("Dormant counts fetch failed");
    }
  }, []);

  const fetchDormantUsers = useCallback(async (days) => {
    setDormantLoading(true);
    try {
      const res = await fetch(`/api/admin/notifications?days=${days}`);
      const data = await res.json();
      if (res.ok) setSelectedDormantUserIds([]);
    } catch (err) {
      toast.error("Failed to fetch dormant users");
    } finally {
      setDormantLoading(false);
    }
  }, []);

  useEffect(() => {
    const filtered = dormantUsers.filter(user =>
      user.username?.toLowerCase().includes(searchDormant.toLowerCase()) ||
      user.deviceId?.toLowerCase().includes(searchDormant.toLowerCase()) ||
      user.country?.toLowerCase().includes(searchDormant.toLowerCase())
    );
    setFilteredDormantUsers(filtered);
  }, [searchDormant, dormantUsers]);

  const toggleDormantUser = (userId) => {
    setSelectedDormantUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const selectAllDormant = () => {
    const allIds = filteredDormantUsers.map(u => u._id);
    setSelectedDormantUserIds(allIds);
  };

  const selectNoneDormant = () => {
    setSelectedDormantUserIds([]);
  };

  const sendBulkPushWithDays = async () => {
    if (!bulkMessage.trim()) return toast.warning("Enter transmission message");
    setSendingPush(true);
    try {
      const payload = {
        type: "BULK_DORMANT",
        title: "System Update",
        message: bulkMessage.trim(),
        days: selectedDays
      };
      if (selectedDormantUserIds.length > 0) payload.userIds = selectedDormantUserIds;
      const res = await fetch('/api/admin/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (res.ok) {
        const target = selectedDormantUserIds.length > 0 ? `${selectedDormantUserIds.length} selected` : `all ${selectedDays}d+`;
        toast.success(`Mass Signal Broadcasted to ${data.sentCount} users (${target})!`);
        setShowDormantModal(false);
        setSelectedDays(30);
        setBulkMessage("");
        setSelectedDormantUserIds([]);
      } else {
        toast.error(data.error || "Broadcast Failed");
      }
    } catch (err) {
      toast.error("Broadcast Failed");
    } finally {
      setSendingPush(false);
    }
  };

  const openDormantModalForDays = (days) => {
    setSelectedDays(days);
    fetchDormantUsers(days);
    setShowDormantModal(true);
  };

  useEffect(() => {
    const init = async () => {
      await Promise.all([fetchDashboardData(true), fetchUsers(true), fetchDormantCounts()]);
      setInitialLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    if (!initialLoading) fetchDashboardData();
  }, [range]);

  useEffect(() => {
    if (!initialLoading) {
      if (activeTab === "users") {
        fetchUsers();
        setSelectedUser(null);
      } else if (activeTab === "posts") {
        fetchPosts();
      }
    }
  }, [page, postsPage, selectedCountry, showOnlyActive, activeTab]);

  const fetchDashboardData = async (isInitial = false) => {
    if (!isInitial) setStatsLoading(true);
    try {
      const res = await fetch(`/api/admin/stats?range=${range}`);
      const json = await res.json();
      if (json.success) setStats(json.data);
    } catch (err) {
      toast.error("Overview relay error");
    } finally {
      setTimeout(() => setStatsLoading(false), 500);
    }
  };

  const fetchUsers = async (isInitial = false) => {
    setTableLoading(true);
    try {
      const res = await fetch(`/api/admin/users?page=${page}&country=${selectedCountry}&activeOnly=${showOnlyActive}`);
      const data = await res.json();
      setUserList(data.users || []);
      setTotalPages(data.pages || 1);
    } catch (err) {
      toast.error("User registry sync error");
    } finally {
      setTableLoading(false);
    }
  };

  const fetchPosts = async () => {
    setTableLoading(true);
    try {
      const res = await fetch(`/api/admin/tasks?page=${postsPage}`);
      const data = await res.json();
      setPostList(data.posts || []);
      setPostsTotalPages(data.pages || 1);
    } catch (err) {
      toast.error("Post registry sync error");
    } finally {
      setTableLoading(false);
    }
  };

  const executeAdminTask = async (taskType, payload) => {
    setTaskLoading(true);
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ task: taskType, payload })
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`Task ${taskType} executed successfully`);
        return data;
      } else {
        toast.error(data.message || `Failed to execute ${taskType}`);
        return null;
      }
    } catch (err) {
      toast.error("Transmission Error");
      return null;
    } finally {
      setTaskLoading(false);
    }
  };
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

  const handleUserSelect = async (user) => {
    setSelectedUser(user);
    setShowActivityLog(false); // Reset dropdown on new select
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

  const handleBroadcastAll = async () => {
    const msg = prompt(`GLOBAL TRANSMISSION: Target ALL registered users. Enter message:`);
    if (!msg) return;
    await executeAdminTask('BROADCAST_ALL', { title: "Global Update", message: msg });
  };

  const handleGiveOC = async () => {
    if (!selectedUser) return;
    const amount = prompt(`Grant OC to ${selectedUser.username}. Enter amount:`);
    if (!amount || isNaN(amount)) return toast.warning("Invalid amount");
    await executeAdminTask('GIVE_OC', { userId: selectedUser._id, amount: parseInt(amount) });
    fetchUsers();
  };

  const handleUpdatePostStatus = async (postId, newStatus) => {
    const result = await executeAdminTask('UPDATE_POST_STATUS', { postId, status: newStatus });
    if (result) fetchPosts();
  };

  const handleDeletePost = async (postId) => {
    const confirm = window.confirm("Are you sure you want to permanently delete this post?");
    if (!confirm) return;
    const result = await executeAdminTask('DELETE_POST', { postId });
    if (result) fetchPosts();
  };

  // ⚡️ GOD-MODE POST EDITOR FUNCTIONS
  const toggleInlineEdit = (post) => {
    if (editingPost && editingPost._id === post._id) {
      setEditingPost(null); // Close if already open
    } else {
      setEditingPost(post); // Open inline row
    }
  };

  const moveMediaUp = (index) => {
    if (index === 0) return;
    const newMedia = [...editingPost.media];
    [newMedia[index - 1], newMedia[index]] = [newMedia[index], newMedia[index - 1]];
    setEditingPost({ ...editingPost, media: newMedia });
  };

  const moveMediaDown = (index) => {
    if (index === editingPost.media.length - 1) return;
    const newMedia = [...editingPost.media];
    [newMedia[index + 1], newMedia[index]] = [newMedia[index], newMedia[index + 1]];
    setEditingPost({ ...editingPost, media: newMedia });
  };

  const removeMedia = (index) => {
    const newMedia = editingPost.media.filter((_, i) => i !== index);
    setEditingPost({ ...editingPost, media: newMedia });
  };

  const handleSaveEditedPost = async (e) => {
    e.preventDefault();
    const result = await executeAdminTask('EDIT_POST', {
      postId: editingPost._id,
      title: editingPost.title,
      message: editingPost.message,
      category: editingPost.category,
      isAdminPost: editingPost.isAdminPost,
      rejectionReason: editingPost.rejectionReason,
      status: editingPost.status,
      media: editingPost.media
    });
    if (result) {
      setEditingPost(null);
      fetchPosts();
    }
  };

  const handleDeployPill = async (e) => {
    e.preventDefault();
    if (!pillForm.text) return toast.warning("Pill message text is required.");
    if (pillForm.targetAudience !== 'global' && !pillForm.targetId) {
      return toast.warning(`Target ID is required when targeting a ${pillForm.targetAudience}.`);
    }
    const result = await executeAdminTask('SEND_PILL', {
      ...pillForm,
      expiresInHours: Number(pillForm.expiresInHours),
      priority: Number(pillForm.priority)
    });
    if (result) {
      setShowPillModal(false);
      setPillForm({ text: "", type: "system", targetAudience: "global", targetId: "", expiresInHours: 24, priority: 0 });
    }
  };

  if (initialLoading) return (
    <div className="flex h-screen items-center justify-center bg-white dark:bg-gray-900 overflow-hidden relative">
      <div className="flex flex-col items-center z-10">
        <div className="flex items-center gap-4 mb-8">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600/60">Uplink</span>
          </div>
          <div className="h-[1px] w-8 bg-gray-200 dark:bg-gray-800"></div>
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-500 animate-ping"></span>
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-500/60">Auth_Secure</span>
          </div>
        </div>
        <div className="relative mb-6">
          <div className="h-20 w-20 rounded-full border-[3px] border-blue-600/10 border-t-blue-600 animate-spin"></div>
          <div className="absolute top-2 left-2 h-16 w-16 rounded-full border-[3px] border-transparent border-t-orange-500 animate-[spin_1.5s_linear_infinite_reverse]"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-2 w-2 bg-white dark:bg-gray-900 rounded-full shadow-[0_0_10px_#2563eb]"></div>
        </div>
        <div className="text-center">
          <h2 className="text-xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white mb-1">
            Verifying Admin Access
          </h2>
          <div className="w-48 h-1 bg-gray-100 dark:bg-gray-800 rounded-full mt-4 overflow-hidden relative">
            <div className="absolute inset-y-0 left-0 bg-blue-600 w-1/2 animate-[loading_2s_ease-in-out_infinite] rounded-full shadow-[0_0_10px_#2563eb]"></div>
          </div>
          <div className="mt-4 flex flex-col gap-1">
            <p className="text-[8px] font-bold text-gray-400 uppercase tracking-[0.3em] animate-pulse">Establishing Encrypted Session...</p>
            <p className="text-[7px] font-mono text-gray-500/50 uppercase">Protocol: TLS_AES_256_GCM_SHA384</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 dark:bg-gray-900 text-gray-900 dark:text-gray-100 transition-colors duration-500">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col xl:flex-row justify-between items-start xl:items-center mb-10 gap-6">
          <div className="w-full xl:w-auto flex justify-between items-center">
            <div>
              <h1 className="text-3xl md:text-4xl font-black italic tracking-tighter uppercase text-gray-900 dark:text-white">
                Command Center
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <div className="h-1 w-12 bg-blue-600"></div>
                <span className="text-[8px] font-black uppercase tracking-widest text-gray-400">System v4.0.2</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full xl:w-auto">
            <div className="hidden md:flex gap-2">
              <button onClick={() => setShowPillModal(true)} className="flex bg-purple-600/10 border border-purple-600/20 px-4 py-2 rounded-2xl items-center gap-4 group hover:bg-purple-600 transition-all active:scale-95">
                <div className="text-left">
                  <p className="text-[8px] font-black text-purple-600 group-hover:text-white uppercase tracking-widest">Deploy Pill</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white group-hover:text-white">Marquee</p>
                </div>
                <span className="bg-purple-600 text-white p-2 rounded-xl group-hover:bg-white group-hover:text-purple-600 transition-colors">💊</span>
              </button>

              <div className="flex bg-orange-500/5 border-2 border-orange-500/20 rounded-2xl p-1">
                {DORMANT_PERIODS.map(days => (
                  <button
                    key={days}
                    onClick={() => openDormantModalForDays(days)}
                    className={`px-4 py-2 rounded-xl text-[11px] font-black uppercase transition-all flex-1 text-center gap-1 ${selectedDays === days
                      ? 'bg-orange-500 text-white shadow-md shadow-orange-500/30'
                      : 'text-orange-600 hover:bg-orange-500/10 hover:text-orange-500'
                      }`}
                  >
                    {days}d+
                    <span className="text-xs font-normal">({dormantCounts[days] || 0})</span>
                  </button>
                ))}
              </div>

              <button onClick={handleBroadcastAll} disabled={taskLoading || sendingPush} className="flex bg-blue-600/10 border border-blue-600/20 px-4 py-2 rounded-2xl items-center gap-4 group hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50">
                <div className="text-left">
                  <p className="text-[8px] font-black text-blue-600 group-hover:text-white uppercase tracking-widest">Global Broadcast</p>
                  <p className="text-sm font-black text-gray-900 dark:text-white group-hover:text-white">All Users</p>
                </div>
                <span className="bg-blue-600 text-white p-2 rounded-xl group-hover:bg-white group-hover:text-blue-600 transition-colors">
                  {taskLoading ? <div className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full"></div> : "📢"}
                </span>
              </button>
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-4 md:flex w-full md:w-auto bg-white dark:bg-gray-800 p-1.5 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm gap-1">
              {[
                { id: 'today', label: 'Today' },
                { id: 'yesterday', label: 'Yesterday' },
                { id: '24h', label: '24H' },
                { id: '7days', label: '7 Days' },
                { id: '30days', label: '30 Days' },
                { id: 'thisMonth', label: 'Month' },
                { id: 'lastMonth', label: 'Prev' }
              ].map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRange(r.id)}
                  className={`px-3 py-2.5 md:py-2 rounded-xl text-[9px] font-black uppercase transition-all
${range === r.id
                      ? "bg-blue-600 text-white shadow-md shadow-blue-600/30 active:scale-95"
                      : "text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-600 dark:hover:text-gray-200"
                    }
`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>
        </header>

        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
          <MetricCard title="Total Users" value={stats?.totalUsers} prevValue={stats?.prevTotalUsers} trend={stats?.usersTrend} color="text-blue-600" loading={statsLoading} />
          <MetricCard title="App Opens (Total)" value={stats?.totalAppOpens} prevValue={stats?.prevTotalAppOpens} trend={stats?.activityTrend} color="text-purple-500" loading={statsLoading} />
          <MetricCard title="Unique Active (24h)" value={stats?.uniqueDailyActive || 0} prevValue={stats?.prevUniqueDailyActive} trend={stats?.activeTrend} color="text-indigo-500" loading={statsLoading} />
          <MetricCard title="Pending" value={stats?.postStats?.pending} prevValue={stats?.postStats?.prevPending} trend={stats?.postStats?.pendingTrend} color="text-orange-500" loading={statsLoading} />
          <MetricCard title="Approved" value={stats?.postStats?.approved} prevValue={stats?.postStats?.prevApproved} trend={stats?.postStats?.approvedTrend} color="text-green-500" loading={statsLoading} />
          <MetricCard title="Rejected" value={stats?.postStats?.rejected} prevValue={stats?.postStats?.prevRejected} trend={stats?.postStats?.rejectedTrend} color="text-red-500" loading={statsLoading} />
        </div>

        {showDormantModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-6 w-full max-w-4xl max-h-[90vh] border border-orange-200 dark:border-orange-700 shadow-2xl relative overflow-hidden flex flex-col">
              <div className="flex justify-between items-center mb-6 p-2">
                <div>
                  <h3 className="text-2xl font-black italic uppercase text-orange-600">🚀 Dormant Users ({selectedDays}d+)</h3>
                  <p className="text-sm text-gray-500">
                    {filteredDormantUsers.length} shown | {dormantUsers.length} total |
                    <span className="font-black text-orange-500 ml-1">{selectedDormantUserIds.length} selected</span>
                  </p>
                </div>
                <button onClick={() => setShowDormantModal(false)} className="p-2 bg-gray-100 dark:bg-gray-800 hover:bg-red-100 hover:text-red-500 rounded-full transition-colors">
                  ❌
                </button>
              </div>

              <div className="flex gap-4 mb-6 p-2 bg-gray-50 dark:bg-gray-800/50 rounded-2xl">
                <input
                  type="text"
                  placeholder="Search username, device, country..."
                  value={searchDormant}
                  onChange={(e) => setSearchDormant(e.target.value)}
                  className="flex-1 bg-white dark:bg-gray-900 p-3 rounded-xl border border-gray-200 dark:border-gray-700 focus:ring-2 focus:ring-orange-500 outline-none"
                />
                <button onClick={selectAllDormant} className="px-4 py-3 bg-green-500 text-white rounded-xl font-black uppercase text-xs hover:bg-green-600">All</button>
                <button onClick={selectNoneDormant} className="px-4 py-3 bg-gray-500 text-white rounded-xl font-black uppercase text-xs hover:bg-gray-600">None</button>
              </div>

              <div className="flex-1 overflow-auto mb-6 custom-scrollbar">
                {dormantLoading ? (
                  <div className="flex items-center justify-center p-20">
                    <div className="flex flex-col items-center">
                      <div className="h-10 w-10 animate-spin rounded-full border-4 border-orange-500 border-t-transparent mb-4"></div>
                      <p className="font-black text-gray-400 text-xs uppercase tracking-widest">Loading dormant users...</p>
                    </div>
                  </div>
                ) : filteredDormantUsers.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">
                    <p className="text-lg mb-2">😴 No dormant users found</p>
                    <p className="text-xs uppercase tracking-widest">Try different days threshold</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredDormantUsers.map((user) => (
                      <div key={user._id} className="flex items-center p-4 bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all group">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <input
                            type="checkbox"
                            checked={selectedDormantUserIds.includes(user._id)}
                            onChange={() => toggleDormantUser(user._id)}
                            className="w-5 h-5 text-orange-500 rounded focus:ring-orange-500"
                          />
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <div className="font-black text-sm truncate">{user.username || 'Anonymous'}</div>
                            <span className="text-xs text-gray-400 font-mono truncate">{user.deviceId?.slice(-8)}</span>
                            <span className="text-xs uppercase">{getFlagEmoji(user.country)}</span>
                            <span className="text-xs font-bold text-orange-500">{getDaysInactive(user.lastActive)}</span>
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t border-gray-200 dark:border-gray-700 pt-6 p-2">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-[11px] font-black uppercase text-gray-500 tracking-widest">Transmission Message</label>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${selectedDormantUserIds.length > 0
                    ? 'bg-green-500/20 text-green-600 border border-green-500/30'
                    : 'bg-gray-500/20 text-gray-600'
                    }`}>
                    Send to {selectedDormantUserIds.length}/{filteredDormantUsers.length}
                  </span>
                </div>
                <textarea
                  rows="4"
                  value={bulkMessage}
                  onChange={(e) => setBulkMessage(e.target.value)}
                  placeholder="Message for selected dormant users..."
                  className="w-full bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 font-medium focus:ring-2 focus:ring-orange-500 resize-none mb-4"
                />
                <button
                  onClick={sendBulkPushWithDays}
                  disabled={sendingPush || !bulkMessage.trim()}
                  className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-4 px-6 rounded-2xl font-black uppercase tracking-wide text-sm hover:from-orange-600 hover:to-orange-700 disabled:opacity-50 transition-all shadow-xl shadow-orange-400/25 flex items-center justify-center gap-3"
                >
                  {sendingPush ? (
                    <>
                      <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Broadcasting...
                    </>
                  ) : (
                    <>
                      🚀 Send {selectedDormantUserIds.length > 0 ? 'Selected' : 'All Dormant'} Users
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white dark:bg-gray-800 p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border border-gray-200 dark:border-gray-700 relative overflow-hidden">
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-black text-[10px] uppercase tracking-widest text-gray-400 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-blue-600 animate-ping"></span>
                Activity Flow (Tri-Metric)
              </h3>

              {/* ⚡️ NEW: Triple Metric Legend */}
              <div className="hidden md:flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-600 shadow-[0_0_8px_rgba(37,99,235,0.4)]"></div>
                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Total Pulses</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.4)]"></div>
                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Unique Operators</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gradient-to-t from-green-500 to-gray-800 border border-gray-600"></div>
                  <span className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Platform (And/iOS)</span>
                </div>
              </div>
            </div>

            {statsLoading && (
              <div className="absolute inset-0 bg-white/60 dark:bg-gray-800/60 z-30 flex items-center justify-center backdrop-blur-[2px] transition-all">
                <div className="flex flex-col items-center">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent"></div>
                  <p className="mt-2 text-[8px] font-black text-blue-600 uppercase tracking-widest">Updating Data...</p>
                </div>
              </div>
            )}

            <div className="overflow-x-auto pb-4 scrollbar-hide">
              <div className="flex items-end justify-between h-64 gap-1 md:gap-3 min-w-[600px] md:min-w-full px-2">
                {stats?.dailyActivity?.map((data, idx) => {

                  // Scale based purely on the highest 'count' since Unique & Platforms are subsets/equal to Total Count
                  const maxVal = Math.max(
                    ...stats.dailyActivity.map(d => d.count),
                    1
                  );

                  const platformTotal = (data.iosCount || 0) + (data.androidCount || 0);

                  let displayDate = data._id;
                  if (!['24h', 'today', 'yesterday'].includes(range)) {
                    const d = new Date(data._id);
                    displayDate = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                  }

                  const shouldShowLabel = stats.dailyActivity.length <= 10 || idx % (stats.dailyActivity.length > 24 ? 4 : 1) === 0;

                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center group relative h-full">

                      {/* ⚡️ NEW: Advanced Tri-Metric Tooltip */}
                      <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-black/90 text-white text-[9px] font-black uppercase p-3 rounded-xl z-50 pointer-events-none whitespace-nowrap shadow-2xl flex flex-col gap-1 border border-gray-700">
                        <span className="text-blue-400">Total: {data.count} <span className="text-gray-500">({data.prevCount} prev)</span></span>
                        <span className="text-purple-400">Unique: {data.uniqueCount} <span className="text-gray-500">({data.prevUniqueCount} prev)</span></span>
                        <span className="text-green-400 mt-1 pt-1 border-t border-gray-800">
                          Android: {data.androidCount} <span className="text-gray-600 mx-1">|</span> <span className="text-gray-200">iOS/Web: {data.iosCount}</span>
                        </span>
                      </div>

                      <div className="flex-1 flex items-end justify-center gap-0.5 md:gap-1 w-full h-full relative">

                        {/* ⚡️ Bar 1: Total Activity */}
                        <div
                          className={`w-full max-w-[8px] md:max-w-[12px] rounded-t-md transition-all duration-1000 ease-out group-hover:brightness-110 
${data.count > 0 ? 'bg-blue-600 shadow-[0_0_10px_rgba(37,99,235,0.2)]' : 'bg-gray-100 dark:bg-gray-800'}`}
                          style={{ height: `${Math.max((data.count / maxVal) * 140, 4)}px` }}
                        ></div>

                        {/* ⚡️ Bar 2: Unique Active Users */}
                        <div
                          className={`w-full max-w-[8px] md:max-w-[12px] rounded-t-md transition-all duration-1000 ease-out group-hover:brightness-110 
${data.uniqueCount > 0 ? 'bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-gray-100 dark:bg-gray-800'}`}
                          style={{ height: `${Math.max((data.uniqueCount / maxVal) * 140, 4)}px` }}
                        ></div>

                        {/* ⚡️ Bar 3: Stacked Platform Breakdown */}
                        {platformTotal > 0 ? (
                          <div
                            className="w-full max-w-[8px] md:max-w-[12px] flex flex-col justify-end rounded-t-md overflow-hidden transition-all duration-1000 ease-out group-hover:brightness-110"
                            style={{ height: `${Math.max((platformTotal / maxVal) * 140, 4)}px` }}
                          >
                            <div style={{ flexGrow: data.iosCount }} className="bg-gray-800 dark:bg-gray-300 w-full"></div>
                            <div style={{ flexGrow: data.androidCount }} className="bg-green-500 w-full"></div>
                          </div>
                        ) : (
                          <div className="w-full max-w-[8px] md:max-w-[12px] rounded-t-md bg-gray-100 dark:bg-gray-800" style={{ height: '4px' }}></div>
                        )}

                      </div>

                      <div className="h-6 flex items-center justify-center mt-2">
                        {shouldShowLabel ? (
                          <p className="text-[8px] text-gray-400 font-black uppercase text-center tracking-tighter group-hover:text-blue-600 transition-colors whitespace-nowrap">
                            {displayDate}
                          </p>
                        ) : (
                          <div className="w-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-200 dark:border-gray-700 flex-1">
              <h3 className="font-black text-[10px] uppercase tracking-widest mb-6 text-gray-400 italic underline decoration-blue-600 decoration-2 underline-offset-4">Platform OS Breakdown</h3>
              <div className="space-y-3">
                {stats?.platforms?.map(p => (
                  <div key={p._id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-transparent hover:border-blue-500/20 transition-all">
                    <div className="flex items-center gap-3">
                      {getPlatformIcon(p._id)}
                      <span className="font-black text-xs text-gray-700 dark:text-gray-300 uppercase">{p._id || "Unknown"}</span>
                    </div>
                    <span className="font-black text-blue-600 text-xs px-2 py-1 bg-blue-600/5 rounded-lg">{p.count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-[2.5rem] border border-gray-200 dark:border-gray-700 flex-1">
              <h3 className="font-black text-[10px] uppercase tracking-widest mb-6 text-gray-400 italic underline decoration-blue-600 decoration-2 underline-offset-4">Origin Pulse</h3>
              <div className="space-y-2 overflow-y-auto max-h-[150px] pr-2 custom-scrollbar">
                {stats?.countries?.map(c => (
                  <div key={c._id} className="flex items-center justify-between p-3 rounded-2xl bg-gray-50 dark:bg-gray-900 border border-transparent hover:border-blue-500/20 transition-all">
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
        </div>

        <div className="flex items-center gap-4 mb-6 px-2">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'users' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            User Registry
          </button>
          <button
            onClick={() => setActiveTab('posts')}
            className={`px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${activeTab === 'posts' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            Transmission Logs
          </button>
        </div>

        {activeTab === 'users' && (
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl mb-20 animate-in fade-in duration-300">
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
                    <th className="px-6 py-5">Operator Info</th>
                    <th className="px-6 py-5 text-center">Device</th>
                    <th className="px-6 py-5">Location</th>
                    <th className="px-6 py-5">Activity</th>
                    <th className="px-6 py-5">OC Balance</th>
                    <th className="px-6 py-5">Last Comms</th>
                    <th className="px-6 py-5 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="7" className="p-20 text-center">
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
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-4">
                          <Image
                            height={40}
                            width={40}
                            src={getOptimizedCloudinaryUrl(u.profilePic?.url || u.image || u.avatar) || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
                            className="h-10 w-10 rounded-2xl object-cover border border-gray-200 dark:border-gray-700 bg-gray-100 shadow-sm"
                            alt="pfp"
                          />
                          <div>
                            <p className="font-black text-gray-900 dark:text-white text-sm">{u.username || "ANONYMOUS"}</p>
                            <p className="text-[9px] text-gray-400 font-mono uppercase tracking-tighter">ID: {u._id.slice(-8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex justify-center" title={u.platform || 'Unknown'}>
                          {getPlatformIcon(u.platform)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-[10px] uppercase flex items-center gap-2">
                          <span className="text-base leading-none">{getFlagEmoji(u.country)}</span>
                          {u.country || "---"}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-[11px] text-purple-500 bg-purple-500/10 px-2 py-1 rounded-lg">{u.appOpens || 0}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-black text-[11px] text-yellow-600 bg-yellow-500/10 px-2 py-1 rounded-lg border border-yellow-500/20">{u.coins || 0} OC</span>
                      </td>
                      <td className="px-6 py-4 text-[10px] font-bold text-gray-400 uppercase">
                        {u.lastActive ? new Date(u.lastActive).toLocaleString('en-NG', { dateStyle: 'short', timeStyle: 'short' }) : 'Never'}
                      </td>
                      <td className="px-6 py-4">
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
        )}

        {/* ⚡️ ENHANCED GOD-MODE POST VIEWER (WITH INLINE ROW EXPANSION) */}
        {activeTab === 'posts' && (
          <div className="bg-white dark:bg-gray-800 rounded-[2.5rem] border border-gray-200 dark:border-gray-700 overflow-hidden shadow-xl mb-20 animate-in fade-in duration-300">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center gap-4">
              <h3 className="font-black text-xl italic uppercase tracking-tighter">Transmission Logs</h3>
              {taskLoading && <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent animate-spin rounded-full"></div>}
            </div>

            <div className="overflow-x-auto min-h-[400px]">
              <table className="w-full text-left">
                <thead className="bg-gray-50 dark:bg-gray-900 text-[9px] uppercase font-black text-gray-400 tracking-[0.2em]">
                  <tr>
                    <th className="px-8 py-5">Log Data</th>
                    <th className="px-8 py-5">Author</th>
                    <th className="px-8 py-5">Category</th>
                    <th className="px-8 py-5 text-center">Status</th>
                    <th className="px-8 py-5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                  {tableLoading ? (
                    <tr>
                      <td colSpan="5" className="p-20 text-center">
                        <div className="flex flex-col items-center">
                          <div className="h-10 w-10 animate-spin rounded-full border-4 border-blue-600 border-t-transparent mb-4"></div>
                          <p className="font-black text-gray-300 text-[9px] uppercase tracking-[0.3em]">Querying Transmissions...</p>
                        </div>
                      </td>
                    </tr>
                  ) : postList.map((post) => (
                    <React.Fragment key={post._id}>
                      <tr className={`hover:bg-gray-50 dark:hover:bg-white/5 transition-all ${editingPost?._id === post._id ? 'bg-blue-50 dark:bg-blue-900/10' : ''}`}>
                        <td className="px-8 py-4 max-w-xs">
                          <p className="font-black text-gray-900 dark:text-white text-sm truncate flex items-center gap-2">
                            {post.isAdminPost && <span className="text-[8px] bg-red-500 text-white px-2 rounded-full uppercase">Admin</span>}
                            {post.title}
                          </p>
                          <p className="text-[9px] text-gray-400 font-mono uppercase truncate mt-1">{post.message}</p>
                        </td>
                        <td className="px-8 py-4 text-[11px] font-bold text-gray-500 uppercase">
                          {post.authorName || "Unknown"}
                        </td>
                        <td className="px-8 py-4">
                          <span className="font-black text-[9px] uppercase bg-gray-100 dark:bg-gray-700 px-2 py-1 rounded-md">{post.category || "News"}</span>
                        </td>
                        <td className="px-8 py-4 text-center">
                          <span className={`font-black text-[9px] uppercase px-3 py-1 rounded-xl ${post.status === 'approved' ? 'bg-green-500/10 text-green-500' :
                            post.status === 'rejected' ? 'bg-red-500/10 text-red-500' :
                              'bg-orange-500/10 text-orange-500'
                            }`}>
                            {post.status}
                          </span>
                        </td>
                        <td className="px-8 py-4 flex items-center justify-end gap-2">
                          <button onClick={() => handleUpdatePostStatus(post._id, 'approved')} className="p-2 bg-green-500/10 text-green-500 hover:bg-green-500 hover:text-white rounded-lg transition-colors" title="Approve">✔️</button>
                          <button onClick={() => handleUpdatePostStatus(post._id, 'rejected')} className="p-2 bg-orange-500/10 text-orange-500 hover:bg-orange-500 hover:text-white rounded-lg transition-colors" title="Reject">⚠️</button>

                          {/* ⚡️ The Edit button now toggles the inline expansion drawer */}
                          <button onClick={() => toggleInlineEdit(post)} className={`p-2 rounded-lg transition-colors ${editingPost?._id === post._id ? 'bg-blue-600 text-white' : 'bg-blue-500/10 text-blue-500 hover:bg-blue-500 hover:text-white'}`} title="Edit">
                            {editingPost?._id === post._id ? '🔽' : '✏️'}
                          </button>

                          <button onClick={() => handleDeletePost(post._id)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors" title="Delete">🗑️</button>
                        </td>
                      </tr>

                      {/* ⚡️ NEW INLINE EDITOR EXPANSION DRAWER */}
                      {editingPost && editingPost._id === post._id && (
                        <tr>
                          <td colSpan="5" className="p-0 border-b-2 border-blue-500 bg-gray-50 dark:bg-gray-800/80">
                            <div className="p-6 md:p-8 border-l-4 border-blue-500 shadow-inner animate-in slide-in-from-top-4 duration-300">

                              <div className="flex items-center gap-3 mb-6">
                                <span className="text-3xl">📝</span>
                                <div>
                                  <h3 className="text-xl font-black italic uppercase tracking-tighter text-blue-600">Command Override</h3>
                                  <p className="text-[10px] font-mono text-gray-500 uppercase tracking-widest mt-1">ID: {editingPost._id}</p>
                                </div>
                              </div>

                              <div className="flex flex-wrap gap-2 mb-6 bg-white dark:bg-gray-900 p-3 rounded-2xl border border-gray-200 dark:border-gray-700">
                                <span className="text-[10px] font-black text-gray-500 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-xl uppercase">❤️ {editingPost.likeCount || 0} Likes</span>
                                <span className="text-[10px] font-black text-gray-500 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-xl uppercase">💬 {editingPost.comments?.length || 0} Comments</span>
                                <span className="text-[10px] font-black text-gray-500 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-xl uppercase">👁️ {editingPost.views || 0} Views</span>
                                <span className="text-[10px] font-black text-gray-500 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-xl uppercase text-orange-500">🔥 {editingPost.hypePoints || 0} Hype</span>
                              </div>

                              <form onSubmit={handleSaveEditedPost} className="space-y-6">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Title</label>
                                    <input
                                      type="text"
                                      value={editingPost.title}
                                      onChange={(e) => setEditingPost({ ...editingPost, title: e.target.value })}
                                      className="w-full bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 font-bold outline-none focus:ring-2 ring-blue-500 text-sm"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Category</label>
                                    <input
                                      type="text"
                                      value={editingPost.category || "News"}
                                      onChange={(e) => setEditingPost({ ...editingPost, category: e.target.value })}
                                      className="w-full bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 font-bold outline-none focus:ring-2 ring-blue-500 text-sm"
                                    />
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Message</label>
                                  <textarea
                                    rows="4"
                                    value={editingPost.message}
                                    onChange={(e) => setEditingPost({ ...editingPost, message: e.target.value })}
                                    className="w-full bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 font-medium outline-none focus:ring-2 ring-blue-500 resize-none text-sm"
                                  />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700">
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-3">Status Override</label>
                                    <select
                                      value={editingPost.status}
                                      onChange={(e) => setEditingPost({ ...editingPost, status: e.target.value })}
                                      className="w-full bg-gray-50 dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700 font-black text-[11px] uppercase outline-none focus:ring-2 ring-blue-500"
                                    >
                                      <option value="pending">⏳ Pending</option>
                                      <option value="approved">✅ Approved</option>
                                      <option value="rejected">❌ Rejected</option>
                                      <option value="pending_media">📁 Pending Media</option>
                                    </select>
                                  </div>

                                  <div className="bg-white dark:bg-gray-900 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 flex items-center justify-between">
                                    <div>
                                      <label className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest block">Is Admin Post?</label>
                                      <p className="text-[8px] font-medium text-gray-500 uppercase mt-1">Forces System Tag on UI</p>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setEditingPost({ ...editingPost, isAdminPost: !editingPost.isAdminPost })}
                                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${editingPost.isAdminPost ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                                    >
                                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${editingPost.isAdminPost ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Rejection / Mod Reason</label>
                                  <input
                                    type="text"
                                    value={editingPost.rejectionReason || ""}
                                    onChange={(e) => setEditingPost({ ...editingPost, rejectionReason: e.target.value })}
                                    placeholder="E.g. Not anime related..."
                                    className="w-full bg-red-500/5 p-4 rounded-2xl border border-red-500/20 font-mono text-red-500 outline-none focus:ring-2 ring-red-500 text-xs"
                                  />
                                </div>

                                {/* Media Array Manager */}
                                {editingPost.media && editingPost.media.length > 0 && (
                                  <div>
                                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-3">Media Manager ({editingPost.media.length} files)</label>
                                    <div className="space-y-2">
                                      {editingPost.media.map((item, index) => (
                                        <div key={index} className="flex items-center gap-4 bg-white dark:bg-gray-900 p-2 pr-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                          <Image
                                            src={getOptimizedCloudinaryUrl(item.url)}
                                            width={40} height={40}
                                            className="h-10 w-10 rounded-lg object-cover bg-gray-200"
                                            alt={`media-${index}`}
                                          />
                                          <div className="flex-1 min-w-0">
                                            <p className="text-[9px] font-mono text-gray-500 truncate">{item.url}</p>
                                            <p className="text-[8px] font-black uppercase tracking-widest text-blue-500">TYPE: {item.type}</p>
                                          </div>
                                          <div className="flex items-center gap-1">
                                            <button type="button" onClick={() => moveMediaUp(index)} disabled={index === 0} className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded-md disabled:opacity-30 hover:bg-blue-500 hover:text-white transition-colors">↑</button>
                                            <button type="button" onClick={() => moveMediaDown(index)} disabled={index === editingPost.media.length - 1} className="p-1.5 bg-gray-200 dark:bg-gray-700 rounded-md disabled:opacity-30 hover:bg-blue-500 hover:text-white transition-colors">↓</button>
                                            <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>
                                            <button type="button" onClick={() => removeMedia(index)} className="p-1.5 bg-red-500/10 text-red-500 rounded-md hover:bg-red-500 hover:text-white transition-colors">❌</button>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="flex justify-end gap-4 mt-6">
                                  <button
                                    type="button"
                                    onClick={() => setEditingPost(null)}
                                    className="px-6 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="submit"
                                    disabled={taskLoading}
                                    className="flex-1 max-w-sm bg-blue-600 text-white px-6 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-blue-700 transition-all flex justify-center items-center shadow-lg shadow-blue-500/30"
                                  >
                                    {taskLoading ? <div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div> : "Deploy Override to Server"}
                                  </button>
                                </div>
                              </form>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-gray-50 dark:bg-gray-900/30 flex justify-between items-center px-8 border-t border-gray-100 dark:border-gray-700">
              <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Log Page {postsPage} / {postsTotalPages}</span>
              <div className="flex gap-2">
                <button
                  disabled={postsPage === 1 || tableLoading}
                  onClick={() => setPostsPage(p => p - 1)}
                  className="px-5 py-2 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 disabled:opacity-30 font-black text-[9px] uppercase hover:shadow-md transition-all active:scale-95"
                >
                  PREV
                </button>
                <button
                  disabled={postsPage === postsTotalPages || tableLoading}
                  onClick={() => setPostsPage(p => p + 1)}
                  className="px-5 py-2 rounded-xl bg-blue-600 text-white font-black text-[9px] uppercase hover:bg-blue-700 shadow-lg shadow-blue-500/20 active:scale-95"
                >
                  NEXT
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ⚡️ GOD-MODE USER DETAILS (FULL SCHEMA DISPLAY) */}
        {selectedUser && activeTab === 'users' && (
          <div className="bg-white dark:bg-gray-800 rounded-[3rem] border-2 border-blue-600/30 p-8 shadow-2xl animate-in fade-in slide-in-from-bottom-8 duration-500 mb-20 relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 z-10">
              <button
                onClick={() => setSelectedUser(null)}
                className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full text-gray-400 hover:text-red-500 transition-all hover:rotate-90"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left Column: Avatar & Quick Actions */}
              <div className="flex flex-col items-center lg:items-start shrink-0">
                <div className="relative mb-6">
                  <Image
                    width={176}
                    height={176}
                    src={getOptimizedCloudinaryUrl(selectedUser.profilePic?.url || selectedUser.image || selectedUser.avatar) || 'https://cdn-icons-png.flaticon.com/512/149/149071.png'}
                    className="h-44 w-44 rounded-[3rem] object-cover border-4 border-white dark:border-gray-700 shadow-2xl bg-gray-100"
                    alt="Avatar"
                  />
                  {selectedUser.role === 'Admin' && (
                    <div className="absolute -bottom-3 -right-3 bg-red-500 text-white px-3 py-1 rounded-xl text-[10px] font-black uppercase shadow-lg border-2 border-white dark:border-gray-800">Admin</div>
                  )}
                </div>

                <Link
                  href={`/author/${selectedUser.deviceId || selectedUser._id}`}
                  className="w-full bg-blue-600 text-white px-6 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] text-center hover:bg-blue-700 hover:shadow-xl transition-all flex items-center justify-center gap-2 group mb-3"
                >
                  Access Profile <span className="group-hover:translate-x-1 transition-transform">↗</span>
                </Link>

                <div className="w-full bg-blue-600/5 p-4 rounded-2xl border border-blue-600/10 text-center flex flex-col justify-center gap-2">
                  <label className="text-[9px] font-black text-gray-400 uppercase block">Total Transmissions</label>
                  {userMetaLoading ? (
                    <div className="h-8 w-12 bg-gray-200 dark:bg-gray-700 animate-pulse rounded mx-auto"></div>
                  ) : (
                    <p className="text-4xl font-black text-blue-600">{selectedUser.postCount} <span className="text-[10px] tracking-widest italic opacity-50 uppercase">Posts</span></p>
                  )}
                  <button
                    onClick={handleGiveOC}
                    disabled={taskLoading}
                    className="mt-2 text-[9px] font-black bg-yellow-500 text-white uppercase tracking-widest py-2 rounded-xl shadow-lg shadow-yellow-500/30 hover:bg-yellow-600 active:scale-95 transition-all"
                  >
                    {taskLoading ? "Processing..." : "Grant OC 🪙"}
                  </button>
                </div>
              </div>

              {/* Right Column: Full Schema Breakdown */}
              <div className="flex-1 space-y-6">

                {/* Header Info */}
                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-1 italic">Operator Signature</label>
                  <h2 className="text-4xl font-black italic tracking-tighter uppercase mb-1">{selectedUser.username || "ANONYMOUS OPERATOR"}</h2>
                  <div className="flex gap-2 flex-wrap mt-2">
                    <span className="text-[10px] font-mono text-blue-500 bg-blue-500/5 p-1.5 px-3 rounded-lg border border-blue-500/10 uppercase tracking-widest">MONGO: {selectedUser._id}</span>
                    <span className="text-[10px] font-mono text-purple-500 bg-purple-500/5 p-1.5 px-3 rounded-lg border border-purple-500/10 uppercase tracking-widest">HWID: {selectedUser.hardwareId || "N/A"}</span>
                  </div>
                </div>

                {/* Grid Info Blocks */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Security & Identity Card */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="text-blue-500">🛡️</span> Security Matrix
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Email</span>
                        <span className="text-[10px] font-mono font-bold">{selectedUser.email || "Not Provided"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">PIN Status</span>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase ${selectedUser.hasPin ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>{selectedUser.hasPin ? 'SECURED' : 'UNSECURED'}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Sec. Level</span>
                        <span className="text-[10px] font-black text-blue-500">LVL {selectedUser.securityLevel}</span>
                      </div>
                    </div>
                  </div>

                  {/* Economy Card */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="text-yellow-500">💰</span> Economy
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">OC Balance</span>
                        <span className="text-[11px] font-black text-yellow-600">{selectedUser.coins} OC</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Lifetime Spent</span>
                        <span className="text-[10px] font-black">{selectedUser.lifetimeCoinsSpent} OC</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Tokens</span>
                        <span className="text-[10px] font-black text-purple-500">{selectedUser.tokens}</span>
                      </div>
                    </div>
                  </div>

                  {/* Aura & Hype Card */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="text-cyan-500">✨</span> Power Scaling
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Total Aura</span>
                        <span className="text-[11px] font-black text-cyan-500">{selectedUser.aura}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Peak Level</span>
                        <span className="text-[10px] font-black">LVL {selectedUser.peakLevel}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Hype (R/G)</span>
                        <span className="text-[10px] font-black text-orange-500">{selectedUser.totalHypePointsReceived} / {selectedUser.totalHypePointsGiven}</span>
                      </div>
                    </div>
                  </div>

                  {/* Engagement Card */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-700">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="text-green-500">📈</span> Engagement
                    </h4>
                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Total Likes</span>
                        <span className="text-[10px] font-black">{selectedUser.totalLikes}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Total Views</span>
                        <span className="text-[10px] font-black">{selectedUser.totalViews}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-[9px] font-bold text-gray-500 uppercase">Streak</span>
                        <span className="text-[10px] font-black text-orange-500">{selectedUser.consecutiveStreak} 🔥</span>
                      </div>
                    </div>
                  </div>

                  {/* Character/Inventory Summary Card */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 p-5 rounded-2xl border border-gray-200 dark:border-gray-700 lg:col-span-2">
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                      <span className="text-purple-500">🎒</span> Profile Assets
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Items</p>
                        <p className="font-black text-sm">{selectedUser.inventory?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Wardrobe</p>
                        <p className="font-black text-sm">{selectedUser.wardrobe?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Stickers</p>
                        <p className="font-black text-sm">{selectedUser.stickers?.owned?.length || 0}</p>
                      </div>
                      <div>
                        <p className="text-[8px] font-bold text-gray-400 uppercase mb-1">Titles Unlocked</p>
                        <p className="font-black text-sm">{selectedUser.unlockedTitles?.length || 0}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bulky Data Dropdown (Activity Log) */}
                <div className="border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden bg-white dark:bg-gray-800">
                  <button
                    onClick={() => setShowActivityLog(!showActivityLog)}
                    className="w-full flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
                  >
                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Raw Activity Log ({selectedUser.activityLog?.length || 0} Pulses)</span>
                    <span className={`transform transition-transform ${showActivityLog ? 'rotate-180' : ''}`}>▼</span>
                  </button>
                  {showActivityLog && (
                    <div className="p-4 max-h-48 overflow-y-auto custom-scrollbar bg-gray-900 text-gray-300">
                      {selectedUser.activityLog && selectedUser.activityLog.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                          {selectedUser.activityLog.slice().reverse().map((log, i) => (
                            <div key={i} className="text-[9px] font-mono bg-black/50 p-1.5 rounded border border-gray-800">
                              {new Date(log).toLocaleString()}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-[10px] font-mono text-gray-600">NO_ACTIVITY_DATA</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Signal Composer */}
                <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-[2.5rem] border border-gray-200 dark:border-gray-700 shadow-inner mt-6">
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
                          onChange={(e) => setPushMessage({ ...pushMessage, title: e.target.value })}
                          className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 text-[11px] font-black uppercase outline-none focus:ring-2 ring-blue-500 transition-all placeholder:text-gray-300"
                        />
                        <input
                          type="text"
                          placeholder="OPERATOR MESSAGE..."
                          value={pushMessage.body}
                          onChange={(e) => setPushMessage({ ...pushMessage, body: e.target.value })}
                          className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 text-[11px] font-black outline-none focus:ring-2 ring-blue-500 transition-all placeholder:text-gray-300"
                        />
                      </div>
                      <button
                        onClick={sendSinglePush}
                        disabled={sendingPush}
                        className="w-full bg-gray-900 dark:bg-white text-white dark:text-gray-900 py-4 rounded-2xl font-black text-[10px] uppercase tracking-[0.3em] hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-3 shadow-lg"
                      >
                        {sendingPush ? <div className="h-4 w-4 border-2 border-current border-t-transparent animate-spin rounded-full"></div> : "Transmit Signal"}
                      </button>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ⚡️ PILL COMPOSER MODAL */}
        {showPillModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
            <div className="bg-white dark:bg-gray-900 rounded-[2.5rem] p-8 w-full max-w-lg border border-gray-200 dark:border-gray-700 shadow-2xl relative">
              <button
                onClick={() => setShowPillModal(false)}
                className="absolute top-6 right-6 p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-red-100 hover:text-red-500 transition-colors"
              >
                ❌
              </button>
              <h3 className="text-2xl font-black italic uppercase tracking-tighter text-purple-600 mb-2">Deploy Marquee Pill</h3>
              <p className="text-xs text-gray-500 mb-6 font-medium tracking-tight">Inject a live broadcast directly into the UI.</p>

              <form onSubmit={handleDeployPill} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Theme Type</label>
                    <select
                      value={pillForm.type}
                      onChange={(e) => setPillForm({ ...pillForm, type: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 font-bold outline-none focus:ring-2 ring-purple-500"
                    >
                      <option value="system">🔵 System (Default)</option>
                      <option value="warning">🔴 Warning (Urgent)</option>
                      <option value="event">🟣 Event (Updates)</option>
                      <option value="achievement">🟡 Achievement</option>
                      <option value="drop">🟢 Drop / Bonus</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Priority (Higher = First)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={pillForm.priority}
                      onChange={(e) => setPillForm({ ...pillForm, priority: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 font-bold outline-none focus:ring-2 ring-purple-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Target Audience</label>
                    <select
                      value={pillForm.targetAudience}
                      onChange={(e) => setPillForm({ ...pillForm, targetAudience: e.target.value, targetId: "" })}
                      className="w-full bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 font-bold outline-none focus:ring-2 ring-purple-500"
                    >
                      <option value="global">🌍 Global (Everyone)</option>
                      <option value="clan">🛡️ Specific Clan</option>
                      <option value="user">👤 Specific User</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Expires In (Hours)</label>
                    <input
                      type="number"
                      min="1"
                      max="168"
                      value={pillForm.expiresInHours}
                      onChange={(e) => setPillForm({ ...pillForm, expiresInHours: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 font-bold outline-none focus:ring-2 ring-purple-500"
                    />
                  </div>
                </div>

                {pillForm.targetAudience !== 'global' && (
                  <div className="animate-in fade-in slide-in-from-top-2">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">
                      Target ID (Enter {pillForm.targetAudience === 'clan' ? 'Clan Tag' : 'User Mongo ID'})
                    </label>
                    <input
                      type="text"
                      placeholder={`E.g. ${pillForm.targetAudience === 'clan' ? 'SQUAD13' : '65a4...9f'}`}
                      value={pillForm.targetId}
                      onChange={(e) => setPillForm({ ...pillForm, targetId: e.target.value })}
                      className="w-full bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 font-mono outline-none focus:ring-2 ring-purple-500"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest block mb-2">Broadcast Message</label>
                  <textarea
                    rows="3"
                    placeholder="Enter the transmission text..."
                    value={pillForm.text}
                    onChange={(e) => setPillForm({ ...pillForm, text: e.target.value })}
                    className="w-full bg-gray-50 dark:bg-gray-800 p-4 rounded-2xl border border-gray-200 dark:border-gray-700 font-bold uppercase outline-none focus:ring-2 ring-purple-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={taskLoading}
                  className="w-full bg-purple-600 text-white p-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs hover:bg-purple-700 transition-all flex justify-center items-center mt-4 shadow-lg shadow-purple-500/20"
                >
                  {taskLoading ? <div className="h-4 w-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div> : "Inject Pill into System"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
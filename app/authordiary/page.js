"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import Link from "next/link";

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState(""); // main message + inline sections
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaUrlLink, setMediaUrlLink] = useState("");
  const [mediaType, setMediaType] = useState("image");
  const [hasPoll, setHasPoll] = useState(false);
  const [pollMultiple, setPollMultiple] = useState(false);
  const [pollOptions, setPollOptions] = useState(["", ""]);
  const [loading, setLoading] = useState(false);
  const [category, setCategory] = useState("");
  const [uploading, setUploading] = useState(false);

  const router = useRouter();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const res = await fetch("/api/auth/me", { credentials: "include" });
        if (!res.ok) {
          router.push("/auth/login");
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch {
        router.push("/auth/login");
      }
    };
    fetchUser();
  }, [router]);

  if (!user) return <p className="min-h-[75vh]">Loading...</p>;

  // --- Poll Logic ---
  const handlePollOptionChange = (i, val) => {
    const newOptions = [...pollOptions];
    newOptions[i] = val;
    setPollOptions(newOptions);
  };
  const addPollOption = () => setPollOptions([...pollOptions, ""]);
  const removePollOption = (i) => setPollOptions(pollOptions.filter((_, idx) => idx !== i));

  // --- Upload Media ---
  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const res = await fetch("/api/upload", {
        method: "POST",
        body: arrayBuffer,
      });

      const data = await res.json();
      if (data.url) {
        setMediaUrl(data.url);
        setMediaType(file.type.startsWith("video") ? "video" : "image");
        toast.success("File uploaded successfully!");
      } else toast.error("Upload failed.");
    } catch (err) {
      toast.error("Something went wrong during upload.");
    } finally {
      setUploading(false);
    }
  };

  // --- Create Post ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      const mediaToSend = mediaUrl || mediaUrlLink || null;
      const typeToSend = mediaUrl
        ? mediaType
        : mediaUrlLink
          ? mediaUrlLink.includes("video") || mediaUrlLink.includes("tiktok")
            ? "video"
            : "image"
          : null;

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          authorId: user.id,
          title,
          message, // message contains inline sections
          mediaUrl: mediaToSend,
          mediaType: typeToSend,
          hasPoll,
          pollMultiple,
          pollOptions: hasPoll
            ? pollOptions.filter((opt) => opt.trim() !== "").map((opt) => ({ text: opt }))
            : [],
          category,
        }),
      });

      const data = await res.json();
      if (!res.ok) toast.error(data.message || "Failed to create post");
      else {
        toast.success("Post created successfully!");
        setTitle("");
        setMessage("");
        setMediaUrl("");
        setMediaUrlLink("");
        setMediaType("image");
        setHasPoll(false);
        setPollMultiple(false);
        setPollOptions(["", ""]);
      }
    } catch (err) {
      toast.error("Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[70vh] relative" style={{ padding: "2rem" }}>
      {/* Subtle anime glow */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-blue-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-56 h-56 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

      <div className="flex gap-4">
        <h1 className="text-2xl">Welcome, {user.username} 👋</h1>
        <Link className="text-2xl hover:text-red-500 hover:underline" href={"authordiary/profile"}>
          Edit Profile Details
        </Link>
      </div>
      <hr className="my-6" />

      <h2>Create New Post</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Title */}
        <input
          type="text"
          placeholder="Post Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="w-full border p-2 rounded"
        />

        {/* Main Message + inline sections */}
        <label htmlFor="">Write your main message here... Use [section]Your section[/section] to add a section</label>
        <textarea
          placeholder="Write your main message here... Use [section]Your section[/section] to add a section"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={8}
          className="w-full border p-2 rounded"
        />

        {/* Category */}
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border p-2 rounded-md w-full"
        >
          <option value="News">News</option>
          <option value="Memes">Memes</option>
          <option value="Videos/Edits">Videos/Edits</option>
          <option value="Polls">Polls</option>
        </select>

        {/* Media */}
        <div className="flex flex-col gap-2">
          <input
            type="text"
            placeholder="TikTok / External URL (optional)"
            value={mediaUrlLink}
            onChange={(e) => setMediaUrlLink(e.target.value)}
            disabled={uploading}
            className="border p-2 rounded"
          />
          <input
            type="file"
            accept="image/*,video/*"
            onChange={handleFileChange}
            disabled={uploading}
            className="bg-white text-black w-fit"
          />
          {uploading && <p>Uploading...</p>}
          {mediaUrl && (
            <p className="mt-1 text-green-600">
              Uploaded {mediaType}:{" "}
              <a href={mediaUrl} target="_blank" rel="noreferrer">
                {mediaUrl}
              </a>
            </p>
          )}
        </div>

        {/* Poll */}
        <div>
          <label>
            <input type="checkbox" checked={hasPoll} onChange={(e) => setHasPoll(e.target.checked)} /> Add a poll
          </label>
        </div>
        {hasPoll && (
          <div className="space-y-2">
            <label>
              <input type="checkbox" checked={pollMultiple} onChange={(e) => setPollMultiple(e.target.checked)} /> Allow multiple selections
            </label>
            {pollOptions.map((option, i) => (
              <div key={i} className="flex gap-2 items-center">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => handlePollOptionChange(i, e.target.value)}
                  placeholder={`Option ${i + 1}`}
                  className="border p-2 rounded flex-1"
                  required
                />
                {pollOptions.length > 2 && (
                  <button type="button" onClick={() => removePollOption(i)}>❌</button>
                )}
              </div>
            ))}
            <button type="button" onClick={addPollOption} className="bg-green-500 text-white px-2 py-1 rounded">
              + Add Option
            </button>
          </div>
        )}

        <button
          type="submit"
          disabled={loading || uploading}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Creating..." : "Create Post"}
        </button>
      </form>

      <ToastContainer position="top-right" autoClose={3000} theme="colored" />
    </div>
 

  );
};

export default Dashboard;

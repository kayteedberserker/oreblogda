"use client";

import { useEffect, useState } from "react";
import { toast } from "react-toastify";

export default function CommentSection({ postId }) {
  const [comments, setComments] = useState([]);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  // 🧠 Fetch all comments
  useEffect(() => {
    const fetchComments = async () => {
      try {
        const res = await fetch(`/api/posts/${postId}/comment`);
        if (!res.ok) throw new Error("Failed to fetch comments");
        const data = await res.json();
        setComments(data.comments || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchComments();
  }, [postId]);

  // 💬 Submit new comment
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || !text.trim())
      return toast.error("Please fill in all fields.");

    setLoading(true);
    try {
      const res = await fetch(`/api/posts/${postId}/comment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, text }),
      });

      const data = await res.json();
      if (res.ok) {
        setComments((prev) => [data.comment, ...prev]);
        setText("");
      } else {
        toast.error(data.message || "Failed to send comment.");
      }
    } catch (err) {
      toast.error("Error posting comment.");
    } finally {
      setLoading(false);
    }
  };

  return (
  <div className="bg-white dark:bg-gray-900 p-5 rounded-lg shadow-md sticky top-20 max-h-[85vh] flex flex-col">
    <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">
      Comments
    </h2>

    {/* Comment Form */}
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 mb-4 flex-none">
      <input
        type="text"
        placeholder="Your name"
        className="p-2 rounded-md border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <textarea
        placeholder="Write your comment..."
        className="p-2 rounded-md border dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
      />
      <button
        type="submit"
        disabled={loading}
        className="bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md"
      >
        {loading ? "Posting..." : "Post Comment"}
      </button>
    </form>

    {/* Scrollable Comments */}
    <div
      className="space-y-4 overflow-y-auto pr-2 flex-1"
      style={{
        scrollbarWidth: "thin",
        scrollbarColor: "#4B5563 #1F2937", // dark gray on darker background
      }}
    >
      {comments.length > 0 ? (
        comments.map((c, i) => (
          <div
            key={i}
            className="border-b border-gray-200 dark:border-gray-700 pb-2"
          >
            <p className="font-semibold text-gray-800 dark:text-gray-100">
              {c.name}
            </p>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {c.text}
            </p>
            <p className="text-gray-400 text-xs mt-1">
              {new Date(c.date).toLocaleString()}
            </p>
          </div>
        ))
      ) : (
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No comments yet. Be the first to comment!
        </p>
      )}
    </div>

    <style jsx>{`
      /* Custom scrollbar styling */
      .space-y-4::-webkit-scrollbar {
        width: 6px;
      }
      .space-y-4::-webkit-scrollbar-track {
        background: transparent;
      }
      .space-y-4::-webkit-scrollbar-thumb {
        background-color: rgba(107, 114, 128, 0.5);
        border-radius: 10px;
      }
      .dark .space-y-4::-webkit-scrollbar-thumb {
        background-color: rgba(156, 163, 175, 0.3);
      }
      .space-y-4::-webkit-scrollbar-thumb:hover {
        background-color: rgba(107, 114, 128, 0.8);
      }
    `}</style>
  </div>
);

}

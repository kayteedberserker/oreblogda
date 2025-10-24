"use client";
import { useState } from "react";
import { motion } from "framer-motion";

export default function ContactPage() {
  const [form, setForm] = useState({ name: "", email: "", message: "", type: "General" });
  const [status, setStatus] = useState({ loading: false, success: "", error: "" });

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus({ loading: true, success: "", error: "" });

    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (res.ok) {
        setStatus({ loading: false, success: "Message sent successfully!", error: "" });
        setForm({ name: "", email: "", message: "", type: "General" });
      } else {
        setStatus({ loading: false, success: "", error: data.error || "Something went wrong." });
      }
    } catch (err) {
      setStatus({ loading: false, success: "", error: "Network error, try again." });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-6 py-16 bg-linear-to-br from-blue-50 via-white to-pink-50 dark:from-gray-950 dark:via-gray-900 dark:to-indigo-950 transition-colors duration-500 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-10 left-10 w-48 h-48 bg-blue-300 dark:bg-indigo-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-10 right-10 w-56 h-56 bg-pink-300 dark:bg-pink-700 opacity-20 rounded-full blur-3xl animate-pulse"></div>

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-lg w-full bg-white/80 dark:bg-gray-900/60 backdrop-blur-md p-8 rounded-2xl shadow-xl z-10"
      >
        <h1 className="text-3xl font-bold mb-6 text-center text-gray-900 dark:text-gray-100">
          Contact Oreblogda
        </h1>
        <p className="text-center text-gray-600 dark:text-gray-400 mb-8">
          Have suggestions, found a bug, or want to join our anime community?  
          Drop a message below — we’d love to hear from you!
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Your Name</label>
            <input
              type="text"
              name="name"
              value={form.name}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded-md border dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Email Address</label>
            <input
              type="email"
              name="email"
              value={form.email}
              onChange={handleChange}
              required
              className="w-full px-4 py-2 rounded-md border dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Category</label>
            <select
              name="type"
              value={form.type}
              onChange={handleChange}
              className="w-full px-4 py-2 rounded-md border dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option>General</option>
              <option>Community Join Request</option>
              <option>Bug Report</option>
              <option>Suggestion</option>
              <option>Collaboration</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1 dark:text-gray-300">Message</label>
            <textarea
              name="message"
              value={form.message}
              onChange={handleChange}
              required
              rows={5}
              className="w-full px-4 py-2 rounded-md border dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={status.loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 rounded-md"
          >
            {status.loading ? "Sending..." : "Send Message"}
          </button>

          {status.success && <p className="text-green-500 text-center mt-2">{status.success}</p>}
          {status.error && <p className="text-red-500 text-center mt-2">{status.error}</p>}
        </form>
      </motion.div>
    </div>
  );
}

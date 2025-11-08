"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (res.ok) {
        router.push("/auth/login");
      } else {
        setError(data.message || "Something went wrong");
      }
    } catch (err) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gray-900 text-white">
      <form
        onSubmit={handleSubmit}
        className="bg-gray-800 p-6 rounded-xl shadow-md w-80 flex flex-col gap-4"
      >
        <h1 className="text-2xl font-bold text-center">Create Account</h1>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <input
          name="username"
          placeholder="Username"
          className="p-2 rounded bg-gray-700"
          onChange={handleChange}
          required
        />
        <input
          type="email"
          name="email"
          placeholder="Email"
          className="p-2 rounded bg-gray-700"
          onChange={handleChange}
          required
        />
        <input
          type="password"
          name="password"
          placeholder="Password"
          className="p-2 rounded bg-gray-700"
          onChange={handleChange}
          required
        />
        <button
          aria-label="Signup"
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 rounded p-2 font-semibold"
          disabled={loading}
        >
          {loading ? "Signing up..." : "Sign Up"}
        </button>
        <p
          className="text-sm text-center text-blue-400 cursor-pointer"
          onClick={() => router.push("/auth/login")}
        >
          Already have an account? Login
        </p>
      </form>
    </div>
  );
}

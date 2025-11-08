"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      
      if (res.ok && data.user) {
        localStorage.setItem("token", data.user?.token);
        router.push("/authordiary");
      } else {
        setError(data.message || "Invalid credentials");
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
        <h1 className="text-2xl font-bold text-center">Welcome Back</h1>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
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
        aria-label="Login"
          type="submit"
          className="bg-blue-600 hover:bg-blue-500 rounded p-2 font-semibold"
          disabled={loading}
        >
          {loading ? "Logging in..." : "Login"}
        </button>
        <p
          className="text-sm text-center text-blue-400 cursor-pointer"
          onClick={() => router.push("/auth/signup")}
        >
          Don’t have an account? Sign up
        </p>
      </form>
    </div>
  );
}

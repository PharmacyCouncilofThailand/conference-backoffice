"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/lib/api";
import toast from "react-hot-toast";

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Basic client-side validation
  const validateForm = (): boolean => {
    if (!email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!email.includes("@")) {
      setError("Please enter a valid email address");
      return false;
    }
    if (!password) {
      setError("Password is required");
      return false;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Validate form
    if (!validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const data = await api.auth.login({ email, password });

      if (data.success && data.user && data.token) {
        login(data.user, data.token, rememberMe);
        toast.success(`Welcome back, ${data.user.firstName}!`);

        // Role-based redirection
        if (data.user.role === "verifier") {
          router.push("/verification");
        } else if (data.user.role === "reviewer") {
          router.push("/abstracts");
        } else if (data.user.role === "organizer") {
          router.push("/members");
        } else if (data.user.role === "staff") {
          router.push("/checkin");
        } else {
          router.push("/"); // Go to Dashboard
        }
      } else {
        setError(data.error || "Login failed");
        toast.error(data.error || "Login failed");
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Login failed. Please try again.";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — Branding panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden bg-zinc-900">
        <div className="relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500 flex items-center justify-center">
              <span className="text-white font-extrabold text-sm">C</span>
            </div>
            <span className="text-white font-bold text-lg tracking-tight">ConferenceHub</span>
          </div>
        </div>
        <div className="relative z-10 max-w-md">
          <h2 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
            Manage your conference with precision.
          </h2>
          <p className="mt-4 text-zinc-400 text-base leading-relaxed">
            Registrations, abstracts, check-ins, and payments — all in one streamlined backoffice.
          </p>
        </div>
        <p className="text-zinc-600 text-xs relative z-10">
          © {new Date().getFullYear()} ConferenceHub
        </p>
        {/* Decorative */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full opacity-[0.03]" style={{ background: 'radial-gradient(circle, #059669, transparent 70%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-[0.04]" style={{ background: 'radial-gradient(circle, #ffffff, transparent 70%)' }} />
      </div>

      {/* Right — Login form */}
      <div className="flex items-center justify-center p-6 bg-white">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-12 lg:hidden">
            <div className="w-7 h-7 rounded-lg bg-emerald-500 flex items-center justify-center">
              <span className="text-white font-extrabold text-xs">C</span>
            </div>
            <span className="font-bold text-zinc-900 tracking-tight">ConferenceHub</span>
          </div>

          <h1 className="text-2xl font-extrabold text-zinc-900 tracking-tight">Sign in</h1>
          <p className="text-zinc-400 text-sm mt-1.5 mb-8">Enter your credentials to continue</p>

          {error && (
            <div className="mb-6 px-4 py-3 rounded-xl text-sm font-medium bg-red-50 text-red-600 border border-red-100">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-[13px] font-semibold text-zinc-700 mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-[13px] font-semibold text-zinc-700 mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-field"
                placeholder="••••••••"
                required
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center cursor-pointer gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-zinc-300 accent-emerald-600"
                />
                <span className="text-[13px] text-zinc-500">Remember me</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary !py-3 text-sm"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          {process.env.NODE_ENV === "development" && (
            <div className="mt-8 px-4 py-3 rounded-xl bg-amber-50 border border-amber-100">
              <p className="text-[10px] font-semibold text-amber-500 uppercase tracking-wider mb-1">Dev credentials</p>
              <p className="text-[13px] font-mono text-zinc-600">admin@accp.org / admin123</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

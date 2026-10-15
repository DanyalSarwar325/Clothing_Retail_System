"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, AlertCircle, Loader2, Building2 } from "lucide-react";
import Link from "next/link";

export default function AccountingLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Login failed. Check your username and password.");
        setLoading(false);
        return;
      }

      // If user is admin or accountant, direct them straight into the accounting portal
      if (data.user?.role === "admin" || data.user?.role === "accountant") {
        window.location.href = "/accounting";
      } else {
        setError("Access denied: This login is reserved for the Accounting Department.");
        setLoading(false);
      }
    } catch {
      setError("An error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 p-4">
      <div className="w-full max-w-md">
        {/* Header Branding */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 text-white rounded-2xl mb-4 shadow-lg shadow-emerald-900/50">
            <Building2 size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Accounting Department
          </h1>
          <p className="text-emerald-400/80 text-sm mt-1">
            Financial Ledger & Accounts Portal
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-white rounded-2xl shadow-2xl p-8 border border-slate-100">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-start gap-2.5 p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm">
                <AlertCircle size={18} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Username
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <User size={18} />
                </div>
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter accountant username"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <Lock size={18} />
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-medium text-sm transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  <span>Verifying credentials...</span>
                </>
              ) : (
                <span>Sign in to Accounting</span>
              )}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 text-center">
            <Link
              href="/login"
              className="text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors"
            >
              ← Back to Manufacturing & Production Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

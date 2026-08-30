"use client";

import { useState } from "react";
import Link from "next/link";
import { forgotPassword } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      setError(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">
            24<span className="text-emerald-400">GO</span>
          </h1>
          <p className="text-sm text-zinc-400 mt-1">Reset your password</p>
        </div>

        {sent ? (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4 text-center">
            <div className="text-emerald-400 text-lg">Check your email</div>
            <p className="text-sm text-zinc-400">
              If an account exists with <span className="text-zinc-200">{email}</span>, you&apos;ll receive a reset link shortly.
            </p>
            <Link href="/login" className="inline-block text-sm text-emerald-400 hover:text-emerald-300 transition">
              Back to login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
            <input type="email" placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-zinc-500" />

            {error && (
              <div className="px-3 py-2 bg-rose-500/10 border border-rose-500/20 rounded-lg">
                <p className="text-xs text-rose-400">{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full py-2.5 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition disabled:opacity-50">
              {loading ? "Sending..." : "Send reset link"}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-zinc-600">
          <Link href="/login" className="hover:text-zinc-400 transition">&larr; Back to login</Link>
        </p>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getSubscription, getUsage, createCheckout } from "@/lib/api";

const PLANS = [
  {
    name: "Starter",
    price: "$149",
    period: "/mo",
    features: ["500 posts/mo", "10k tokens", "1 workspace", "Email support"],
  },
  {
    name: "Pro",
    price: "$399",
    period: "/mo",
    features: ["2,000 posts/mo", "50k tokens", "5 workspaces", "Priority support", "API access"],
  },
  {
    name: "Enterprise",
    price: "$999",
    period: "/mo",
    features: ["Unlimited posts", "200k tokens", "Unlimited workspaces", "Dedicated support", "Custom integrations", "SLA"],
  },
];

const PLAN_COLORS: Record<string, string> = {
  starter: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  pro: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  enterprise: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

export default function BillingPage() {
  const { auth } = useAuth();
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth?.token) return;
    setLoading(true);
    Promise.all([getSubscription(auth.token), getUsage(auth.token)])
      .then(([sub, u]) => {
        setSubscription(sub);
        setUsage(u);
      })
      .finally(() => setLoading(false));
  }, [auth?.token]);

  const handleUpgrade = async (plan: string) => {
    if (!auth?.token) return;
    try {
      const res = await createCheckout(auth.token, plan, "stripe");
      if (res.checkout_url) window.open(res.checkout_url);
    } catch (e) {
      console.error("Checkout failed", e);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    );
  }

  const sub = subscription ?? {};
  const planBadge = PLAN_COLORS[sub.plan?.toLowerCase()] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/20";

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-semibold text-zinc-100">Billing</h1>

      {/* Subscription */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Current Subscription</h2>
        <div className="flex flex-wrap items-center gap-6">
          <div>
            <span className={`px-2 py-0.5 rounded text-xs font-medium border ${planBadge}`}>
              {sub.plan ?? "None"}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-zinc-400">Status: </span>
            <span className="text-zinc-100">{sub.status ?? "—"}</span>
          </div>
          <div className="text-sm">
            <span className="text-zinc-400">Posts: </span>
            <span className="text-zinc-100">
              {sub.monthly_posts_used ?? 0} / {sub.monthly_posts_limit ?? "∞"}
            </span>
          </div>
          <div className="text-sm">
            <span className="text-zinc-400">Tokens: </span>
            <span className="text-zinc-100">{sub.token_credits_balance ?? 0}</span>
          </div>
        </div>
      </div>

      {/* Usage */}
      {usage && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Usage Summary</h2>
          <div className="flex gap-8">
            <div>
              <p className="text-2xl font-semibold text-zinc-100">{usage.total_tokens_used ?? 0}</p>
              <p className="text-zinc-400 text-xs">Total Tokens Used</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-zinc-100">${usage.total_cost_usd ?? "0.00"}</p>
              <p className="text-zinc-400 text-xs">Total Cost</p>
            </div>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div>
        <h2 className="text-sm font-medium text-zinc-400 mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {PLANS.map((p) => {
            const isCurrent = sub.plan?.toLowerCase() === p.name.toLowerCase();
            return (
              <div
                key={p.name}
                className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 flex flex-col"
              >
                <h3 className="text-zinc-100 font-medium text-lg">{p.name}</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold text-zinc-100">{p.price}</span>
                  <span className="text-zinc-400 text-sm">{p.period}</span>
                </div>
                <ul className="space-y-2 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="text-zinc-400 text-sm flex items-center gap-2">
                      <span className="text-zinc-600">•</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade(p.name.toLowerCase())}
                  disabled={isCurrent}
                  className={`mt-6 w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                    isCurrent
                      ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                  }`}
                >
                  {isCurrent ? "Current Plan" : "Upgrade"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getSubscription, getUsage, createCheckout } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";

const PLANS = [
  {
    name: "Starter",
    price: "$149",
    period: "/mo",
    features: ["1,500 posts/mo", "1M tokens", "5 accounts", "Email support"],
  },
  {
    name: "Pro",
    price: "$399",
    period: "/mo",
    features: ["7,500 posts/mo", "5M tokens", "20 accounts", "Priority support", "API access"],
  },
  {
    name: "Enterprise",
    price: "$999",
    period: "/mo",
    features: ["Unlimited posts", "Unlimited tokens", "Unlimited accounts", "Dedicated support", "Custom integrations", "SLA"],
  },
];

const PLAN_COLORS: Record<string, string> = {
  trial: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  starter: "bg-sky-500/10 text-sky-400 border-sky-500/20",
  pro: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  enterprise: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

export default function BillingPage() {
  const { auth } = useAuth();
  const { toast } = useToast();
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!auth?.token) return;
    setLoading(true);
    Promise.all([getSubscription(auth.token), getUsage(auth.token)])
      .then(([sub, u]) => {
        setSubscription(sub);
        setUsage(u);
      }).catch(() => {}).finally(() => setLoading(false));
  }, [auth?.token]);

  const handleUpgrade = async (plan: string) => {
    if (!auth?.token) return;
    setCheckoutBusy(plan);
    try {
      const res = await createCheckout(auth.token, plan, "stripe");
      if (res.checkout_url) window.open(res.checkout_url);
    } catch (e) {
      console.error("Checkout failed", e);
      toast("Checkout failed. Please try again.", "error");
    } finally {
      setCheckoutBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <Skeleton className="h-4 w-40" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
          <Skeleton className="h-4 w-36" />
          <div className="flex gap-8">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-7 w-24" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        </div>
        <div>
          <Skeleton className="h-4 w-32 mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-3">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-8 w-16" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-3 w-full" />
                  ))}
                </div>
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const sub = subscription ?? {};
  const currentPlan = sub.plan?.toLowerCase() || "trial";
  const planBadge = PLAN_COLORS[currentPlan] ?? PLAN_COLORS.trial;
  const postsUsed = sub.monthly_posts_used ?? 0;
  const postsLimit = sub.monthly_posts_limit ?? 500;
  const postsPct = postsLimit > 0 ? Math.round((postsUsed / postsLimit) * 100) : 0;
  const tokenBalance = sub.token_credits_balance ?? 0;
  const tokensUsed = usage?.total_tokens_used ?? 0;

  return (
    <div className="p-6 space-y-8 animate-fade-in">
      <h1 className="text-2xl font-semibold text-zinc-100">Billing</h1>

      {/* Current Subscription */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-medium text-zinc-400">Current Subscription</h2>
        <div className="flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-lg text-sm font-medium border ${planBadge} capitalize`}>
              {currentPlan}
            </span>
            <span className={`text-xs ${sub.status === "active" ? "text-emerald-400" : "text-zinc-500"}`}>
              {sub.status || "—"}
            </span>
          </div>
          <div className="text-sm text-zinc-500">
            {currentPlan === "trial" && sub.current_period_end ? (
              (() => {
                const daysLeft = Math.max(0, Math.ceil((new Date(sub.current_period_end).getTime() - Date.now()) / 86400000));
                return daysLeft > 0 ? `Trial ends in ${daysLeft} days` : "Trial expired";
              })()
            ) : (
              <>Renews: {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "—"}</>
            )}
          </div>
        </div>

        {/* Usage bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Posts This Month</span>
              <span>{postsUsed} / {postsLimit}</span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${postsPct > 80 ? "bg-rose-500" : postsPct > 50 ? "bg-amber-500" : "bg-emerald-500"}`}
                style={{ width: `${Math.min(postsPct, 100)}%` }}
              />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>Token Credits</span>
              <span>{tokenBalance.toLocaleString()} remaining</span>
            </div>
            <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${tokenBalance + tokensUsed > 0 ? Math.round((tokenBalance / (tokenBalance + tokensUsed)) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Usage */}
      {usage && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
          <h2 className="text-sm font-medium text-zinc-400 mb-4">Usage Summary</h2>
          <div className="flex gap-8">
            <div>
              <p className="text-2xl font-semibold text-zinc-100">{(usage.total_tokens_used ?? 0).toLocaleString()}</p>
              <p className="text-zinc-400 text-xs">Total Tokens Used</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-zinc-100">${(usage.total_cost_usd ?? 0).toFixed(2)}</p>
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
            const isCurrent = currentPlan === p.name.toLowerCase();
            return (
              <div
                key={p.name}
                className={`bg-zinc-900 border rounded-xl p-6 flex flex-col transition ${
                  isCurrent ? "border-emerald-500/40 ring-1 ring-emerald-500/20" : "border-zinc-800"
                }`}
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-zinc-100 font-medium text-lg">{p.name}</h3>
                  {isCurrent && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">CURRENT</span>}
                </div>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold text-zinc-100">{p.price}</span>
                  <span className="text-zinc-400 text-sm">{p.period}</span>
                </div>
                <ul className="space-y-2 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="text-zinc-400 text-sm flex items-center gap-2">
                      <span className={isCurrent ? "text-emerald-400" : "text-zinc-600"}>✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleUpgrade(p.name.toLowerCase())}
                  disabled={isCurrent || checkoutBusy !== null}
                  className={`mt-6 w-full py-2.5 rounded-lg text-sm font-medium transition ${
                    isCurrent
                      ? "bg-zinc-800 text-zinc-500 cursor-not-allowed"
                      : checkoutBusy === p.name.toLowerCase()
                        ? "bg-zinc-700 text-zinc-400 cursor-wait"
                        : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200"
                  }`}
                >
                  {isCurrent ? "Current Plan" : checkoutBusy === p.name.toLowerCase() ? "Redirecting..." : "Upgrade"}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

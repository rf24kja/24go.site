"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { getSubscription, getUsage, createCheckout } from "@/lib/api";
import { useToast } from "@/components/Toast";
import { Skeleton } from "@/components/Skeleton";
import { useI18n } from "@/lib/i18n";
import { FieldHint } from "@/components/FieldHint";

const getPlans = (t: (k: string) => string) => [
  {
    name: t("plans.starter"),
    price: t("plans.starterPrice"),
    period: t("plans.perMonth"),
    desc: t("plans.starterDesc"),
    features: [
      t("plans.f1"),
      t("plans.f2"),
      t("plans.f3"),
      t("plans.f4"),
      t("plans.f5"),
    ],
  },
  {
    name: t("plans.pro"),
    price: t("plans.proPrice"),
    period: t("plans.perMonth"),
    desc: t("plans.proDesc"),
    features: [
      t("plans.f6"),
      t("plans.f7"),
      t("plans.f8"),
      t("plans.f9"),
    ],
  },
  {
    name: t("plans.enterprise"),
    price: t("plans.enterprisePrice"),
    period: t("plans.perMonth"),
    desc: t("plans.enterpriseDesc"),
    features: [
      t("plans.f10"),
      t("plans.f11"),
      t("plans.f12"),
    ],
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
  const { t } = useI18n();
  const [subscription, setSubscription] = useState<any>(null);
  const [usage, setUsage] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [checkoutBusy, setCheckoutBusy] = useState<string | null>(null);

  const plans = getPlans(t);

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
      if (res.checkout_url) window.location.href = res.checkout_url;
    } catch {
      toast(t("billing.checkoutFailed"), "error");
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
          <div className="flex flex-wrap gap-4 sm:gap-8">
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
    <div className="p-6 space-y-8 animate-fade-slide-in">
      <h1 className="text-2xl font-semibold text-zinc-100">{t("billing.title")}</h1>

      {/* Current Subscription */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 space-y-4">
        <h2 className="text-sm font-medium text-zinc-400">{t("billing.currentSubscription")}</h2>
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
                return daysLeft > 0
                  ? t("billing.trialEnds").replace("{daysLeft}", String(daysLeft))
                  : t("billing.trialExpired");
              })()
            ) : (
              <>{t("billing.renews").replace("{date}", sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : "—")}</>
            )}
          </div>
        </div>

        {/* Usage bars */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1">
              <span>{t("billing.postsThisMonth")}</span>
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
              <span>{t("billing.tokenCredits")}</span>
              <span>{t("billing.remaining").replace("{balance}", tokenBalance.toLocaleString())}</span>
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
          <h2 className="text-sm font-medium text-zinc-400 mb-4">{t("billing.usageSummary")}</h2>
          <div className="flex flex-wrap gap-4 sm:gap-8">
            <div>
              <p className="text-2xl font-semibold text-zinc-100">{(usage.total_tokens_used ?? 0).toLocaleString()}</p>
              <p className="text-zinc-400 text-xs">{t("billing.totalTokensUsed")}</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-zinc-100">${(usage.total_cost_usd ?? 0).toFixed(2)}</p>
              <p className="text-zinc-400 text-xs">{t("billing.totalCost")}</p>
            </div>
          </div>
        </div>
      )}

      {/* Plan cards */}
      <div>
        <h2 className="text-sm font-medium text-zinc-400 mb-4">{t("billing.availablePlans")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map((p) => {
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
                  {isCurrent && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">{t("billing.current")}</span>}
                </div>
                <p className="text-xs text-zinc-500 mt-1">{p.desc}</p>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold text-zinc-100">{p.price}</span>
                  <span className="text-zinc-400 text-sm">{p.period}</span>
                </div>
                <ul className="space-y-2 flex-1">
                  {p.features.map((f, i) => (
                    <li key={f} className="text-zinc-400 text-sm flex items-center gap-2">
                      <span className={isCurrent ? "text-emerald-400" : "text-zinc-600"}>✓</span>
                      {f} <FieldHint hint={t(`hints.billing.${p.name.toLowerCase()}Feature${i}`)} />
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
                        : "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 btn-press"
                  }`}
                >
                  {isCurrent ? t("billing.currentPlan") : checkoutBusy === p.name.toLowerCase() ? t("billing.redirecting") : t("billing.upgrade")}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Service pricing */}
      <div className="mt-8">
        <h2 className="text-sm font-medium text-zinc-400 mb-4">{t("billing.serviceTitle")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-zinc-100 font-medium text-lg">{t("billing.serviceStandard")}</h3>
            <p className="text-xs text-zinc-500 mt-1">{t("billing.serviceStandardDesc")}</p>
            <div className="mt-2 mb-4">
              <span className="text-3xl font-bold text-zinc-100">$150</span>
              <span className="text-zinc-400 text-sm">{t("plans.perMonth")}</span>
            </div>
            <ul className="space-y-2 text-zinc-400 text-sm">
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span>{t("billing.serviceS1")}</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span>{t("billing.serviceS2")}</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span>{t("billing.serviceS3")}</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span>{t("billing.serviceS4")}</li>
            </ul>
            <p className="text-xs text-zinc-600 mt-4">{t("billing.serviceNote")}</p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6">
            <h3 className="text-zinc-100 font-medium text-lg">{t("billing.serviceEnterprise")}</h3>
            <p className="text-xs text-zinc-500 mt-1">{t("billing.serviceEnterpriseDesc")}</p>
            <div className="mt-2 mb-4">
              <span className="text-3xl font-bold text-zinc-100">$1,000</span>
              <span className="text-zinc-400 text-sm">{t("billing.oneTime")}</span>
            </div>
            <ul className="space-y-2 text-zinc-400 text-sm">
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span>{t("billing.serviceE1")}</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span>{t("billing.serviceE2")}</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span>{t("billing.serviceE3")}</li>
              <li className="flex items-center gap-2"><span className="text-emerald-400">✓</span>{t("billing.serviceE4")}</li>
            </ul>
            <p className="text-xs text-zinc-600 mt-4">{t("billing.serviceNote")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

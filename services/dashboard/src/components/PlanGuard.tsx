"use client";

import { usePlanAccess } from "@/hooks/usePlanAccess";
import { Lock } from "lucide-react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export function PlanGuard({ feature, children }: { feature: string; children: React.ReactNode }) {
  const { hasAccess, requiredPlan } = usePlanAccess();
  const { t } = useI18n();

  if (hasAccess(feature)) return <>{children}</>;

  return (
    <div className="flex flex-col items-center justify-center h-96 text-zinc-400">
      <Lock className="w-12 h-12 mb-4" />
      <h2 className="text-xl font-semibold mb-2 text-zinc-200">{t("planGuard.title")}</h2>
      <p className="text-sm mb-4">{t("planGuard.required", { plan: requiredPlan(feature) })}</p>
      <Link href="/billing" className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-sm font-medium hover:bg-emerald-600 transition">
        {t("billing.upgrade")}
      </Link>
    </div>
  );
}

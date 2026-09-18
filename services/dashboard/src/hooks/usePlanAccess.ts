"use client";

import { useAuth } from "@/lib/auth";
import { getSubscription } from "@/lib/api";
import { useEffect, useState } from "react";

const PLAN_FEATURES: Record<string, string[]> = {
  trial: ["analytics", "leads", "lead-rules", "groups", "accounts", "campaigns", "auto-replies", "targets", "mailings", "users"],
  starter: ["analytics", "leads", "lead-rules", "groups", "accounts", "campaigns", "auto-replies", "targets"],
  pro: ["analytics", "leads", "lead-rules", "groups", "accounts", "campaigns", "auto-replies", "targets", "mailings"],
  enterprise: ["analytics", "leads", "lead-rules", "groups", "accounts", "campaigns", "auto-replies", "targets", "mailings", "users", "api"],
};

const OWNER_ONLY = ["blog-admin", "audit", "health"];

const PLAN_NAMES: Record<string, string> = {
  starter: "Starter ($25)",
  pro: "Pro ($75)",
  enterprise: "Enterprise ($300)",
};

export function usePlanAccess() {
  const { auth } = useAuth();
  const [plan, setPlan] = useState<string>("trial");

  useEffect(() => {
    if (!auth?.token) return;
    getSubscription(auth.token)
      .then((sub) => setPlan(sub?.plan || "trial"))
      .catch(() => {});
  }, [auth?.token]);

  const isOwner = auth?.user?.email === "rf24krsk@gmail.com";

  const hasAccess = (feature: string): boolean => {
    if (OWNER_ONLY.includes(feature)) return isOwner;
    return PLAN_FEATURES[plan]?.includes(feature) ?? false;
  };

  const requiredPlan = (feature: string): string => {
    if (OWNER_ONLY.includes(feature)) return "Owner";
    const tierOrder = ["trial", "starter", "pro", "enterprise"];
    for (const tier of tierOrder) {
      if (PLAN_FEATURES[tier]?.includes(feature)) return PLAN_NAMES[tier] || tier;
    }
    return "Enterprise";
  };

  return { plan, hasAccess, requiredPlan, isOwner };
}

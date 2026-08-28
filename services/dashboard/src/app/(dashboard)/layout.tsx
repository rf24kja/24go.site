"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { OnboardingChecklist } from "@/components/OnboardingChecklist";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.token) {
      router.replace("/login");
    }
  }, [auth.loading, auth.token, router]);

  if (auth.loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-zinc-500 text-sm">Loading...</p></div>;
  if (!auth.token) return null;

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 md:ml-60 p-4 md:p-8">
        <OnboardingChecklist />
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}

"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Spinner } from "@/components/Spinner";
import { PlatformProvider } from "@/lib/platform";
import { DashboardMessages } from "@/lib/dashboard-messages";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.loading && !auth.token) {
      router.replace("/login");
    }
  }, [auth.loading, auth.token, router]);

  if (auth.loading) return <div className="min-h-screen flex items-center justify-center"><Spinner size={24} className="text-zinc-500" /></div>;
  if (!auth.token) return null;

  return (
    <DashboardMessages><PlatformProvider>
      <div className="flex min-h-screen">
        <Sidebar />
        <main className="min-w-0 flex-1 md:ml-60 p-4 pt-14 md:pt-8 md:p-8">
          <ErrorBoundary>{children}</ErrorBoundary>
        </main>
      </div>
    </PlatformProvider></DashboardMessages>
  );
}

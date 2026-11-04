"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { Sidebar } from "@/components/Sidebar";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Spinner } from "@/components/Spinner";
import { PlatformProvider } from "@/lib/platform";
import { WorkspaceTabs } from "@/components/WorkspaceTabs";
import { DashboardMessages } from "@/lib/dashboard-messages";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { auth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const protectedPage = /^\/(?:(?:TG|VK|WA|FB|MAX|YT)\/)?(?:admin|audit|users|blog-admin)(?:\/|$)/.test(pathname);

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
          <ErrorBoundary>{protectedPage && auth.user?.email !== "rf24krsk@gmail.com" ? <p role="alert">Доступ запрещён / Access denied</p> : <><WorkspaceTabs />{children}</>}</ErrorBoundary>
        </main>
      </div>
    </PlatformProvider></DashboardMessages>
  );
}

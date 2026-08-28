import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ToastProvider } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: "24GO — Lead Generation Platform",
  description: "B2B Social Lead Generation Platform",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-zinc-950 text-zinc-100 min-h-screen">
        <ErrorBoundary>
          <ToastProvider>
            <Providers>{children}</Providers>
          </ToastProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { ToastProvider } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";

export const metadata: Metadata = {
  title: {
    default: "24GO — AI-Powered Lead Generation from Telegram & VK | SEO, Лиды, Клиенты",
    template: "%s | 24GO",
  },
  description: "Автоматическая лидогенерация в Telegram и ВКонтакте. AI-классификация лидов, парсинг групп, умные кампании. 24GO — платформа для увеличения продаж и поиска клиентов.",
  keywords: "лидогенерация, лиды, lead generation, Telegram, VK, ВКонтакте, парсинг, SEO, клиенты, увеличить продажи, трафик, AI, автоматизация продаж",
  openGraph: {
    title: "24GO — AI-Powered Lead Generation from Telegram & VK",
    description: "Автоматическая лидогенерация в Telegram и ВКонтакте. AI-классификация лидов, парсинг групп, умные кампании.",
    url: "https://www.24go.site",
    siteName: "24GO",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "24GO — AI-Powered Lead Generation from Telegram & VK",
    description: "Автоматическая лидогенерация в Telegram и ВКонтакте.",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: "https://www.24go.site",
  },
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

import type { Metadata } from "next";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import { ToastProvider } from "@/components/Toast";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import CookieConsent from "@/components/CookieConsent";

export const metadata: Metadata = {
  title: {
    default: "24GO.SITE — AI-Powered Lead Generation from Telegram & VK | SEO, Лиды, Клиенты",
    template: "%s | 24GO.SITE",
  },
  description: "Автоматическая лидогенерация в Telegram и ВКонтакте. AI-классификация лидов, парсинг групп, умные кампании. 24GO.SITE — платформа для увеличения продаж и поиска клиентов.",
  keywords: "лидогенерация, лиды, lead generation, Telegram, VK, ВКонтакте, парсинг, SEO, клиенты, увеличить продажи, трафик, AI, автоматизация продаж",
  openGraph: {
    title: "24GO.SITE — AI-Powered Lead Generation from Telegram & VK",
    description: "Автоматическая лидогенерация в Telegram и ВКонтакте. AI-классификация лидов, парсинг групп, умные кампании.",
    url: "https://www.24go.site",
    siteName: "24GO.SITE",
    type: "website",
    images: [
      {
        url: "https://www.24go.site/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "24GO.SITE — AI Lead Generation",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "24GO.SITE — AI-Powered Lead Generation from Telegram & VK",
    description: "Автоматическая лидогенерация в Telegram и ВКонтакте.",
    images: ["https://www.24go.site/opengraph-image.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
  alternates: {
    canonical: "https://www.24go.site",
    languages: {
      en: "https://www.24go.site?locale=en",
      ru: "https://www.24go.site?locale=ru",
      "x-default": "https://www.24go.site",
    },
  },
};

function getLocale(): string {
  try {
    return headers().get("x-locale") || "en";
  } catch {
    return "en";
  }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = getLocale();
  return (
    <html lang={locale} className="dark" suppressHydrationWarning>
      <head>
        <link rel="alternate" type="application/rss+xml" title="24GO Blog RSS" href="https://www.24go.site/feed.xml" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#10b981" />
        <meta property="og:locale" content={locale === "ru" ? "ru_RU" : "en_US"} />
        <meta property="og:locale:alternate" content={locale === "ru" ? "en_US" : "ru_RU"} />
      </head>
      <body className="bg-zinc-950 text-zinc-100 min-h-screen">
        <ErrorBoundary>
          <ToastProvider>
            <Providers>{children}</Providers>
          </ToastProvider>
          <CookieConsent />
        </ErrorBoundary>
      </body>
    </html>
  );
}

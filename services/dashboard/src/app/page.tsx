import type { Metadata } from "next";
import { headers } from "next/headers";
import LandingPage from "@/components/LandingPage";
import { SmoothScrollProvider } from "@/components/motion/SmoothScrollProvider";

export async function generateMetadata({ searchParams }: { searchParams: { locale?: string } }): Promise<Metadata> {
  const locale = searchParams?.locale === "ru" || searchParams?.locale === "en"
    ? searchParams.locale
    : headers().get("x-locale") === "ru" ? "ru" : "en";
  const title = locale === "ru"
    ? "24GO.SITE — Лидогенерация в Telegram и ВКонтакте с ИИ"
    : "24GO.SITE — AI-Powered Lead Generation from Telegram & VK";
  const description = locale === "ru"
    ? "Инструменты лидогенерации в Telegram и ВКонтакте: поиск групп, квалификация лидов с помощью ИИ и управление кампаниями в 24GO.SITE."
    : "Lead generation tools for Telegram and VK: group discovery, AI-assisted lead qualification, and campaign management with 24GO.SITE.";
  const canonical = `https://www.24go.site?locale=${locale}`;
  return {
    title: { absolute: title },
    description,
    openGraph: {
      title, description, url: canonical, siteName: "24GO.SITE",
      locale: locale === "ru" ? "ru_RU" : "en_US", type: "website",
      images: [{ url: "https://www.24go.site/opengraph-image.png", width: 1200, height: 630, alt: "24GO.SITE — AI Lead Generation" }],
    },
    twitter: {
      card: "summary_large_image", title, description,
      images: ["https://www.24go.site/opengraph-image.png"],
    },
    alternates: {
      canonical,
      languages: {
        en: "https://www.24go.site?locale=en",
        ru: "https://www.24go.site?locale=ru",
        "x-default": "https://www.24go.site?locale=en",
      },
    },
  };
}

export default function HomePage() {
  return <SmoothScrollProvider><LandingPage /></SmoothScrollProvider>;
}

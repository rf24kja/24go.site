import type { Metadata } from "next";
import IntegrationTemplate from "../IntegrationTemplate";

import { localizedPageMetadata } from "@/lib/public-metadata";

const pageMetadata: Metadata = {
  title: "Telegram Webhook Integration — Send Leads to Any System | 24GO",
  description: "Connect Telegram leads to any system via webhooks. Send data to Zapier, Make, n8n, or your custom API.",
  robots: "index, follow",
};

export function generateMetadata({ searchParams }: { searchParams?: { locale?: string } }): Metadata {
  return localizedPageMetadata("/integrations/webhook", searchParams?.locale, pageMetadata);
}

const content = {
  en: {
    description: "Send Telegram lead data to any system via webhooks. Works with Zapier, Make (Integromat), n8n, custom APIs, and more.",
    features: ["JSON webhook delivery on lead events", "Custom headers and authentication", "Retry logic with exponential backoff", "Event filtering (by intent, status, group)", "Template payloads for Zapier/Make/n8n", "Full payload documentation"],
    steps: [
      { title: "Configure webhook URL", desc: "Enter your endpoint URL. 24GO sends a test payload to verify connectivity." },
      { title: "Choose events and filters", desc: "Select which events trigger webhooks: new lead, intent change, status update." },
      { title: "Receive data in real-time", desc: "Your endpoint receives JSON payloads with full lead data on every event." },
    ],
    faq: [
      { q: "What's in the webhook payload?", a: "Each webhook includes: lead ID, username, message, intent score, group source, timestamp, and custom fields." },
      { q: "Can I use this with Zapier?", a: "Yes. Use Zapier's Webhooks by Zapier module as the trigger. We provide a pre-built template." },
      { q: "What happens if my endpoint is down?", a: "24GO retries with exponential backoff (up to 5 attempts over 1 hour). Failed webhooks are logged." },
    ],
  },
  ru: {
    description: "Отправка данных лидов из Telegram в любую систему через вебхуки. Работает с Zapier, Make, n8n, кастомными API и другими.",
    features: ["JSON-вебхуки при событиях лидов", "Кастомные заголовки и аутентификация", "Повторные попытки с экспоненциальной задержкой", "Фильтрация событий (по намерению, статусу, группе)", "Шаблоны для Zapier/Make/n8n", "Полная документация"],
    steps: [
      { title: "Настройте URL вебхука", desc: "Введите URL эндпоинта. 24GO отправит тестовый запрос для проверки связи." },
      { title: "Выберите события и фильтры", desc: "Выберите какие события запускают вебхуки: новый лид, изменение намерения, обновление статуса." },
      { title: "Получайте данные в реальном времени", desc: "Ваш эндпоинт получает JSON-данные с полной информацией о лиде при каждом событии." },
    ],
    faq: [
      { q: "Что содержит вебхук?", a: "Каждый вебхук включает: ID лида, username, сообщение, оценку намерения, группу-источник, время и кастомные поля." },
      { q: "Можно ли использовать с Zapier?", a: "Да. Используйте модуль Webhooks by Zapier как триггер. Мы предоставляем готовый шаблон." },
      { q: "Что будет, если эндпоинт недоступен?", a: "24GO повторяет попытки с экспоненциальной задержкой (до 5 попыток за час). Неудачные вебхуки логируются." },
    ],
  },
};

export default async function WebhookPage({ searchParams }: { searchParams: { locale?: string } }) {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  const c = content[locale];

  return (
    <IntegrationTemplate
      name="Any System (Webhooks)"
      description={c.description}
      canonical="https://www.24go.site/integrations/webhook"
      features={c.features}
      steps={c.steps}
      faq={c.faq}
      locale={locale}
    />
  );
}

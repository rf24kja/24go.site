import type { Metadata } from "next";
import IntegrationTemplate from "../IntegrationTemplate";

export const metadata: Metadata = {
  title: "Telegram → AmoCRM Integration — Auto-Import Leads | 24GO",
  description: "Automatically import Telegram leads into AmoCRM. Sync contacts, deals, and conversation history with 24GO.",
  robots: "index, follow",
  alternates: {
    canonical: "https://www.24go.site/integrations/amo-crm",
    languages: {
      en: "https://www.24go.site/integrations/amo-crm?locale=en",
      ru: "https://www.24go.site/integrations/amo-crm?locale=ru",
      "x-default": "https://www.24go.site/integrations/amo-crm",
    },
  },
};

const content = {
  en: {
    description: "Automatically sync Telegram leads, conversations, and deals into AmoCRM. No manual data entry — leads appear in your CRM the moment they respond.",
    features: ["Auto-create contacts from Telegram messages", "Sync lead status and intent score", "Two-way conversation sync", "Custom field mapping", "Real-time webhook delivery", "Bulk import historical leads"],
    steps: [
      { title: "Connect your AmoCRM account", desc: "Enter your AmoCRM subdomain and API key. One-click OAuth available." },
      { title: "Configure field mapping", desc: "Map Telegram data to AmoCRM fields: name, phone, email, custom fields." },
      { title: "Leads flow automatically", desc: "24GO detects interested leads and creates deals in AmoCRM with full conversation history." },
    ],
    faq: [
      { q: "Does this work with AmoCRM Free?", a: "Yes, but webhook delivery requires AmoCRM paid plan. Contact sync works on all plans." },
      { q: "Can I map custom fields?", a: "Yes. Map any AmoCRM custom field to Telegram data: username, bio, group, intent score, and more." },
      { q: "Is the sync real-time?", a: "Yes. Leads appear in AmoCRM within seconds of responding on Telegram." },
    ],
  },
  ru: {
    description: "Автоматическая синхронизация лидов из Telegram, бесед и сделок в AmoCRM. Без ручного ввода — лиды появляются в CRM сразу после ответа.",
    features: ["Автосоздание контактов из сообщений Telegram", "Синхронизация статуса и оценки лида", "Двусторонняя синхронизация бесед", "Маппинг кастомных полей", "Доставка через вебхуки в реальном времени", "Массовый импорт历史数据"],
    steps: [
      { title: "Подключите AmoCRM", desc: "Введите поддомен и API-ключ AmoCRM. Доступна OAuth-авторизация." },
      { title: "Настройте маппинг полей", desc: "Сопоставьте данные Telegram с полями AmoCRM: имя, телефон, email, кастомные поля." },
      { title: "Лиды поступают автоматически", desc: "24GO определяет заинтересованных лидов и создаёт сделки в AmoCRM с полной историей бесед." },
    ],
    faq: [
      { q: "Работает ли с AmoCRM Free?", a: "Да, но доставка вебхуков требует платный тариф. Синхронизация контактов работает на всех тарифах." },
      { q: "Можно ли настроить кастомные поля?", a: "Да. Сопоставьте любое кастомное поле AmoCRM с данными Telegram: username, био, группа, оценка и другое." },
      { q: "Синхронизация в реальном времени?", a: "Да. Лиды появляются в AmoCRM через несколько секунд после ответа в Telegram." },
    ],
  },
};

export default async function AmoCrmPage({ searchParams }: { searchParams: { locale?: string } }) {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  const c = content[locale];

  return (
    <IntegrationTemplate
      name="AmoCRM"
      description={c.description}
      canonical="https://www.24go.site/integrations/amo-crm"
      features={c.features}
      steps={c.steps}
      faq={c.faq}
      locale={locale}
    />
  );
}

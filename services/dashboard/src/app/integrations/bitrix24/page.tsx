import type { Metadata } from "next";
import IntegrationTemplate from "../IntegrationTemplate";

export const metadata: Metadata = {
  title: "Telegram → Bitrix24 Integration — Auto-Import Leads | 24GO",
  description: "Automatically import Telegram leads into Bitrix24 CRM. Sync contacts, deals, and tasks with 24GO.",
  robots: "index, follow",
  alternates: {
    canonical: "https://www.24go.site/integrations/bitrix24",
    languages: {
      en: "https://www.24go.site/integrations/bitrix24?locale=en",
      ru: "https://www.24go.site/integrations/bitrix24?locale=ru",
      "x-default": "https://www.24go.site/integrations/bitrix24",
    },
  },
};

const content = {
  en: {
    description: "Automatically sync Telegram leads into Bitrix24 CRM. Create contacts, deals, and tasks without manual data entry.",
    features: ["Auto-create Bitrix24 contacts from Telegram", "Create deals with responsible person assignment", "Auto-create tasks for follow-up", "Custom field mapping", "Two-way status sync", "Bulk import historical leads"],
    steps: [
      { title: "Connect Bitrix24", desc: "Enter your Bitrix24 webhook URL or use OAuth authorization." },
      { title: "Map fields and pipelines", desc: "Configure which Telegram data maps to Bitrix24 contact and deal fields." },
      { title: "Leads sync automatically", desc: "New leads appear as contacts with deals and follow-up tasks in Bitrix24." },
    ],
    faq: [
      { q: "Does this work with Bitrix24 On-Premise?", a: "Yes. Both Cloud and On-Premise versions are supported via webhook or OAuth." },
      { q: "Can I create tasks automatically?", a: "Yes. 24GO can create follow-up tasks when leads respond with high intent." },
      { q: "Is the sync real-time?", a: "Yes. Leads appear in Bitrix24 within seconds of responding on Telegram." },
    ],
  },
  ru: {
    description: "Автоматическая синхронизация лидов из Telegram в Bitrix24 CRM. Создание контактов, сделок и задач без ручного ввода.",
    features: ["Автосоздание контактов Bitrix24 из Telegram", "Создание сделок с назначением ответственного", "Автосоздание задач для follow-up", "Маппинг кастомных полей", "Двусторонняя синхронизация статусов", "Массовый импорт历史数据"],
    steps: [
      { title: "Подключите Bitrix24", desc: "Введите URL вебхука Bitrix24 или используйте OAuth-авторизацию." },
      { title: "Настройте маппинг полей", desc: "Настройте соответствие данных Telegram полям контактов и сделок Bitrix24." },
      { title: "Лиды синхронизируются автоматически", desc: "Новые лиды появляются как контакты с сделками и задачами в Bitrix24." },
    ],
    faq: [
      { q: "Работает ли с Bitrix24 On-Premise?", a: "Да. Поддерживаются версии Cloud и On-Premise через вебхук или OAuth." },
      { q: "Можно ли создавать задачи автоматически?", a: "Да. 24GO может создавать задачи при ответе лидов с высоким намерением." },
      { q: "Синхронизация в реальном времени?", a: "Да. Лиды появляются в Bitrix24 через несколько секунд после ответа в Telegram." },
    ],
  },
};

export default async function Bitrix24Page({ searchParams }: { searchParams: { locale?: string } }) {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  const c = content[locale];

  return (
    <IntegrationTemplate
      name="Bitrix24"
      description={c.description}
      canonical="https://www.24go.site/integrations/bitrix24"
      features={c.features}
      steps={c.steps}
      faq={c.faq}
      locale={locale}
    />
  );
}

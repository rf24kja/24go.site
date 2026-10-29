import type { Metadata } from "next";
import IntegrationTemplate from "../IntegrationTemplate";

import { localizedPageMetadata } from "@/lib/public-metadata";

const pageMetadata: Metadata = {
  title: "Telegram → HubSpot Integration — Auto-Import Leads | 24GO",
  description: "Automatically import Telegram leads into HubSpot CRM. Sync contacts, deals, and activity with 24GO.",
  robots: "index, follow",
};

export function generateMetadata({ searchParams }: { searchParams?: { locale?: string } }): Metadata {
  return localizedPageMetadata("/integrations/hubspot", searchParams?.locale, pageMetadata);
}

const content = {
  en: {
    description: "Automatically sync Telegram leads into HubSpot CRM. Create contacts, deals, and log activities without manual entry.",
    features: ["Auto-create HubSpot contacts from Telegram", "Create deals with custom pipeline stages", "Log activities and conversation history", "Map custom properties", "Trigger HubSpot workflows from Telegram events", "Sync lead score and intent data"],
    steps: [
      { title: "Connect HubSpot", desc: "One-click OAuth authorization. Select the HubSpot account and pipeline." },
      { title: "Configure sync rules", desc: "Choose which leads sync (by intent, status, or group) and map properties." },
      { title: "Leads flow into HubSpot", desc: "Qualified leads appear as contacts with deals, activities, and full conversation context." },
    ],
    faq: [
      { q: "Does this work with HubSpot Free CRM?", a: "Yes. Contact creation and deal tracking work on all HubSpot plans." },
      { q: "Can I trigger HubSpot workflows?", a: "Yes. 24GO can trigger workflows when leads reach specific intent levels (HOT, WARM)." },
      { q: "How fast is the sync?", a: "Real-time. Leads appear in HubSpot within seconds of responding on Telegram." },
    ],
  },
  ru: {
    description: "Автоматическая синхронизация лидов из Telegram в HubSpot CRM. Создание контактов, сделок и активностей без ручного ввода.",
    features: ["Автосоздание контактов HubSpot из Telegram", "Создание сделок с кастомными этапами", "Логирование активностей и истории бесед", "Маппинг кастомных свойств", "Запуск workflow HubSpot из Telegram", "Синхронизация оценки и намерения лида"],
    steps: [
      { title: "Подключите HubSpot", desc: "OAuth-авторизация в один клик. Выберите аккаунт HubSpot и воронку." },
      { title: "Настройте правила синхронизации", desc: "Выберите какие лиды синхронизировать (по намерению, статусу или группе) и настройте маппинг." },
      { title: "Лиды поступают в HubSpot", desc: "Квалифицированные лиды появляются как контакты с сделками, активностями и контекстом бесед." },
    ],
    faq: [
      { q: "Работает ли с HubSpot Free CRM?", a: "Да. Создание контактов и отслеживание сделок работают на всех тарифах HubSpot." },
      { q: "Можно ли запускать workflow HubSpot?", a: "Да. 24GO может запускать workflow при достижении определённых уровней намерения (HOT, WARM)." },
      { q: "Как быстрая синхронизация?", a: "В реальном времени. Лиды появляются в HubSpot через несколько секунд после ответа в Telegram." },
    ],
  },
};

export default async function HubSpotPage({ searchParams }: { searchParams: { locale?: string } }) {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  const c = content[locale];

  return (
    <IntegrationTemplate
      name="HubSpot"
      description={c.description}
      canonical="https://www.24go.site/integrations/hubspot"
      features={c.features}
      steps={c.steps}
      faq={c.faq}
      locale={locale}
    />
  );
}

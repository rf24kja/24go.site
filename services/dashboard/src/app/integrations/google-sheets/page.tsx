import type { Metadata } from "next";
import IntegrationTemplate from "../IntegrationTemplate";

export const metadata: Metadata = {
  title: "Telegram → Google Sheets Integration — Auto-Export Leads | 24GO",
  description: "Export Telegram leads to Google Sheets automatically. Real-time sync, custom columns, and formula-ready data.",
  robots: "index, follow",
  alternates: {
    canonical: "https://www.24go.site/integrations/google-sheets",
    languages: {
      en: "https://www.24go.site/integrations/google-sheets?locale=en",
      ru: "https://www.24go.site/integrations/google-sheets?locale=ru",
      "x-default": "https://www.24go.site/integrations/google-sheets",
    },
  },
};

const content = {
  en: {
    description: "Export Telegram leads to Google Sheets in real-time. Perfect for teams that need spreadsheet-based workflows, custom formulas, and shared access.",
    features: ["Real-time lead export to any Google Sheet", "Custom column mapping", "Automatic timestamp and source tracking", "Formula-ready data format", "Share with unlimited team members", "Filter by intent, status, or date"],
    steps: [
      { title: "Connect Google account", desc: "Authorize 24GO to access your Google Sheets. Read-only access to existing sheets." },
      { title: "Select or create a sheet", desc: "Choose an existing sheet or let 24GO create one with pre-configured columns." },
      { title: "Leads appear automatically", desc: "Every new lead is appended as a row with timestamp, source, intent score, and message." },
    ],
    faq: [
      { q: "Can I export to multiple sheets?", a: "Yes. Create different export rules for different groups, campaigns, or intent levels." },
      { q: "Does it update existing rows?", a: "By default, new rows are appended. Enable 'update mode' to modify existing rows based on username." },
      { q: "Is my data secure?", a: "24GO only writes to sheets you explicitly authorize. We never read your other Google data." },
    ],
  },
  ru: {
    description: "Экспорт лидов из Telegram в Google Sheets в реальном времени. Идеально для команд, работающих с таблицами и формулами.",
    features: ["Экспорт лидов в реальном времени в любой Google Sheet", "Маппинг колонок", "Автоматическое время и источник", "Формат данных для формул", "Общий доступ для команды", "Фильтрация по намерению, статусу или дате"],
    steps: [
      { title: "Подключите Google аккаунт", desc: "Авторизуйте 24GO для доступа к Google Sheets. Чтение существующих таблиц." },
      { title: "Выберите или создайте таблицу", desc: "Выберите существующую таблицу или позвольте 24GO создать новую с настроенными колонками." },
      { title: "Лиды появляются автоматически", desc: "Каждый новый лид добавляется как строка со временем, источником, оценкой и сообщением." },
    ],
    faq: [
      { q: "Можно ли экспортировать в несколько таблиц?", a: "Да. Создайте разные правила экспорта для разных групп, кампаний или уровней намерения." },
      { q: "Обновляются ли существующие строки?", a: "По умолчанию добавляются новые строки. Включите режим обновления для изменения существующих по username." },
      { q: "Безопасны ли мои данные?", a: "24GO записывает только в таблицы, которые вы явно авторизовали. Мы не читаем другие ваши данные Google." },
    ],
  },
};

export default async function GoogleSheetsPage({ searchParams }: { searchParams: { locale?: string } }) {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  const c = content[locale];

  return (
    <IntegrationTemplate
      name="Google Sheets"
      description={c.description}
      canonical="https://www.24go.site/integrations/google-sheets"
      features={c.features}
      steps={c.steps}
      faq={c.faq}
      locale={locale}
    />
  );
}

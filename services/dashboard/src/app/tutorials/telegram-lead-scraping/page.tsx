import type { Metadata } from "next";
import TutorialTemplate from "../TutorialTemplate";

import { localizedPageMetadata } from "@/lib/public-metadata";

const pageMetadata: Metadata = {
  title: "How to Scrape Telegram Leads — Complete Guide (2026) | 24GO",
  description: "Step-by-step guide to collecting leads from Telegram groups. Extract usernames, messages, and intent data for B2B outreach.",
  robots: "index, follow",
};

export function generateMetadata({ searchParams }: { searchParams?: { locale?: string } }): Metadata {
  return localizedPageMetadata("/tutorials/telegram-lead-scraping", searchParams?.locale, pageMetadata);
}

const content = {
  en: {
    title: "How to Scrape Telegram Leads",
    description: "Extract qualified leads from any public Telegram group. This guide covers group discovery, member scraping, and intent scoring.",
    prerequisites: ["A Telegram account (6+ months old, in relevant groups)", "24GO account (free trial available)", "Knowledge of which groups your target audience uses"],
    steps: [
      { title: "Discover relevant groups", content: "Go to Groups → Discover. Enter your niche keywords (e.g., 'real estate Phuket', 'SaaS founders'). 24GO finds public Telegram groups matching your criteria with member counts and activity levels." },
      { title: "Add groups to monitoring", content: "Click 'Add' on the groups you want to scrape. 24GO automatically joins public groups and starts monitoring messages for buying signals." },
      { title: "Configure intent detection", content: "Go to Settings → Lead Rules. Set keywords that indicate buying intent: 'price', 'cost', 'how much', 'looking for', 'need help with'. 24GO's AI also detects intent from context." },
      { title: "Run initial scrape", content: "Go to Targets → Scrape Comments. Enter a post URL from the group. 24GO extracts all commenters with their profiles, messages, and intent scores." },
      { title: "Review and qualify leads", content: "Go to Leads → filter by intent (HOT, WARM, COLD). Review the AI classification. Adjust rules if needed. Export leads or start automated outreach." },
      { title: "Set up continuous monitoring", content: "Enable the Group Scanner for continuous monitoring. New messages are analyzed in real-time. Hot leads trigger instant auto-replies or CRM sync." },
    ],
    mistakes: ["Scraping private groups without permission — only scrape public groups you're a member of", "Ignoring group rules — some groups prohibit outreach. Respect the community.", "Scraping too aggressively — slow and steady wins. High volume triggers Telegram limits.", "Not personalizing messages — copy-paste templates get ignored and reported", "Skipping the warmup phase — new accounts need 1-2 weeks of normal activity first"],
    results: ["Qualified leads with contact info and intent scores", "Real-time monitoring — new leads captured within minutes", "Automated lead enrichment — profile data, activity history, group context", "Direct pipeline to CRM or automated outreach sequences"],
  },
  ru: {
    title: "Как собирать лиды из Telegram",
    description: "Извлекайте квалифицированных лидов из любой публичной Telegram-группы. Руководство по поиску групп, сбору участников и оценке намерения.",
    prerequisites: ["Аккаунт Telegram (6+ месяцев, в релевантных группах)", "Аккаунт 24GO (бесплатный триал)", "Знание, какие группы использует ваша целевая аудитория"],
    steps: [
      { title: "Найдите релевантные группы", content: "Перейдите в Группы → Поиск. Введите ключевые слова вашей нижи (например, 'недвижимость Пхукет', 'SaaS основатели'). 24GO найдёт публичные группы с подсчётом участников и активностью." },
      { title: "Добавьте группы для мониторинга", content: "Нажмите 'Добавить' на нужных группах. 24GO автоматически вступит в публичные группы и начнёт анализ сообщений на предмет покупательских сигналов." },
      { title: "Настройте определение намерения", content: "Перейдите в Настройки → Правила лидов. Задайте ключевые слова покупательского намерения: 'цена', 'сколько стоит', 'ищу', 'нужна помощь'. ИИ 24GO также определяет намерение из контекста." },
      { title: "Запустите сбор", content: "Перейдите в Цели → Собрать комментарии. Введите URL поста из группы. 24GO извлечёт всех комментаторов с профилями, сообщениями и оценками намерения." },
      { title: "Просмотрите и квалифицируйте лидов", content: "Перейдите в Лиды → фильтр по намерению (HOT, WARM, COLD). Проверьте классификацию ИИ. Откорректируйте правила при необходимости. Экспортируйте или запустите автоматический outreach." },
      { title: "Настройте непрерывный мониторинг", content: "Включите сканер групп для непрерывного мониторинга. Новые сообщения анализируются в реальном времени. HOT лиды запускают мгновенные автоответы или синхронизацию с CRM." },
    ],
    mistakes: ["Сбор из приватных групп без разрешения — только публичные группы, в которых вы состоите", "Игнорирование правил группы — некоторые группы запрещают outreach. Уважайте сообщество.", "Слишком агрессивный сбор — медленно и стабильно. Объём триггерит лимиты Telegram.", "Не персонализируйте сообщения — копипаст шаблоны игнорируются и репортятся", "Пропуск прогрева — новые аккаунты нуждаются в 1-2 неделях обычной активности"],
    results: ["Квалифицированные лиды с контактами и оценками намерения", "Мониторинг в реальном времени — новые лиды за минуты", "Обогащение данных — профиль, история активности, контекст группы", "Прямая воронка в CRM или автоматические outreach-последовательности"],
  },
};

export default async function LeadScrapingTutorial({ searchParams }: { searchParams: { locale?: string } }) {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  const c = content[locale];

  return (
    <TutorialTemplate
      title={c.title}
      description={c.description}
      canonical="https://www.24go.site/tutorials/telegram-lead-scraping"
      prerequisites={c.prerequisites}
      steps={c.steps}
      mistakes={c.mistakes}
      results={c.results}
      locale={locale}
    />
  );
}

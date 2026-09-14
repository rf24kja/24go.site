import type { Metadata } from "next";
import TutorialTemplate from "../TutorialTemplate";

export const metadata: Metadata = {
  title: "How to Warm Up Telegram Accounts — Complete Guide (2026) | 24GO",
  description: "Step-by-step guide to warming up Telegram accounts for mass outreach. Avoid bans and improve deliverability.",
  robots: "index, follow",
  alternates: {
    canonical: "https://www.24go.site/tutorials/telegram-warmup",
    languages: {
      en: "https://www.24go.site/tutorials/telegram-warmup?locale=en",
      ru: "https://www.24go.site/tutorials/telegram-warmup?locale=ru",
      "x-default": "https://www.24go.site/tutorials/telegram-warmup",
    },
  },
};

const content = {
  en: {
    title: "How to Warm Up Telegram Accounts",
    description: "Prepare your Telegram accounts for automated outreach. Proper warmup prevents bans and dramatically improves message delivery rates.",
    prerequisites: ["At least one Telegram account connected to 24GO", "24GO account (free trial available)", "Patience — warmup takes 7-14 days"],
    steps: [
      { title: "Connect your accounts", content: "Go to Accounts → Connect Account. Add all accounts you plan to use. Assign a dedicated proxy to each account (1 proxy = 1 account, permanently)." },
      { title: "Enable the warmup worker", content: "Go to Settings → Warmup. Enable warmup for your accounts. 24GO automatically sends messages, joins groups, and performs normal user actions." },
      { title: "Set warmup limits", content: "Start with Stage 1 limits (5 messages/day). The warmup automatically progresses through stages over 7-14 days: Stage 1 (5/day) → Stage 2 (15/day) → Stage 3 (30/day)." },
      { title: "Monitor warmup progress", content: "Go to Accounts → view warmup status for each account. Watch for restrictions or warnings. If an account gets flagged, pause warmup and extend the current stage." },
      { title: "Progress to outreach", content: "After Stage 3 completes (14+ days), accounts are ready for mass outreach. Increase limits gradually: start at 50% of max, increase by 20% per week." },
      { title: "Maintain account health", content: "Keep warmup running in background even during active outreach. Mix normal user actions (joining groups, reacting to posts) with automated messages." },
    ],
    mistakes: ["Skipping warmup — new accounts that jump straight to mass messaging get banned within days", "Using shared proxies — one proxy per account, permanently. Changing proxies triggers bans.", "Going too fast — increase limits by max 20% per week, not more", "Ignoring restrictions — if Telegram limits your account, stop all activity for 24-48 hours", "Not enabling 2FA — accounts without 2FA are flagged more easily by Telegram", "Using the same message template for all accounts — rotate content across accounts"],
    results: ["Accounts survive long-term without bans", "Higher message delivery rates (80%+ vs 20-30% for unwarmed accounts)", "Better response rates — warm accounts look legitimate to recipients", "Stable daily limits — warmed accounts maintain consistent throughput"],
  },
  ru: {
    title: "Как прогреть аккаунты Telegram",
    description: "Подготовьте аккаунты Telegram к автоматическому outreach. Правильный прогрев предотвращает баны и значительно повышает доставку сообщений.",
    prerequisites: ["Хотя бы один аккаунт Telegram, подключённый к 24GO", "Аккаунт 24GO (бесплатный триал)", "Терпение — прогрев занимает 7-14 дней"],
    steps: [
      { title: "Подключите аккаунты", content: "Перейдите в Аккаунты → Подключить. Добавьте все аккаунты. Назначьте выделенный прокси каждому (1 прокси = 1 аккаунт, навсегда)." },
      { title: "Включите воркер прогрева", content: "Перейдите в Настройки → Прогрев. Включите прогрев для аккаунтов. 24GO автоматически отправляет сообщения, вступает в группы и выполняет обычные действия." },
      { title: "Установите лимиты прогрева", content: "Начните с Stage 1 (5 сообщений/день). Прогрев проходит через этапы за 7-14 дней: Stage 1 (5/день) → Stage 2 (15/день) → Stage 3 (30/день)." },
      { title: "Отслеживайте прогресс", content: "Перейдите в Аккаунты → статус прогрева. Следите за ограничениями. Если аккаунт попал под флаг, приостановите прогрев и продлите текущий этап." },
      { title: "Переходите к outreach", content: "После завершения Stage 3 (14+ дней) аккаунты готовы. Увеличивайте лимиты постепенно: начните с 50% от максимума, +20% в неделю." },
      { title: "Поддерживайте здоровье аккаунтов", content: "Держите прогрев в фоне даже во время активного outreach. Чередуйте обычные действия (вступление в группы, реакции) с автоматическими сообщениями." },
    ],
    mistakes: ["Пропуск прогрева — новые аккаунты, перешедшие сразу к массовой рассылке, банятся за дни", "Использование общих прокси — 1 прокси на аккаунт, навсегда. Смена прокси вызывает бан.", "Слишком быстрое увеличение — максимум +20% в неделю", "Игнорирование ограничений — если Telegram ограничил аккаунт, остановите всё на 24-48 часов", "Отсутствие 2FA — аккаунты без 2FA проще всего флагит Telegram", "Один шаблон для всех аккаунтов — чередуйте контент между аккаунтами"],
    results: ["Аккаунты живут долго без банов", "Высокая доставка сообщений (80%+ против 20-30% без прогрева)", "Лучшие rates ответов — прогретые аккаунты выглядят легитимно", "Стабильные дневные лимиты — прогретые аккаунты поддерживают стабильную пропускную способность"],
  },
};

export default async function WarmupTutorial({ searchParams }: { searchParams: { locale?: string } }) {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  const c = content[locale];

  return (
    <TutorialTemplate
      title={c.title}
      description={c.description}
      canonical="https://www.24go.site/tutorials/telegram-warmup"
      prerequisites={c.prerequisites}
      steps={c.steps}
      mistakes={c.mistakes}
      results={c.results}
      locale={locale}
    />
  );
}

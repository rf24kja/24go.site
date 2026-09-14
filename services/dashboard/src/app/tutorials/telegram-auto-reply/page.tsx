import type { Metadata } from "next";
import TutorialTemplate from "../TutorialTemplate";

export const metadata: Metadata = {
  title: "How to Set Up Telegram Auto-Reply Bot — Complete Guide (2026) | 24GO",
  description: "Step-by-step guide to setting up automatic replies in Telegram. Respond to leads instantly with AI-powered or template replies.",
  robots: "index, follow",
  alternates: {
    canonical: "https://www.24go.site/tutorials/telegram-auto-reply",
    languages: {
      en: "https://www.24go.site/tutorials/telegram-auto-reply?locale=en",
      ru: "https://www.24go.site/tutorials/telegram-auto-reply?locale=ru",
      "x-default": "https://www.24go.site/tutorials/telegram-auto-reply",
    },
  },
};

const content = {
  en: {
    title: "How to Set Up Telegram Auto-Reply Bot",
    description: "Respond to every lead instantly — even while you sleep. This guide shows you how to set up AI-powered or template auto-replies for Telegram.",
    prerequisites: ["A Telegram account (6+ months old recommended)", "24GO account (free trial available)", "At least one Telegram group where your target audience hangs out"],
    steps: [
      { title: "Connect your Telegram account to 24GO", content: "Go to Accounts → Connect Account. Enter your phone number, verify with the code sent to Telegram. 24GO uses encrypted session storage — your credentials are never exposed." },
      { title: "Enable the DM Listener", content: "Go to Listeners → Start Listener. This monitors incoming messages to your connected account. When someone messages you, 24GO captures the message and lead data." },
      { title: "Configure auto-reply rules", content: "Go to Settings → AI Auto-Reply. Enable auto-replies and choose your mode: AI (generates unique responses using LLM) or Template (uses your pre-written replies)." },
      { title: "Set intent thresholds", content: "Configure which leads get auto-replies. AI replies work best for HOT leads (high purchase intent). Template replies handle WARM leads. COLD leads get no reply." },
      { title: "Configure work hours and rate limits", content: "Set your timezone and working hours (e.g., 9am-9pm Bangkok time). Set max replies per hour to avoid looking spammy. Start with 5-10 replies/hour." },
      { title: "Test with a real message", content: "Send a test message to your connected account from another phone. Verify the reply comes through, check timing, and adjust templates if needed." },
    ],
    mistakes: ["Starting with too many replies per hour — start low (5-10) and increase gradually", "Using the same template for all leads — personalize by intent level", "Ignoring work hours — auto-replying at 3am looks suspicious", "Not testing before going live — always test with a real message first", "Using a brand new account — wait at least 1-2 months before enabling auto-replies"],
    results: ["Instant response time (under 30 seconds)", "Higher lead conversion — leads responded to within 5 minutes convert 5x more", "24/7 coverage — never miss a lead, even while sleeping", "Consistent messaging — every lead gets the same quality response"],
  },
  ru: {
    title: "Как настроить бот автоответов в Telegram",
    description: "Отвечайте каждому лиду мгновенно — даже во сне. Это руководство покажет, как настроить автоответы на основе ИИ или шаблонов.",
    prerequisites: ["Аккаунт Telegram (рекомендуется 6+ месяцев)", "Аккаунт 24GO (есть бесплатный триал)", "Хотя бы одна Telegram-группа, где собирается ваша целевая аудитория"],
    steps: [
      { title: "Подключите Telegram к 24GO", content: "Перейдите в Аккаунты → Подключить аккаунт. Введите номер телефона, подтвердите кодом из Telegram. 24GO использует шифрованное хранение сессий — ваши данные nunca не раскрываются." },
      { title: "Включите листенер ЛС", content: "Перейдите в Листенеры → Запустить. Листенер отслеживает входящие сообщения. Когда кто-то пишет вам, 24GO сохраняет сообщение и данные лида." },
      { title: "Настройте правила автоответов", content: "Перейдите в Настройки → AI автоответы. Включите автоответы и выберите режим: AI (уникальные ответы через LLM) или Шаблон (ваши готовые ответы)." },
      { title: "Установите пороги намерения", content: "Настройте, какие лиды получают автоответы. AI лучше работает для HOT лидов (высокое намерение покупки). Шаблоны — для WARM. COLD лиды не получают ответ." },
      { title: "Настройте рабочие часы и лимиты", content: "Установите часовой пояс и рабочие часы (например, 9:00-21:00 МСК). Установите максимум ответов в час. Начните с 5-10 ответов/час." },
      { title: "Протестируйте реальным сообщением", content: "Отправьте тестовое сообщение с другого телефона. Проверьте ответ, тайминг и откорректируйте шаблоны при необходимости." },
    ],
    mistakes: ["Начинайте с малого — 5-10 ответов в час, увеличивайте постепенно", "Не используйте один шаблон для всех — персонализируйте по уровню намерения", "Не игнорируйте рабочие часы — автоответ в 3 часа ночи выглядит подозрительно", "Тестируйте перед запуском — всегда проверяйте реальным сообщением", "Не используйте новый аккаунт — подождите 1-2 месяца перед включением автоответов"],
    results: ["Мгновенное время ответа (менее 30 секунд)", "Более высокая конверсия — лиды, которым отвечают за 5 минут, конвертируются в 5 раз чаще", "Покрытие 24/7 — не пропустите ни одного лида, даже во сне", "Единый стиль общения — каждый лид получает ответ одинакового качества"],
  },
};

export default async function AutoReplyTutorial({ searchParams }: { searchParams: { locale?: string } }) {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  const c = content[locale];

  return (
    <TutorialTemplate
      title={c.title}
      description={c.description}
      canonical="https://www.24go.site/tutorials/telegram-auto-reply"
      prerequisites={c.prerequisites}
      steps={c.steps}
      mistakes={c.mistakes}
      results={c.results}
      locale={locale}
    />
  );
}

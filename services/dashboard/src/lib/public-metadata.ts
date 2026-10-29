import type { Metadata } from "next";

// Query locale is a distinct document only where the body is already translated.
export function localizedAlternates(path: string, locale?: string): Metadata["alternates"] {
  const en = `https://www.24go.site${path}?locale=en`;
  const ru = `https://www.24go.site${path}?locale=ru`;
  return { canonical: locale === "ru" ? ru : en, languages: { en, ru, "x-default": en } };
}

const localizedCopy: Record<string, { title: string; description: string }> = {
  "/features": {
    "title": "Возможности — лидогенерация в Telegram и VK",
    "description": "Поиск групп, квалификация лидов с ИИ, управление кампаниями и аналитика в 24GO."
  },
  "/pricing": {
    "title": "Тарифы — планы лидогенерации для Telegram и VK",
    "description": "Сравните планы Starter, Pro и Enterprise, доступные инструменты и услуги настройки 24GO."
  },
  "/tools": {
    "title": "Инструменты маркетинга в Telegram",
    "description": "Калькулятор ROI, анализ групп, проверка аккаунтов и руководства по работе с Telegram."
  },
  "/privacy": {
    "title": "Политика конфиденциальности",
    "description": "Политика обработки и защиты персональных данных пользователей платформы 24GO."
  },
  "/terms": {
    "title": "Условия использования",
    "description": "Условия использования платформы 24GO для работы с лидами в Telegram и VK."
  },
  "/integrations/amo-crm": {
    "title": "Интеграция Telegram с AmoCRM",
    "description": "Руководство по передаче лидов из Telegram и настройке обмена данными с AmoCRM."
  },
  "/integrations/bitrix24": {
    "title": "Интеграция Telegram с Битрикс24",
    "description": "Руководство по передаче лидов из Telegram и настройке обмена данными с Битрикс24."
  },
  "/integrations/google-sheets": {
    "title": "Интеграция Telegram с Google Sheets",
    "description": "Руководство по передаче лидов из Telegram и настройке обмена данными с Google Sheets."
  },
  "/integrations/hubspot": {
    "title": "Интеграция Telegram с HubSpot",
    "description": "Руководство по передаче лидов из Telegram и настройке обмена данными с HubSpot."
  },
  "/integrations/webhook": {
    "title": "Интеграция Telegram с вебхуками",
    "description": "Руководство по передаче лидов из Telegram и настройке обмена данными с вебхуками."
  },
  "/tutorials/telegram-auto-reply": {
    "title": "Как настроить автоответы в Telegram",
    "description": "Руководство по настройке шаблонов и правил автоответа на обращения в Telegram."
  },
  "/tutorials/telegram-lead-scraping": {
    "title": "Как собирать лиды в Telegram",
    "description": "Поиск целевых групп, сбор обращений и квалификация лидов в Telegram."
  },
  "/tutorials/telegram-warmup": {
    "title": "Как управлять нагрузкой на аккаунты Telegram",
    "description": "Лимиты активности, наблюдение за ограничениями и риски автоматизации в Telegram."
  }
};

export function localizedPageMetadata(path: string, locale: string | undefined, metadata: Metadata): Metadata {
  const copy = locale === "ru" ? localizedCopy[path] : undefined;
  return { ...metadata, ...copy, alternates: localizedAlternates(path, locale) };
}

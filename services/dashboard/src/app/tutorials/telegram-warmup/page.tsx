import type { Metadata } from "next";
import TutorialTemplate from "../TutorialTemplate";

import { localizedPageMetadata } from "@/lib/public-metadata";

const pageMetadata: Metadata = {
  title: "Managing Telegram Account Activity and Limits | 24GO",
  description: "Understand activity limits, account restrictions and the risks of Telegram automation. No guaranteed delivery or account-safety outcomes.",
  robots: "index, follow",
};

export function generateMetadata({ searchParams }: { searchParams?: { locale?: string } }): Metadata {
  return localizedPageMetadata("/tutorials/telegram-warmup", searchParams?.locale, pageMetadata);
}

const content = {
  en: {
    title: "Managing Telegram Account Activity",
    description: "Review account state and activity settings before enabling an automated workflow. Restrictions remain possible; warmup cannot guarantee account safety, delivery or a fixed time to readiness.",
    prerequisites: ["A Telegram account you are authorized to connect", "Access to the Telegram section of 24GO", "A designated test group and permission for the intended actions"],
    steps: [
      { title: "Connect the intended account", content: "Open Telegram → Accounts and use the connection controls. Keep passwords and verification codes in the secure connection interface, not in support chat." },
      { title: "Review the available settings", content: "Open Telegram → Settings and inspect the activity and warmup settings that your plan exposes. Saving a setting does not prove a worker is running or that an external action succeeded." },
      { title: "Check the account state", content: "Review the saved account state and any restrictions shown in Telegram → Accounts. A stored connection is not proof that every provider operation is available." },
      { title: "Use a bounded test", content: "Choose a test resource and explicitly permitted action. Check the actual result before expanding the workflow; do not send unsolicited messages or join unrelated groups to simulate activity." },
      { title: "Respond to restrictions", content: "If Telegram reports a restriction or an operation fails, pause the affected workflow and follow the provider's instructions. A proxy, delay or warmup stage does not remove Telegram's rules." },
      { title: "Keep the operating boundary explicit", content: "Automatic sending, monitoring and account activity are different capabilities. Enable only supported controls and verify the specific workflow rather than assuming that a warmup setting starts all of them." },
    ],
    mistakes: ["Treating a saved setting as proof of a running worker", "Assuming a fixed number of days makes an account safe", "Using artificial engagement or unsolicited messages as a test", "Ignoring provider restrictions or failed operations", "Sharing credentials or verification codes in chat", "Assuming the same limits apply to every account"],
    results: ["An explicit list of connected accounts and permitted test actions", "A distinction between saved configuration and observed execution", "A repeatable way to inspect errors and stop affected workflows", "Restrictions remain possible; delivery and account safety are not guaranteed"],
  },
  ru: {
    title: "Управление активностью аккаунтов Telegram",
    description: "Проверьте состояние аккаунта и настройки до включения автоматизации. Риск ограничений сохраняется; прогрев не гарантирует безопасность аккаунта, доставку или готовность за фиксированный срок.",
    prerequisites: ["Аккаунт Telegram, который вы вправе подключать", "Доступ к разделу Telegram в 24GO", "Выделенная тестовая группа и разрешение на конкретные действия"],
    steps: [
      { title: "Подключите нужный аккаунт", content: "Откройте Telegram → Аккаунты и используйте доступные элементы подключения. Пароли и коды подтверждения вводятся только в защищённом интерфейсе, не в чате поддержки." },
      { title: "Проверьте доступные настройки", content: "Откройте Telegram → Настройки и изучите параметры активности и прогрева, доступные вашему тарифу. Сохранение настройки не доказывает запуск обработчика или успешное внешнее действие." },
      { title: "Проверьте состояние аккаунта", content: "Посмотрите сохранённое состояние и ограничения в Telegram → Аккаунты. Наличие подключения не означает доступность всех операций провайдера." },
      { title: "Выполните ограниченный тест", content: "Выберите тестовый ресурс и явно разрешённое действие. Проверьте фактический результат до расширения сценария; не отправляйте нежелательные сообщения и не вступайте в произвольные группы ради имитации активности." },
      { title: "Учитывайте ограничения", content: "Если Telegram сообщил об ограничении или операция завершилась ошибкой, приостановите соответствующий сценарий и следуйте указаниям платформы. Прокси, задержки и этапы прогрева не отменяют правила Telegram." },
      { title: "Разделяйте возможности сервиса", content: "Отправка сообщений, мониторинг и активность аккаунта — разные возможности. Используйте только доступные элементы управления и проверяйте конкретный сценарий, а не предполагайте, что настройка прогрева запускает всё сразу." },
    ],
    mistakes: ["Считать сохранённую настройку доказательством работающего обработчика", "Считать аккаунт безопасным через фиксированное число дней", "Проверять сервис искусственной активностью или нежелательными сообщениями", "Игнорировать ограничения платформы и ошибки операций", "Передавать пароли и коды подтверждения в чат", "Считать лимиты одинаковыми для всех аккаунтов"],
    results: ["Явный перечень подключённых аккаунтов и разрешённых тестовых действий", "Различие между сохранённой конфигурацией и фактическим выполнением", "Повторяемая проверка ошибок и остановка затронутых сценариев", "Риск ограничений сохраняется; доставка и безопасность аккаунта не гарантируются"],
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

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | 24GO",
  description: "Privacy Policy for 24GO — automated lead generation platform for Telegram and VK.",
  robots: "index, follow",
  alternates: { canonical: "https://www.24go.site/privacy" },
};

const content = {
  en: {
    title: "Privacy Policy",
    updated: "Last updated: September 16, 2026",
    sections: [
      {
        heading: "1. Introduction",
        text: "Welcome to 24GO (\"we\", \"our\", \"us\"). We operate the 24GO platform (the \"Service\") at 24go.site. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our Service.",
      },
      {
        heading: "2. Information We Collect",
        text: "We collect information you provide directly:\n• Account information (email, company name, password)\n• Payment information (processed securely via Stripe/YooKassa — we do not store card numbers)\n• Telegram and VK API credentials (encrypted at rest using Fernet encryption)\n• Campaign content, target groups, and lead data\n• Communications with us (support requests, feedback)\n\nWe automatically collect:\n• Usage data (pages visited, features used, timestamps)\n• Device information (browser type, IP address)\n• Cookies and session tokens",
      },
      {
        heading: "3. How We Use Your Information",
        text: "• To provide and maintain the Service\n• To process campaigns and generate leads on your behalf\n• To authenticate and secure your account\n• To process payments\n• To send service-related communications\n• To improve our Service\n• To comply with legal obligations",
      },
      {
        heading: "4. Data Sharing",
        text: "We do not sell your personal data. We share information only:\n• With Telegram and VK APIs to execute your campaigns (as directed by you)\n• With payment processors (Stripe, YooKassa) to process transactions\n• With hosting providers (infrastructure)\n• When required by law\n• With your explicit consent",
      },
      {
        heading: "5. Data Security",
        text: "We implement industry-standard security measures:\n• All data encrypted in transit (TLS/HTTPS)\n• Telegram/VK tokens encrypted at rest (Fernet encryption)\n• Database access restricted by tenant isolation (Row-Level Security)\n• Regular security audits\n• No storage of payment card data",
      },
      {
        heading: "6. Data Retention",
        text: "• Account data: retained while your account is active\n• Campaign data: retained for 30 days after account deletion\n• Lead data: retained for 30 days after account deletion\n• Logs: retained for 90 days\n• Payment records: retained for 7 years (legal requirement)",
      },
      {
        heading: "7. Your Rights (GDPR)",
        text: "If you are in the European Economic Area, you have the right to:\n• Access your personal data\n• Correct inaccurate data\n• Delete your account and data\n• Export your data\n• Object to processing\n• Withdraw consent\n\nTo exercise these rights, use the Settings → Data Export/Delete in your dashboard, or contact us.",
      },
      {
        heading: "8. Cookies",
        text: "We use essential cookies for authentication and session management. We do not use advertising or tracking cookies. You can manage cookie preferences through your browser settings.",
      },
      {
        heading: "9. International Transfers",
        text: "Your data may be processed in countries outside your own. We ensure adequate protection through standard contractual clauses and encryption.",
      },
      {
        heading: "10. Children's Privacy",
        text: "Our Service is not intended for children under 16. We do not knowingly collect data from children.",
      },
      {
        heading: "11. Changes to This Policy",
        text: "We may update this Privacy Policy. We will notify you of material changes via email or in-app notification.",
      },
      {
        heading: "12. Contact Us",
        text: "Email: privacy@24go.site\nCompany: 24GO\nWebsite: https://24go.site",
      },
    ],
  },
  ru: {
    title: "Политика конфиденциальности",
    updated: "Последнее обновление: 16 сентября 2026 г.",
    sections: [
      {
        heading: "1. Введение",
        text: "Добро пожаловать на 24GO («мы», «наш», «нас»). Мы управляем платформой 24GO («Сервис») по адресу 24go.site. Эта Политика конфиденциальности объясняет, как мы собираем, используем, раскрываем и защищаем вашу информацию при использовании нашего Сервиса.",
      },
      {
        heading: "2. Какую информацию мы собираем",
        text: "Мы собираем информацию, которую вы предоставляете напрямую:\n• Информацию об аккаунте (email, название компании, пароль)\n• Платёжную информацию (безопасно обрабатывается через Stripe/YooKassa — мы не храним номера карт)\n• Учётные данные Telegram и VK API (зашифрованы с помощью Fernet)\n• Данные кампаний, целевых групп и лидов\n• Переписку с нами (запросы в поддержку, отзывы)\n\nМы автоматически собираем:\n• Данные об использовании (посещённые страницы, используемые функции, временные метки)\n• Информацию об устройстве (тип браузера, IP-адрес)\n• Cookies и сессионные токены",
      },
      {
        heading: "3. Как мы используем вашу информацию",
        text: "• Для предоставления и поддержки Сервиса\n• Для обработки кампаний и генерации лидов от вашего имени\n• Для аутентификации и защиты вашего аккаунта\n• Для обработки платежей\n• Для отправки служебных уведомлений\n• Для улучшения нашего Сервиса\n• Для соблюдения правовых обязательств",
      },
      {
        heading: "4. Передача данных",
        text: "Мы не продаём ваши персональные данные. Мы передаём информацию только:\n• API Telegram и VK для выполнения ваших кампаний (по вашему указанию)\n• Процессорам платежей (Stripe, YooKassa) для обработки транзакций\n• Провайдерам хостинга (инфраструктура)\n• По требованию закона\n• С вашего явного согласия",
      },
      {
        heading: "5. Безопасность данных",
        text: "Мы внедряем отраслевые стандарты безопасности:\n• Все данные зашифрованы при передаче (TLS/HTTPS)\n• Токены Telegram/VK зашифрованы при хранении (Fernet)\n• Доступ к базе данных ограничен изоляцией тенантов (Row-Level Security)\n• Регулярные аудиты безопасности\n• Без хранения платёжных данных карт",
      },
      {
        heading: "6. Хранение данных",
        text: "• Данные аккаунта: хранятся пока активен ваш аккаунт\n• Данные кампаний: хранятся 30 дней после удаления аккаунта\n• Данные лидов: хранятся 30 дней после удаления аккаунта\n• Логи: хранятся 90 дней\n• Платёжные записи: хранятся 7 лет (требование закона)",
      },
      {
        heading: "7. Ваши права (GDPR)",
        text: "Если вы находитесь в Европейской экономической зоне, вы имеете право:\n• Получить доступ к вашим персональным данным\n• Исправить неточные данные\n• Удалить аккаунт и данные\n• Экспортировать данные\n• Возражать против обработки\n• Отозвать согласие\n\nДля реализации этих прав используйте Настройки → Экспорт/Удаление данных в дашборде или свяжитесь с нами.",
      },
      {
        heading: "8. Cookies",
        text: "Мы используем essential cookies для аутентификации и управления сессиями. Мы не используем рекламные или отслеживающие cookies. Вы можете управлять настройками cookies через настройки браузера.",
      },
      {
        heading: "9. Международные передачи",
        text: "Ваши данные могут обрабатываться за пределами вашей страны. Мы обеспечиваем адекватную защиту через стандартные договорные оговорки и шифрование.",
      },
      {
        heading: "10. Конфиденциальность детей",
        text: "Наш Сервис не предназначен для детей младше 16 лет. Мы намеренно не собираем данные от детей.",
      },
      {
        heading: "11. Изменения в этой политике",
        text: "Мы можем обновлять эту Политику конфиденциальности. Мы уведомим вас о существенных изменениях по электронной почте или через уведомления в приложении.",
      },
      {
        heading: "12. Контакты",
        text: "Email: privacy@24go.site\nКомпания: 24GO\nСайт: https://24go.site",
      },
    ],
  },
};

export default async function PrivacyPage({ searchParams }: { searchParams: { locale?: string } }) {
  const locale = searchParams?.locale === "ru" ? "ru" : "en";
  const c = content[locale];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-3xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-2">{c.title}</h1>
        <p className="text-zinc-500 mb-10">{c.updated}</p>
        <div className="space-y-8">
          {c.sections.map((s, i) => (
            <section key={i}>
              <h2 className="text-xl font-semibold mb-3 text-emerald-400">{s.heading}</h2>
              <p className="text-zinc-300 leading-relaxed whitespace-pre-line">{s.text}</p>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}

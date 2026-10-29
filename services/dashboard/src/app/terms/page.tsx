import type { Metadata } from "next";

import { localizedPageMetadata } from "@/lib/public-metadata";

const pageMetadata: Metadata = {
  title: "Terms of Service | 24GO",
  description: "Terms of Service for 24GO — automated lead generation platform for Telegram and VK.",
  robots: "index, follow",
};

export function generateMetadata({ searchParams }: { searchParams?: { locale?: string } }): Metadata {
  return localizedPageMetadata("/terms", searchParams?.locale, pageMetadata);
}

const content = {
  en: {
    title: "Terms of Service",
    updated: "Last updated: September 16, 2026",
    sections: [
      {
        heading: "1. Acceptance of Terms",
        text: "By accessing or using 24GO (the \"Service\") at 24go.site, you agree to be bound by these Terms of Service. If you do not agree, do not use the Service.",
      },
      {
        heading: "2. Description of Service",
        text: "24GO is a B2B SaaS platform for automated lead generation in Telegram and VK social networks. The Service includes:\n• Lead collection and classification\n• Automated messaging and campaign management\n• Analytics and reporting\n• Integration with third-party services",
      },
      {
        heading: "3. Account Registration",
        text: "You must provide accurate, complete information during registration. You are responsible for:\n• Maintaining the confidentiality of your credentials\n• All activities under your account\n• Ensuring your account information is current",
      },
      {
        heading: "4. Acceptable Use",
        text: "You agree NOT to:\n• Use the Service for illegal purposes\n• Violate Telegram or VK Terms of Service\n• Send spam or unsolicited messages\n• Harvest personal data without consent\n• Attempt to circumvent rate limits or security measures\n• Resell or redistribute the Service without authorization\n• Use the Service to harass, abuse, or harm others",
      },
      {
        heading: "5. Payment Terms",
        text: "• Plans are billed monthly in advance\n• Prices are listed on the pricing page and may change with 30 days notice\n• Payments are processed by Stripe or YooKassa\n• Free trial: 3 days, no payment required\n• Refunds: pro-rata for unused service periods upon request\n• Failed payments: service suspended after 7-day grace period",
      },
      {
        heading: "6. Intellectual Property",
        text: "• The Service and its original content are owned by 24GO\n• You retain ownership of your data, campaigns, and leads\n• You grant us a license to process your data as needed to provide the Service\n• You may not copy, modify, or distribute our proprietary technology",
      },
      {
        heading: "7. Data Ownership",
        text: "• You own all leads, campaigns, and content you create\n• We do not use your data for our own purposes\n• Upon account deletion, your data is removed within 30 days\n• We may retain anonymized, aggregated data for analytics",
      },
      {
        heading: "8. Third-Party Services",
        text: "The Service integrates with Telegram, VK, Stripe, YooKassa, and other third parties. We are not responsible for their availability, accuracy, or policies. Your use of third-party services is subject to their respective terms.",
      },
      {
        heading: "9. Service Availability",
        text: "• We strive for 99.9% uptime but do not guarantee uninterrupted service\n• Scheduled maintenance: we will notify you in advance\n• We are not liable for downtime caused by third-party providers\n• Emergency maintenance may occur without notice",
      },
      {
        heading: "10. Limitation of Liability",
        text: "TO THE MAXIMUM EXTENT PERMITTED BY LAW:\n• The Service is provided \"as is\" without warranties\n• We are not liable for indirect, incidental, or consequential damages\n• Our total liability shall not exceed the amount paid by you in the last 12 months\n• We are not liable for lost profits, data, or business opportunities",
      },
      {
        heading: "11. Indemnification",
        text: "You agree to indemnify and hold harmless 24GO from any claims arising from your use of the Service, violation of these Terms, or violation of any third-party rights.",
      },
      {
        heading: "12. Termination",
        text: "• You may cancel your account at any time via Settings\n• We may suspend or terminate your account for Terms violations\n• Upon termination, your data is retained for 30 days then deleted\n• Provisions regarding liability, indemnification, and governing law survive termination",
      },
      {
        heading: "13. Governing Law",
        text: "These Terms are governed by the laws of the Russian Federation. Disputes shall be resolved in the courts of Moscow, Russia.",
      },
      {
        heading: "14. Changes to Terms",
        text: "We may update these Terms. Material changes will be notified 30 days in advance via email. Continued use after changes constitutes acceptance.",
      },
      {
        heading: "15. Contact",
        text: "Email: legal@24go.site\nWebsite: https://24go.site",
      },
    ],
  },
  ru: {
    title: "Условия использования",
    updated: "Последнее обновление: 16 сентября 2026 г.",
    sections: [
      {
        heading: "1. Принятие условий",
        text: "Получая доступ к 24GO («Сервис») по адресу 24go.site или используя его, вы соглашаетесь с данными Условиями использования. Если вы не согласны — не используйте Сервис.",
      },
      {
        heading: "2. Описание Сервиса",
        text: "24GO — это B2B SaaS платформа для автоматической генерации лидов в социальных сетях Telegram и VK. Сервис включает:\n• Сбор и классификацию лидов\n• Автоматическую рассылку и управление кампаниями\n• Аналитику и отчётность\n• Интеграцию с сторонними сервисами",
      },
      {
        heading: "3. Регистрация аккаунта",
        text: "Вы должны предоставить точную и полную информацию при регистрации. Вы несёте ответственность за:\n• Сохранность ваших учётных данных\n• Все действия под вашим аккаунтом\n• Актуальность информации об аккаунте",
      },
      {
        heading: "4. Допустимое использование",
        text: "Вы соглашаетесь НЕ:\n• Использовать Сервис в незаконных целях\n• Нарушать Условия использования Telegram или VK\n• Отправлять спам или незапрошенные сообщения\n• Собирать персональные данные без согласия\n• Пытаться обойти лимиты или меры безопасности\n• Перепродавать или распространять Сервис без авторизации\n• Использовать Сервис для преследования, злоупотребления или причинения вреда",
      },
      {
        heading: "5. Условия оплаты",
        text: "• Тарифы billed ежемесячно авансом\n• Цены указаны на странице тарифов и могут измениться с уведомлением за 30 дней\n• Платежи обрабатываются Stripe или YooKassa\n• Бесплатный триал: 3 дня, оплата не требуется\n• Возврат: пропорционально неиспользованному периоду по запросу\n• Неудачные платежи: сервис приостанавливается после 7-дневного льготного периода",
      },
      {
        heading: "6. Интеллектуальная собственность",
        text: "• Сервис и его оригинальный контент принадлежат 24GO\n• Вы сохраняете право собственности на свои данные, кампании и лиды\n• Вы предоставляете нам лицензию на обработку ваших данных для предоставления Сервиса\n• Вы не можете копировать, модифицировать или распространять наши проприетарные технологии",
      },
      {
        heading: "7. Владение данными",
        text: "• Вы владеете всеми лидами, кампаниями и контентом, который вы создаёте\n• Мы не используем ваши данные в собственных целях\n• После удаления аккаунта ваши данные удаляются в течение 30 дней\n• Мы можем сохранять анонимизированные агрегированные данные для аналитики",
      },
      {
        heading: "8. Сторонние сервисы",
        text: "Сервис интегрируется с Telegram, VK, Stripe, YooKassa и другими сторонними сервисами. Мы не несём ответственности за их доступность, точность или политики. Использование сторонних сервисов регулируется их условиями.",
      },
      {
        heading: "9. Доступность Сервиса",
        text: "• Мы стремимся к 99.9% аптайму, но не гарантируем бесперебойную работу\n• Плановое обслуживание: уведомляем заранее\n• Мы не несём ответственности за простои, вызванные сторонними провайдерами\n• Аварийное обслуживание может проводиться без уведомления",
      },
      {
        heading: "10. Ограничение ответственности",
        text: "В МАКСИМАЛЬНОЙ СТЕПЕНИ, ДОПУСТИМОЙ ЗАКОНОМ:\n• Сервис предоставляется «как есть» без гарантий\n• Мы не несём ответственности за косвенные, случайные или последующие убытки\n• Наша общая ответственность не превышает сумму, уплаченную вами за последние 12 месяцев\n• Мы не несём ответственности за упущенную прибыль, данные или бизнес-возможности",
      },
      {
        heading: "11. Возмещение убытков",
        text: "Вы соглашаетесь возмещать и защищать 24GO от любых претензий, возникающих из вашего использования Сервиса, нарушения этих Условий или нарушения прав третьих лиц.",
      },
      {
        heading: "12. Расторжение",
        text: "• Вы можете удалить аккаунт в любое время через Настройки\n• Мы можем приостановить или удалить аккаунт за нарушение Условий\n• После расторжения данные хранятся 30 дней, затем удаляются\n• Положения об ответственности, возмещении и применимом праве сохраняют силу после расторжения",
      },
      {
        heading: "13. Применимое право",
        text: "Эти Условия регулируются законодательством Российской Федерации. Споры разрешаются в судах города Москвы, Россия.",
      },
      {
        heading: "14. Изменения в Условиях",
        text: "Мы можем обновлять эти Условия. Существенные изменения будут уведомлены за 30 дней по электронной почте. Продолжение использования после изменений означает принятие.",
      },
      {
        heading: "15. Контакты",
        text: "Email: legal@24go.site\nСайт: https://24go.site",
      },
    ],
  },
};

export default async function TermsPage({ searchParams }: { searchParams: { locale?: string } }) {
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

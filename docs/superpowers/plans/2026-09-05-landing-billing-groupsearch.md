# Landing Page, Billing & Group Search Polish

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite billing descriptions, add TXT group import, improve landing page (help links, conservative metrics, expandable reviews, custom icons).

**Architecture:** Frontend-only changes across 4 files: `billing/page.tsx`, `groups/page.tsx`, `page.tsx` (landing), `Icons.tsx`. i18n keys updated in `en.json` and `ru.json`.

**Tech Stack:** Next.js, React, Tailwind CSS, custom SVG icons (`Icons.tsx`).

## Global Constraints
- Dark theme: `zinc-900` backgrounds, `zinc-800` borders, `zinc-100` text
- All text via `useI18n()` — both EN and RU must be updated
- Icons from `@/components/Icons` (custom SVG library), NOT emoji or generic
- `FieldHint` for tooltips, `useToast` for notifications
- `btn-press` class for interactive buttons
- Animations: `animate-fade-slide-in` on page mount

---

## Task 1: Billing Page — Rewrite Tariff Descriptions

**Files:**
- Modify: `services/dashboard/src/lib/en.json` (billing/plans/hints keys)
- Modify: `services/dashboard/src/lib/ru.json` (billing/plans/hints keys)
- Modify: `services/dashboard/src/app/(dashboard)/billing/page.tsx` (plan card layout)

**Goal:** Make tariff descriptions more compelling and benefit-focused. Add description text under each plan name explaining who it's for.

### Step 1: Update i18n keys — EN

In `en.json`, replace the `plans.*` and `hints.billing.*` keys:

```json
"plans.starter": "Starter",
"plans.starterPrice": "$75",
"plans.pro": "Pro",
"plans.proPrice": "$199",
"plans.enterprise": "Enterprise",
"plans.enterprisePrice": "$499",
"plans.perMonth": "/mo",
"plans.starterDesc": "For small teams getting started with automated lead generation",
"plans.proDesc": "For growing businesses that need more accounts and higher throughput",
"plans.enterpriseDesc": "For agencies and enterprises with unlimited scale requirements",
"plans.starterPosts": "500 posts/mo",
"plans.starterTokens": "500K tokens",
"plans.starterAccounts": "3 accounts",
"plans.starterSupport": "Email support",
"plans.proPosts": "3,000 posts/mo",
"plans.proTokens": "2M tokens",
"plans.proAccounts": "10 accounts",
"plans.proSupport": "Priority support",
"plans.proApi": "API access",
"plans.enterprisePosts": "Unlimited posts",
"plans.enterpriseTokens": "Unlimited tokens",
"plans.enterpriseAccounts": "Unlimited accounts",
"plans.enterpriseSupport": "Dedicated support",
"plans.enterpriseIntegrations": "Custom integrations",
"plans.enterpriseSla": "SLA",
"hints.billing.starterFeature0": "Publish up to 500 posts per month across your Telegram channels",
"hints.billing.starterFeature1": "500K AI tokens for lead classification and auto-replies",
"hints.billing.starterFeature2": "Connect up to 3 Telegram accounts for monitoring and posting",
"hints.billing.starterFeature3": "Email support with response within 48h",
"hints.billing.proFeature0": "Publish up to 3,000 posts per month across all channels",
"hints.billing.proFeature1": "2M AI tokens for classification, auto-replies, and campaign content",
"hints.billing.proFeature2": "Connect up to 10 Telegram accounts for broader coverage",
"hints.billing.proFeature3": "Priority email & chat support with 12h response time",
"hints.billing.proFeature4": "Direct API access for CRM integration and custom workflows",
"hints.billing.enterpriseFeature0": "Unlimited posts across unlimited channels",
"hints.billing.enterpriseFeature1": "Unlimited AI tokens — no usage caps",
"hints.billing.enterpriseFeature2": "Unlimited Telegram accounts for maximum coverage",
"hints.billing.enterpriseFeature3": "Dedicated account manager and onboarding",
"hints.billing.enterpriseFeature4": "Custom integrations, webhooks, and white-label options",
"hints.billing.enterpriseFeature5": "99.9% uptime SLA with financial guarantees"
```

### Step 2: Update i18n keys — RU

In `ru.json`, replace the same keys with Russian translations:

```json
"plans.starterDesc": "Для небольших команд, начинающих автоматическую лидогенерацию",
"plans.proDesc": "Для растущих бизнесов, которым нужно больше аккаунтов и выше пропускная способность",
"plans.enterpriseDesc": "Для агентств и предприятий с требованиями к неограниченному масштабу",
"plans.starterPosts": "500 постов/мес",
"plans.starterTokens": "500K токенов",
"plans.starterAccounts": "3 аккаунта",
"plans.starterSupport": "Поддержка по email",
"plans.proPosts": "3 000 постов/мес",
"plans.proTokens": "2M токенов",
"plans.proAccounts": "10 аккаунтов",
"plans.proSupport": "Приоритетная поддержка",
"plans.proApi": "Доступ к API",
"plans.enterprisePosts": "Безлимитные посты",
"plans.enterpriseTokens": "Безлимитные токены",
"plans.enterpriseAccounts": "Безлимитные аккаунты",
"plans.enterpriseSupport": "Выделенная поддержка",
"plans.enterpriseIntegrations": "Индивидуальные интеграции",
"plans.enterpriseSla": "SLA",
"hints.billing.starterFeature0": "Публикация до 500 постов в месяц в ваших Telegram-каналах",
"hints.billing.starterFeature1": "500K AI-токенов для классификации лидов и автоответов",
"hints.billing.starterFeature2": "Подключение до 3 аккаунтов Telegram для мониторинга и публикаций",
"hints.billing.starterFeature3": "Email-поддержка с ответом в течение 48ч",
"hints.billing.proFeature0": "Публикация до 3 000 постов в месяц по всем каналам",
"hints.billing.proFeature1": "2M AI-токенов для классификации, автоответов и контента кампаний",
"hints.billing.proFeature2": "Подключение до 10 аккаунтов Telegram для более широкого охвата",
"hints.billing.proFeature3": "Приоритетная поддержка по email и чату с ответом за 12ч",
"hints.billing.proFeature4": "Прямой доступ к API для интеграции с CRM и кастомными workflow",
"hints.billing.enterpriseFeature0": "Безлимитные посты по неограниченному числу каналов",
"hints.billing.enterpriseFeature1": "Безлимитные AI-токены — без ограничений по использованию",
"hints.billing.enterpriseFeature2": "Безлимитные аккаунты Telegram для максимального охвата",
"hints.billing.enterpriseFeature3": "Выделенный менеджер и онбординг",
"hints.billing.enterpriseFeature4": "Индивидуальные интеграции, вебхуки и white-label",
"hints.billing.enterpriseFeature5": "SLA 99.9% с финансовыми гарантиями"
```

### Step 3: Update billing page layout

In `billing/page.tsx`, update `getPlans` to include the new `desc` field and display it:

```tsx
const getPlans = (t: (k: string) => string) => [
  {
    name: t("plans.starter"),
    price: t("plans.starterPrice"),
    period: t("plans.perMonth"),
    desc: t("plans.starterDesc"),
    features: [t("plans.starterPosts"), t("plans.starterTokens"), t("plans.starterAccounts"), t("plans.starterSupport")],
  },
  {
    name: t("plans.pro"),
    price: t("plans.proPrice"),
    period: t("plans.perMonth"),
    desc: t("plans.proDesc"),
    features: [t("plans.proPosts"), t("plans.proTokens"), t("plans.proAccounts"), t("plans.proSupport"), t("plans.proApi")],
  },
  {
    name: t("plans.enterprise"),
    price: t("plans.enterprisePrice"),
    period: t("plans.perMonth"),
    desc: t("plans.enterpriseDesc"),
    features: [t("plans.enterprisePosts"), t("plans.enterpriseTokens"), t("plans.enterpriseAccounts"), t("plans.enterpriseSupport"), t("plans.enterpriseIntegrations"), t("plans.enterpriseSla")],
  },
];
```

Then in the plan card JSX, add the description after the plan name:

```tsx
<div className="flex items-center justify-between">
  <h3 className="text-zinc-100 font-medium text-lg">{p.name}</h3>
  {isCurrent && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">{t("billing.current")}</span>}
</div>
<p className="text-xs text-zinc-500 mt-1">{p.desc}</p>
```

### Step 4: Commit

```bash
git add services/dashboard/src/lib/en.json services/dashboard/src/lib/ru.json services/dashboard/src/app/\(dashboard\)/billing/page.tsx
git commit -m "feat: rewrite billing tariff descriptions with benefits-focused copy"
```

---

## Task 2: Group Search — Add TXT Upload

**Files:**
- Modify: `services/dashboard/src/app/(dashboard)/groups/page.tsx` (add TXT upload UI)
- Modify: `services/dashboard/src/lib/en.json` (add i18n keys)
- Modify: `services/dashboard/src/lib/ru.json` (add i18n keys)

**Goal:** Add ability to upload groups via TXT file (1 group per line) in the monitoring/groups page bulk import.

### Step 1: Add i18n keys — EN

In `en.json`, add after existing `groups.*` keys:

```json
"groups.uploadTxt": "Import from TXT",
"groups.uploadTxtHint": "One group per line: @username or https://t.me/username",
"groups.uploadTxtDrop": "Or drop a .txt file here",
"groups.uploadTxtUploading": "Uploading..."
```

### Step 2: Add i18n keys — RU

In `ru.json`:

```json
"groups.uploadTxt": "Импорт из TXT",
"groups.uploadTxtHint": "Одна группа на строку: @username или https://t.me/username",
"groups.uploadTxtDrop": "Или перетащите .txt файл сюда",
"groups.uploadTxtUploading": "Загрузка..."
```

### Step 3: Add TXT upload to groups page

In `groups/page.tsx`, the bulk import modal already exists (lines 50-55 state, `parseBulkInput` function). Add a file upload button inside the bulk import modal. Find the `showBulkImport` modal section and add a file input:

After the textarea in the bulk import modal, add:

```tsx
{/* TXT file upload */}
<div className="relative">
  <input
    type="file"
    accept=".txt"
    className="absolute inset-0 opacity-0 cursor-pointer"
    onChange={(e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        setBulkInput(ev.target?.result as string);
        setBulkPreview(parseBulkInput(ev.target?.result as string));
      };
      reader.readAsText(file);
    }}
  />
  <div className="border-2 border-dashed border-zinc-700 rounded-lg p-4 text-center text-xs text-zinc-500 hover:border-zinc-500 transition">
    <p>{t("groups.uploadTxtDrop")}</p>
    <p className="text-zinc-600 mt-1">{t("groups.uploadTxtHint")}</p>
  </div>
</div>
```

### Step 4: Commit

```bash
git add services/dashboard/src/app/\(dashboard\)/groups/page.tsx services/dashboard/src/lib/en.json services/dashboard/src/lib/ru.json
git commit -m "feat: add TXT file upload for bulk group import"
```

---

## Task 3: Landing Page — Help Link for Registered Users

**Files:**
- Modify: `services/dashboard/src/app/page.tsx` (add help link/footnote)
- Modify: `services/dashboard/src/lib/en.json` (add i18n keys)
- Modify: `services/dashboard/src/lib/ru.json` (add i18n keys)

**Goal:** In the "How it works" section, add a visible footnote/link showing registered users get access to a full guide at https://www.24go.site/help, with a screenshot mockup.

### Step 1: Add i18n keys — EN

In `en.json`, add after `landing.step3Cta`:

```json
"landing.registeredHint": "Already registered? Full guide with screenshots available at",
"landing.registeredLink": "24go.site/help",
"landing.guideScreenshot": "Step-by-step guide preview"
```

### Step 2: Add i18n keys — RU

In `ru.json`:

```json
"landing.registeredHint": "Уже зарегистрированы? Полное руководство со скриншотами доступно на",
"landing.registeredLink": "24go.site/help",
"landing.guideScreenshot": "Предпросмотр пошагового руководства"
```

### Step 3: Add footnote below the 3 steps

In `page.tsx`, after the 3-step "How it works" section (after line 273, before the "Real Results" section), add:

```tsx
{/* Registered users hint */}
<div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 flex flex-col md:flex-row items-center gap-4">
  <div className="flex-1">
    <p className="text-sm text-zinc-400">
      {t("landing.registeredHint")}{" "}
      <a href="https://www.24go.site/help" target="_blank" rel="noopener noreferrer"
        className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2">
        {t("landing.registeredLink")}
      </a>
    </p>
  </div>
  <div className="w-full md:w-64 bg-zinc-800 rounded-lg p-3 border border-zinc-700">
    <div className="text-[10px] text-zinc-500 mb-2">{t("landing.guideScreenshot")}</div>
    <div className="space-y-1.5">
      <div className="h-2 bg-zinc-700 rounded w-full" />
      <div className="h-2 bg-zinc-700 rounded w-4/5" />
      <div className="h-2 bg-emerald-500/30 rounded w-3/5" />
      <div className="h-2 bg-zinc-700 rounded w-full" />
      <div className="h-2 bg-zinc-700 rounded w-2/3" />
    </div>
  </div>
</div>
```

### Step 4: Commit

```bash
git add services/dashboard/src/app/page.tsx services/dashboard/src/lib/en.json services/dashboard/src/lib/ru.json
git commit -m "feat: landing page — add registered users help link with guide preview"
```

---

## Task 4: Landing Page — Conservative Metrics & Results

**Files:**
- Modify: `services/dashboard/src/lib/en.json` (landing.results.*, landing.metric.*, landing.funnel.*, landing.case*)
- Modify: `services/dashboard/src/lib/ru.json` (same keys)

**Goal:** Make results look realistic and guaranteed, not "wow". Increase timeframes, decrease numbers.

### Step 1: Update EN i18n keys

Replace in `en.json`:

```json
"landing.stat1Value": "200+",
"landing.stat1Label": "Leads per month",
"landing.stat2Value": "< 5 min",
"landing.stat2Label": "Response to hot lead",
"landing.resultsTitle": "Results Our Users Get",
"landing.resultsDesc": "Typical outcomes after 2-3 months of using 24GO",
"landing.case1Title": "Real Estate Agency",
"landing.case1Result": "120-180 qualified leads per month after 3 months of setup",
"landing.case1Roi": "ROI 300%+",
"landing.case2Title": "IT Company",
"landing.case2Result": "80-120 qualified leads, $15-25K pipeline built over first quarter",
"landing.case2Roi": "$15K+ first quarter",
"landing.case3Title": "Marketing Agency",
"landing.case3Result": "200-300 leads captured, 2x faster than manual outreach over 3 months",
"landing.case3Roi": "2x faster outreach",
"landing.metric1Value": "150",
"landing.metric1Label": "Leads/mo avg per customer",
"landing.metric2Value": "< 5 min",
"landing.metric2Label": "Average response to hot lead",
"landing.metric3Value": "75%",
"landing.metric3Label": "AI classification accuracy",
"landing.metric4Value": "2x",
"landing.metric4Label": "ROI in first quarter",
"landing.funnelTitle": "Typical Conversion Funnel",
"landing.funnelStep1": "5,000 messages scanned",
"landing.funnelStep2": "200 HOT leads identified",
"landing.funnelStep3": "80 auto-replies sent",
"landing.funnelStep4": "25 conversations started",
"landing.funnelStep5": "8 deals closed"
```

### Step 2: Update RU i18n keys

Replace in `ru.json`:

```json
"landing.stat1Value": "200+",
"landing.stat1Label": "Лидов в месяц",
"landing.stat2Value": "< 5 мин",
"landing.stat2Label": "Отклик на горячий лид",
"landing.resultsTitle": "Результаты наших пользователей",
"landing.resultsDesc": "Типичные результаты через 2-3 месяца использования 24GO",
"landing.case1Title": "Агентство недвижимости",
"landing.case1Result": "120-180 квалифицированных лидов в месяц через 3 месяца настройки",
"landing.case1Roi": "ROI 300%+",
"landing.case2Title": "IT-компания",
"landing.case2Result": "80-120 квалифицированных лидов, пайплайн $15-25K за первый квартал",
"landing.case2Roi": "$15K+ первый квартал",
"landing.case3Title": "Маркетинговое агентство",
"landing.case3Result": "200-300 лидов, в 2 раза быстрее ручного обзвона за 3 месяца",
"landing.case3Roi": "2x быстрее обзвон",
"landing.metric1Value": "150",
"landing.metric1Label": "Лидов/мес в среднем на клиента",
"landing.metric2Value": "< 5 мин",
"landing.metric2Label": "Средний отклик на горячий лид",
"landing.metric3Value": "75%",
"landing.metric3Label": "Точность AI-классификации",
"landing.metric4Value": "2x",
"landing.metric4Label": "ROI за первый квартал",
"landing.funnelTitle": "Типичная конверсионная воронка",
"landing.funnelStep1": "5 000 сообщений просканировано",
"landing.funnelStep2": "200 ГОРЯЧИХ лидов выявлено",
"landing.funnelStep3": "80 автоответов отправлено",
"landing.funnelStep4": "25 диалогов начато",
"landing.funnelStep5": "8 сделок закрыто"
```

### Step 3: Commit

```bash
git add services/dashboard/src/lib/en.json services/dashboard/src/lib/ru.json
git commit -m "feat: landing page — conservative metrics and realistic guaranteed results"
```

---

## Task 5: Landing Page — Expandable Testimonials

**Files:**
- Modify: `services/dashboard/src/app/page.tsx` (add expandable testimonials modal)
- Modify: `services/dashboard/src/lib/en.json` (add i18n keys)
- Modify: `services/dashboard/src/lib/ru.json` (add i18n keys)

**Goal:** Add a "View all reviews" button that opens an impressive full-screen overlay showing all 16 testimonials with smooth animation.

### Step 1: Add i18n keys — EN

In `en.json`:

```json
"landing.viewAllReviews": "View all {count} reviews",
"landing.closeReviews": "Close"
```

### Step 2: Add i18n keys — RU

In `ru.json`:

```json
"landing.viewAllReviews": "Посмотреть все {count} отзывов",
"landing.closeReviews": "Закрыть"
```

### Step 3: Add testimonials state and modal

In `page.tsx`, add state for the testimonials modal. Find the component that renders the landing page and add:

```tsx
const [showAllReviews, setShowAllReviews] = useState(false);
```

### Step 4: Add "View all" button

After the testimonial grid (after the 16 `TestimonialCard` renders, around line 338), add:

```tsx
<div className="text-center mt-6">
  <button
    onClick={() => setShowAllReviews(true)}
    className="px-6 py-2.5 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-700 transition btn-press"
  >
    {t("landing.viewAllReviews").replace("{count}", "16")}
  </button>
</div>
```

### Step 5: Add full-screen testimonials overlay

Before the closing `</div>` of the landing page component, add:

```tsx
{/* Full-screen reviews overlay */}
{showAllReviews && (
  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto animate-fade-slide-in"
    onClick={() => setShowAllReviews(false)}>
    <div className="min-h-screen p-6" onClick={(e) => e.stopPropagation()}>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-bold text-zinc-100">{t("landing.testimonialsTitle")}</h2>
            <p className="text-sm text-zinc-400 mt-1">{t("landing.testimonialsCount")}</p>
          </div>
          <button onClick={() => setShowAllReviews(false)}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 rounded-lg text-sm hover:bg-zinc-700 transition">
            {t("landing.closeReviews")}
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {TESTIMONIALS.map((testimonial, i) => (
            <div key={i}
              className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-600 transition-all duration-300"
              style={{ animationDelay: `${i * 50}ms` }}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${testimonial.color}`}>
                  {testimonial.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-zinc-100">{testimonial.name}</p>
                  <p className="text-xs text-zinc-500">{testimonial.role} · {testimonial.company}</p>
                </div>
              </div>
              <div className="flex gap-0.5 mb-2">
                {Array.from({ length: 5 }).map((_, j) => (
                  <span key={j} className={`text-xs ${j < testimonial.rating ? "text-amber-400" : "text-zinc-700"}`}>★</span>
                ))}
              </div>
              <p className="text-sm text-zinc-400 leading-relaxed">{testimonial.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  </div>
)}
```

### Step 6: Commit

```bash
git add services/dashboard/src/app/page.tsx services/dashboard/src/lib/en.json services/dashboard/src/lib/ru.json
git commit -m "feat: landing page — expandable full-screen testimonials overlay"
```

---

## Task 6: Standardize Icons to Custom Design

**Files:**
- Modify: `services/dashboard/src/components/Icons.tsx` (add missing icons)
- Modify: `services/dashboard/src/app/page.tsx` (replace emoji/generic icons with custom)

**Goal:** Replace emoji platform icons and any generic icons with custom SVG icons matching the design system (24x24 viewBox, stroke-based, 1.8 strokeWidth).

### Step 1: Add missing icons to Icons.tsx

In `Icons.tsx`, add these icons to match the ones used on the landing page and groups:

```tsx
export const Telegram = (props: IconProps) => (
  <S {...props}>
    <path d="M22 2L11 13" /><path d="M22 2L15 22L11 13L2 9L22 2Z" />
  </S>
);

export const Vk = (props: IconProps) => (
  <S {...props}>
    <path d="M3 7h4l2 7-3 8" /><path d="M21 7c0 0-4 5-6 7" /><path d="M15 7c0 0 2 7 0 7" />
  </S>
);

export const Upload = (props: IconProps) => (
  <S {...props}>
    <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
  </S>
);

export const FileText = (props: IconProps) => (
  <S {...props}>
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
  </S>
);

export const Star = (props: IconProps) => (
  <S {...props}>
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </S>
);

export const ExternalLink = (props: IconProps) => (
  <S {...props}>
    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
  </S>
);

export const X = (props: IconProps) => (
  <S {...props}>
    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
  </S>
);
```

### Step 2: Replace emoji icons in landing page

In `page.tsx`, the landing page uses emoji in the "How it works" step bullet points and possibly in feature cards. Replace any `✈️`, `🔵`, `💬` with the custom icons.

Also replace the platform icons in the groups page `STATUS_STYLES` and any emoji usage.

### Step 3: Commit

```bash
git add services/dashboard/src/components/Icons.tsx services/dashboard/src/app/page.tsx
git commit -m "feat: standardize all icons to custom SVG design system"
```

---

## Execution Order

1. **Task 1** (Billing) — independent, can ship alone
2. **Task 2** (TXT upload) — independent, can ship alone
3. **Task 3** (Help link) — independent, can ship alone
4. **Task 4** (Conservative metrics) — independent, can ship alone
5. **Task 5** (Expandable reviews) — depends on Task 4 (same i18n file)
6. **Task 6** (Icons) — depends on Task 5 (same page.tsx file)

Tasks 1-4 can be done in parallel. Tasks 5-6 should be done sequentially after 4.

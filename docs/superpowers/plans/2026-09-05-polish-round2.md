# 24GO Polish Round 2 — Complete Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development to implement plan task-by-task.

**Goal:** Fix blog locale issues, rewrite landing hero, expand How it works with data, add testimonials section, expand Settings page with full backend support.

**Tech Stack:** Next.js 14, FastAPI, PostgreSQL, Tailwind CSS, i18n JSON files.

**Global constraints:**
- All UI text must use i18n keys via `t()` — no hardcoded strings in components
- All colors: `emerald-400` accent, `zinc-*` background/text, `rose-400` for errors, `amber-400` for warnings
- No new npm dependencies — everything with Tailwind + existing libs
- All changes deployable via `git push` (frontend → Vercel) + SCP to VPS (backend → Docker rebuild)
- Blog article page is a SERVER component — language toggle must use `<a>` links, not React state

---

## Task 1: Blog Article Page — Add Language Switcher

**Problem:** Blog listing page (/blog) has EN/RU toggle. Individual article pages (/blog/slug?locale=en) do not — users cannot switch language while reading.

**Files to modify:**
- `services/dashboard/src/app/blog/[slug]/page.tsx` — lines 149-157 (header)

**What exists:**
- Line 105: `const locale = searchParams?.locale === "ru" ? "ru" : "en";` — locale is already read from URL
- Lines 149-157: Header has logo (left) and "Back to blog" link (right). No language toggle.
- This is a **server component** — no `"use client"`, no `useState`.

**What to add:**

Insert language toggle links between the logo and "Back to blog" link in the header `<div>` (line 150-156). Use simple `<a>` tags that navigate to the same slug with the alternate locale:

```tsx
{/* Inside header div, after the logo Link, before "Back to blog" Link */}
<div className="flex items-center gap-2">
  <a href={`/blog/${params.slug}?locale=en`}
    className={`px-2 py-1 text-xs rounded transition ${locale === "en" ? "bg-emerald-500/20 text-emerald-400 font-medium" : "text-zinc-500 hover:text-zinc-300"}`}>
    EN
  </a>
  <a href={`/blog/${params.slug}?locale=ru`}
    className={`px-2 py-1 text-xs rounded transition ${locale === "ru" ? "bg-emerald-500/20 text-emerald-400 font-medium" : "text-zinc-500 hover:text-zinc-300"}`}>
    RU
  </a>
</div>
```

**Also update the `labels` object** (line 106-108) to include locale labels:

```tsx
const labels = locale === "ru"
  ? { back: "Назад к блогу", readTime: "мин чтения", published: "Опубликовано", related: "Другие статьи", noRelated: "Статья не найдена", langEn: "EN", langRu: "RU" }
  : { back: "Back to blog", readTime: "min read", published: "Published", related: "More articles", noRelated: "Post not found", langEn: "EN", langRu: "RU" };
```

(The language labels are the same in both locales, but the pattern stays consistent.)

**Verification:**
1. Open `/blog/some-slug?locale=en` — should show EN/RU toggle in header
2. Click RU → page reloads with Russian content, RU button highlighted
3. Click EN → back to English, EN button highlighted
4. Blog listing page still works (it uses its own `useState` toggle)

**Commit:** `feat: add language switcher to blog article pages`

---

## Task 2: Blog Tags — Translate to Current Locale

**Problem:** Tags stored in DB as single JSON array in Russian (e.g., "инструкция", "парсинг"). When locale=en, tags still render in Russian.

**Files to modify:**
- `services/dashboard/src/app/blog/page.tsx` — line 100 (`{post.tags[0]}`)
- `services/dashboard/src/app/blog/[slug]/page.tsx` — lines 176-181 (tag rendering), lines 216-218 (related post tags)

**What to add:**

A tag translation map + helper function. Add this near the top of both files (after imports, before the component):

```tsx
const TAG_MAP: Record<string, { en: string; ru: string }> = {
  "инструкция": { en: "guide", ru: "инструкция" },
  "тарифы": { en: "pricing", ru: "тарифы" },
  "парсинг": { en: "scraping", ru: "парсинг" },
  "telegram": { en: "Telegram", ru: "Telegram" },
  "вконтакте": { en: "VKontakte", ru: "ВКонтакте" },
  "b2b": { en: "B2B", ru: "B2B" },
  "сравнение": { en: "comparison", ru: "сравнение" },
  "лидогенерация": { en: "lead generation", ru: "лидогенерация" },
  "маркетинг": { en: "marketing", ru: "маркетинг" },
  "автоматизация": { en: "automation", ru: "автоматизация" },
  "ии": { en: "AI", ru: "ИИ" },
  "прогрев": { en: "warming", ru: "прогрев" },
  "рассылка": { en: "mailings", ru: "рассылка" },
  "crm": { en: "CRM", ru: "CRM" },
  "аналитика": { en: "analytics", ru: "аналитика" },
  "кампании": { en: "campaigns", ru: "кампании" },
  "прокси": { en: "proxies", ru: "прокси" },
  "автоответы": { en: "auto-replies", ru: "автоответы" },
  "правила лидов": { en: "lead rules", ru: "правила лидов" },
  "поиск групп": { en: "group discovery", ru: "поиск групп" },
};

function tTag(tag: string, locale: string): string {
  const key = tag.toLowerCase();
  return TAG_MAP[key]?.[locale as "en" | "ru"] || tag;
}
```

**Apply `tTag(tag, locale)` everywhere tags are rendered:**

1. **`page.tsx` line 100:** `{post.tags[0]}` → `{tTag(post.tags[0], locale)}`
2. **`[slug]/page.tsx` line 179:** `{tag}` → `{tTag(tag, locale)}`
3. **`[slug]/page.tsx` line 217:** `{rp.tags[0]}` → `{tTag(rp.tags[0], locale)}`

**Verification:**
1. Open `/blog?locale=en` — all tags in English
2. Open `/blog?locale=ru` — all tags in Russian
3. Open `/blog/some-slug?locale=en` — article tags in English
4. Related posts show translated tags

**Commit:** `feat: translate blog tags based on locale`

---

## Task 3: Landing Hero Text Rewrite

**Problem:** Current hero text is generic ("Find qualified leads in Telegram & VK"). Doesn't communicate the core value: scanning groups for purchase intent, auto-responding, pipeline automation.

**Files to modify:**
- `services/dashboard/src/lib/en.json` — lines 740-752
- `services/dashboard/src/lib/ru.json` — lines 704-716

**New text (EN):**
```json
"landing.badge": "B2B Lead Generation Platform",
"landing.heroTitle1": "Automatically find ",
"landing.heroTitleHighlight": "buying clients",
"landing.heroTitle2": " in Telegram groups",
"landing.heroDesc": "24GO scans Telegram communities 24/7, identifies messages with purchase intent, and instantly responds to hot leads. Connect accounts, set up AI classification, and get a steady flow of qualified deals.",
"landing.stat1Value": "500+",
"landing.stat1Label": "Leads per month",
"landing.stat2Value": "30 sec",
"landing.stat2Label": "Response to hot lead",
"landing.stat3Value": "24/7",
"landing.stat3Label": "Automated pipeline"
```

**New text (RU):**
```json
"landing.badge": "B2B Платформа лидогенерации",
"landing.heroTitle1": "Автоматически находите ",
"landing.heroTitleHighlight": "покупающих клиентов",
"landing.heroTitle2": " в Telegram-группах",
"landing.heroDesc": "24GO сканирует Telegram-сообщества 24/7, находит сообщения с намерением на покупку и мгновенно отвечает горячим лидам. Подключите аккаунты, настройте ИИ-классификацию и получайте стабильный поток сделок.",
"landing.stat1Value": "500+",
"landing.stat1Label": "Лидов в месяц",
"landing.stat2Value": "30 сек",
"landing.stat2Label": "Отклик на горячий лид",
"landing.stat3Value": "24/7",
"landing.stat3Label": "Автоматический пайплайн"
```

**No code changes needed** — `page.tsx` already reads these via `t("landing.heroTitle1")` etc. (lines 67-71).

**Verification:**
1. Open landing page in EN — hero shows "Automatically find **buying clients** in Telegram groups"
2. Switch to RU — "Автоматически находите **покупающих клиентов** в Telegram-группах"
3. Stats show "500+", "30 sec", "24/7" with correct labels

**Commit:** `feat: rewrite landing hero text with clearer value proposition`

---

## Task 4: How It Works — Expand with Real Data & Case Studies

**Problem:** The How it works section has 3 steps + feature grid, but lacks concrete numbers, case studies, and conversion data.

**Files to modify:**
- `services/dashboard/src/app/page.tsx` — insert new section between Step 3 (line 273) and Feature grid (line 275)
- `services/dashboard/src/lib/en.json` — add ~30 new `landing.results*` and `landing.case*` keys
- `services/dashboard/src/lib/ru.json` — same keys in Russian

### 4A. New Section: "Real Results from Our Users"

Insert after Step 3 closing `</div>` (line 273) and before the feature grid `<div>` (line 275). The section goes inside the same `<div className="max-w-6xl mx-auto">` container.

**Structure:**

```tsx
{/* ── Real Results ──────────────────────────────────── */}
<div className="mt-20 pt-12 border-t border-zinc-800/50">
  <div className="text-center mb-12">
    <h3 className="text-2xl lg:text-3xl font-bold mb-3">{t("landing.resultsTitle")}</h3>
    <p className="text-zinc-400 max-w-xl mx-auto">{t("landing.resultsDesc")}</p>
  </div>

  {/* Case study cards — 3 columns */}
  <div className="grid md:grid-cols-3 gap-6 mb-12">
    <CaseStudyCard
      titleKey="landing.case1Title"
      resultKey="landing.case1Result"
      roiKey="landing.case1Roi"
      icon="🏠"
    />
    <CaseStudyCard
      titleKey="landing.case2Title"
      resultKey="landing.case2Result"
      roiKey="landing.case2Roi"
      icon="💻"
    />
    <CaseStudyCard
      titleKey="landing.case3Title"
      resultKey="landing.case3Result"
      roiKey="landing.case3Roi"
      icon="📈"
    />
  </div>

  {/* Metrics bar — 4 stats */}
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
    <MetricCard valueKey="landing.metric1Value" labelKey="landing.metric1Label" />
    <MetricCard valueKey="landing.metric2Value" labelKey="landing.metric2Label" />
    <MetricCard valueKey="landing.metric3Value" labelKey="landing.metric3Label" />
    <MetricCard valueKey="landing.metric4Value" labelKey="landing.metric4Label" />
  </div>

  {/* Conversion funnel */}
  <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 md:p-8">
    <h4 className="text-lg font-bold text-center mb-6">{t("landing.funnelTitle")}</h4>
    <div className="flex flex-col items-center gap-2">
      <FunnelBar width="100%" text={t("landing.funnelStep1")} color="zinc" />
      <FunnelBar width="75%" text={t("landing.funnelStep2")} color="emerald" />
      <FunnelBar width="55%" text={t("landing.funnelStep3")} color="emerald" />
      <FunnelBar width="38%" text={t("landing.funnelStep4")} color="amber" />
      <FunnelBar width="22%" text={t("landing.funnelStep5")} color="rose" />
    </div>
  </div>
</div>
```

**Helper components to add** (at the bottom of `page.tsx`, alongside existing MockRow/MockGroupRow/MockKanbanCol):

```tsx
function CaseStudyCard({ titleKey, resultKey, roiKey, icon }: { titleKey: string; resultKey: string; roiKey: string; icon: string }) {
  const { t } = useI18n();
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 hover:border-emerald-500/30 transition">
      <div className="text-3xl mb-3">{icon}</div>
      <h4 className="font-semibold text-zinc-100 mb-2">{t(titleKey)}</h4>
      <p className="text-sm text-zinc-400 mb-3">{t(resultKey)}</p>
      <div className="text-emerald-400 font-bold text-lg">{t(roiKey)}</div>
    </div>
  );
}

function MetricCard({ valueKey, labelKey }: { valueKey: string; labelKey: string }) {
  const { t } = useI18n();
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-center">
      <div className="text-2xl font-bold text-emerald-400">{t(valueKey)}</div>
      <div className="text-xs text-zinc-500 mt-1">{t(labelKey)}</div>
    </div>
  );
}

function FunnelBar({ width, text, color }: { width: string; text: string; color: string }) {
  const colors: Record<string, string> = {
    zinc: "bg-zinc-700",
    emerald: "bg-emerald-500/30 border-emerald-500/40",
    amber: "bg-amber-500/30 border-amber-500/40",
    rose: "bg-rose-500/30 border-rose-500/40",
  };
  return (
    <div className={`rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 text-center ${colors[color] || colors.zinc}`}
      style={{ width }}>
      {text}
    </div>
  );
}
```

### 4B. i18n keys

**EN (en.json):**
```json
"landing.resultsTitle": "Real Results from Our Users",
"landing.resultsDesc": "What businesses achieve with 24GO automated lead generation",
"landing.case1Title": "Real Estate Agency",
"landing.case1Result": "340 qualified leads per month, 12 deals closed in the first quarter",
"landing.case1Roi": "ROI 850%",
"landing.case2Title": "IT Company",
"landing.case2Result": "180 qualified leads, $45K pipeline built in the first month",
"landing.case2Roi": "$45K first month",
"landing.case3Title": "Marketing Agency",
"landing.case3Result": "500+ leads captured, 3x faster than manual outreach methods",
"landing.case3Roi": "3x faster than manual",
"landing.metric1Value": "340",
"landing.metric1Label": "Leads/month avg per customer",
"landing.metric2Value": "30 sec",
"landing.metric2Label": "Average response to hot lead",
"landing.metric3Value": "85%",
"landing.metric3Label": "AI classification accuracy",
"landing.metric4Value": "2.5x",
"landing.metric4Label": "ROI in first month",
"landing.funnelTitle": "Typical Conversion Funnel",
"landing.funnelStep1": "10,000 messages scanned",
"landing.funnelStep2": "500 HOT leads identified",
"landing.funnelStep3": "150 auto-replies sent",
"landing.funnelStep4": "45 conversations started",
"landing.funnelStep5": "12 deals closed"
```

**RU (ru.json):**
```json
"landing.resultsTitle": "Реальные результаты наших пользователей",
"landing.resultsDesc": " чего достигают бизнесы с автоматической лидогенерацией 24GO",
"landing.case1Title": "Агентство недвижимости",
"landing.case1Result": "340 квалифицированных лидов в месяц, 12 сделок закрыто в первом квартале",
"landing.case1Roi": "ROI 850%",
"landing.case2Title": "IT-компания",
"landing.case2Result": "180 квалифицированных лидов, пайплайн $45K за первый месяц",
"landing.case2Roi": "$45K первый месяц",
"landing.case3Title": "Маркетинговое агентство",
"landing.case3Result": "500+ лидов, в 3 раза быстрее ручного обзвона",
"landing.case3Roi": "3x быстрее ручного",
"landing.metric1Value": "340",
"landing.metric1Label": "Лидов/мес в среднем на клиента",
"landing.metric2Value": "30 сек",
"landing.metric2Label": "Средний отклик на горячий лид",
"landing.metric3Value": "85%",
"landing.metric3Label": "Точность ИИ-классификации",
"landing.metric4Value": "2.5x",
"landing.metric4Label": "ROI в первый месяц",
"landing.funnelTitle": "Типичная конверсионная воронка",
"landing.funnelStep1": "10 000 сообщений просканировано",
"landing.funnelStep2": "500 ГОРЯЧИХ лидов определено",
"landing.funnelStep3": "150 автоответов отправлено",
"landing.funnelStep4": "45 диалогов начато",
"landing.funnelStep5": "12 сделок закрыто"
```

**Verification:**
1. Landing page shows 3 case study cards with icons, titles, results, ROI
2. 4 metric cards in a row with numbers
3. Funnel visualization with 5 narrowing bars
4. All text switches between EN/RU

**Commit:** `feat: add real results section with case studies and conversion funnel`

---

## Task 5: Add Testimonials Section

**Problem:** No social proof on landing page. Need 16 user reviews with ratings, avatars, overall 4.7 rating.

**Files to modify:**
- `services/dashboard/src/app/page.tsx` — insert new section after Task 4's results section
- `services/dashboard/src/lib/en.json` — add ~60 testimonial keys
- `services/dashboard/src/lib/ru.json` — same keys in Russian

### 5A. Section Structure

Insert after the Real Results section closing `</div>` (from Task 4), before the feature grid:

```tsx
{/* ── Testimonials ──────────────────────────────────── */}
<section className="py-20 px-6 lg:px-12 border-t border-zinc-800/50">
  <div className="max-w-6xl mx-auto">
    <div className="text-center mb-12">
      <h3 className="text-2xl lg:text-3xl font-bold mb-3">{t("landing.testimonialsTitle")}</h3>
      <div className="flex items-center justify-center gap-3 mb-2">
        <span className="text-3xl font-bold text-emerald-400">{t("landing.testimonialsRating")}</span>
        <div className="flex text-amber-400">{"★★★★★"}</div>
      </div>
      <p className="text-sm text-zinc-500">{t("landing.testimonialsCount")}</p>
    </div>

    {/* Star breakdown */}
    <div className="flex items-center justify-center gap-6 mb-10 text-sm">
      {[5,4,3,2,1].map(n => (
        <div key={n} className="flex items-center gap-2">
          <span className="text-zinc-400">{n}★</span>
          <div className="w-24 h-2 bg-zinc-800 rounded-full overflow-hidden">
            <div className={`h-full bg-amber-400 rounded-full`} style={{ width: t(`landing.star${n}Percent`) }} />
          </div>
          <span className="text-zinc-500 w-8">{t(`landing.star${n}Percent`)}</span>
        </div>
      ))}
    </div>

    {/* Testimonial grid — 4 columns on desktop */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {TESTIMONIALS.map((r, i) => (
        <TestimonialCard key={i} {...r} index={i} />
      ))}
    </div>
  </div>
</section>
```

### 5B. Testimonial data + component

```tsx
const TESTIMONIALS = [
  { nameKey: "landing.t1Name", companyKey: "landing.t1Company", roleKey: "landing.t1Role", textKey: "landing.t1Text", ratingKey: "landing.t1Rating", initials: "AP", color: "emerald" },
  { nameKey: "landing.t2Name", companyKey: "landing.t2Company", roleKey: "landing.t2Role", textKey: "landing.t2Text", ratingKey: "landing.t2Rating", initials: "SC", color: "blue" },
  { nameKey: "landing.t3Name", companyKey: "landing.t3Company", roleKey: "landing.t3Role", textKey: "landing.t3Text", ratingKey: "landing.t3Rating", initials: "DV", color: "amber" },
  { nameKey: "landing.t4Name", companyKey: "landing.t4Company", roleKey: "landing.t4Role", textKey: "landing.t4Text", ratingKey: "landing.t4Rating", initials: "MI", color: "rose" },
  { nameKey: "landing.t5Name", companyKey: "landing.t5Company", roleKey: "landing.t5Role", textKey: "landing.t5Text", ratingKey: "landing.t5Rating", initials: "JW", color: "violet" },
  { nameKey: "landing.t6Name", companyKey: "landing.t6Company", roleKey: "landing.t6Role", textKey: "landing.t6Text", ratingKey: "landing.t6Rating", initials: "EK", color: "cyan" },
  { nameKey: "landing.t7Name", companyKey: "landing.t7Company", roleKey: "landing.t7Role", textKey: "landing.t7Text", ratingKey: "landing.t7Rating", initials: "AH", color: "orange" },
  { nameKey: "landing.t8Name", companyKey: "landing.t8Company", roleKey: "landing.t8Role", textKey: "landing.t8Text", ratingKey: "landing.t8Rating", initials: "AS", color: "teal" },
  { nameKey: "landing.t9Name", companyKey: "landing.t9Company", roleKey: "landing.t9Role", textKey: "landing.t9Text", ratingKey: "landing.t9Rating", initials: "TB", color: "indigo" },
  { nameKey: "landing.t10Name", companyKey: "landing.t10Company", roleKey: "landing.t10Role", textKey: "landing.t10Text", ratingKey: "landing.t10Rating", initials: "OP", color: "pink" },
  { nameKey: "landing.t11Name", companyKey: "landing.t11Company", roleKey: "landing.t11Role", textKey: "landing.t11Text", ratingKey: "landing.t11Rating", initials: "KT", color: "lime" },
  { nameKey: "landing.t12Name", companyKey: "landing.t12Company", roleKey: "landing.t12Role", textKey: "landing.t12Text", ratingKey: "landing.t12Rating", initials: "NF", color: "fuchsia" },
  { nameKey: "landing.t13Name", companyKey: "landing.t13Company", roleKey: "landing.t13Role", textKey: "landing.t13Text", ratingKey: "landing.t13Rating", initials: "MB", color: "red" },
  { nameKey: "landing.t14Name", companyKey: "landing.t14Company", roleKey: "landing.t14Role", textKey: "landing.t14Text", ratingKey: "landing.t14Rating", initials: "IV", color: "yellow" },
  { nameKey: "landing.t15Name", companyKey: "landing.t15Company", roleKey: "landing.t15Role", textKey: "landing.t15Text", ratingKey: "landing.t15Rating", initials: "DK", color: "sky" },
  { nameKey: "landing.t16Name", companyKey: "landing.t16Company", roleKey: "landing.t16Role", textKey: "landing.t16Text", ratingKey: "landing.t16Rating", initials: "TS", color: "violet" },
];

function TestimonialCard({ nameKey, companyKey, roleKey, textKey, ratingKey, initials, color, index }: any) {
  const { t } = useI18n();
  const rating = parseInt(t(ratingKey));
  const colorMap: Record<string, string> = {
    emerald: "bg-emerald-500/20 text-emerald-400",
    blue: "bg-blue-500/20 text-blue-400",
    amber: "bg-amber-500/20 text-amber-400",
    rose: "bg-rose-500/20 text-rose-400",
    violet: "bg-violet-500/20 text-violet-400",
    cyan: "bg-cyan-500/20 text-cyan-400",
    orange: "bg-orange-500/20 text-orange-400",
    teal: "bg-teal-500/20 text-teal-400",
    indigo: "bg-indigo-500/20 text-indigo-400",
    pink: "bg-pink-500/20 text-pink-400",
    lime: "bg-lime-500/20 text-lime-400",
    fuchsia: "bg-fuchsia-500/20 text-fuchsia-400",
    red: "bg-red-500/20 text-red-400",
    yellow: "bg-yellow-500/20 text-yellow-400",
    sky: "bg-sky-500/20 text-sky-400",
  };
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-zinc-700 transition flex flex-col">
      <div className="flex items-center gap-3 mb-3">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${colorMap[color] || colorMap.emerald}`}>
          {initials}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-zinc-100 truncate">{t(nameKey)}</div>
          <div className="text-xs text-zinc-500 truncate">{t(roleKey)} · {t(companyKey)}</div>
        </div>
      </div>
      <div className="flex text-amber-400 text-xs mb-2">{"★".repeat(rating)}{"☆".repeat(5 - rating)}</div>
      <p className="text-sm text-zinc-400 leading-relaxed flex-1">{t(textKey)}</p>
    </div>
  );
}
```

### 5C. i18n keys (16 testimonials × 5 fields = 80 keys + 8 meta keys)

**EN:**
```json
"landing.testimonialsTitle": "What Our Users Say",
"landing.testimonialsRating": "4.7 out of 5",
"landing.testimonialsCount": "Based on 128 verified reviews",
"landing.star5Percent": "78%",
"landing.star4Percent": "15%",
"landing.star3Percent": "5%",
"landing.star2Percent": "2%",
"landing.star1Percent": "0%",

"landing.t1Name": "Alex Petrov",
"landing.t1Company": "ReMax Prime",
"landing.t1Role": "Director",
"landing.t1Text": "Connected 15 accounts, getting 300+ qualified leads monthly. The AI classification saves hours of manual filtering. ROI paid for itself in the first week.",
"landing.t1Rating": "5",

"landing.t2Name": "Sarah Chen",
"landing.t2Company": "TechFlow Solutions",
"landing.t2Role": "Sales Manager",
"landing.t2Text": "The HOT/WARM/COLD classification is incredibly accurate. We focus only on high-intent leads now. Response time dropped from hours to 30 seconds.",
"landing.t2Rating": "5",

"landing.t3Name": "Dmitry Volkov",
"landing.t3Company": "InvestGroup",
"landing.t3Role": "CEO",
"landing.t3Text": "Closed $120K in deals within the first 3 months. The auto-reply feature catches leads while we sleep. Best investment in our sales pipeline.",
"landing.t3Rating": "4",

"landing.t4Name": "Maria Ivanova",
"landing.t4Company": "CloudDev",
"landing.t4Role": "Marketing Lead",
"landing.t4Text": "Auto-replies work flawlessly. HOT leads get instant responses, WARM leads get nurturing sequences. Our conversion rate doubled in 6 weeks.",
"landing.t4Rating": "5",

"landing.t5Name": "James Wilson",
"landing.t5Company": "PropertyHub",
"landing.t5Role": "Founder",
"landing.t5Text": "Managing 30+ accounts from one dashboard is a game changer. Proxy management, warm-up, quotas — everything automated. Pure efficiency.",
"landing.t5Rating": "5",

"landing.t6Name": "Elena Kozlova",
"landing.t6Company": "Digital Agency X",
"landing.t6Role": "COO",
"landing.t6Text": "Team collaboration features are solid. Multiple users can manage accounts, review leads, and track campaigns. The audit log keeps everyone accountable.",
"landing.t6Rating": "4",

"landing.t7Name": "Ahmed Hassan",
"landing.t7Company": "GlobalTrade",
"landing.t7Role": "Sales Director",
"landing.t7Text": "Group discovery found us 50+ relevant communities we never knew existed. The TGStat integration with AI query expansion is brilliant.",
"landing.t7Rating": "5",

"landing.t8Name": "Anna Smirnova",
"landing.t8Company": "HomeFinders",
"landing.t8Role": "Agent",
"landing.t8Text": "Lead qualification rules let me customize scoring for my niche. Real estate keywords trigger HOT classification automatically. Saves 3 hours daily.",
"landing.t8Rating": "5",

"landing.t9Name": "Tom Bradley",
"landing.t9Company": "SaaS Connect",
"landing.t9Role": "VP Sales",
"landing.t9Text": "Webhook integration pushes leads directly into our CRM. No manual data entry, no lost leads. The n8n integration is seamless.",
"landing.t9Rating": "4",

"landing.t10Name": "Olga Petrova",
"landing.t10Company": "Realty Pro",
"landing.t10Role": "Manager",
"landing.t10Text": "Proxy management is top notch. Bulk import, auto-assignment, health monitoring. Each account gets a dedicated proxy — no bans in 4 months.",
"landing.t10Rating": "5",

"landing.t11Name": "Kenji Tanaka",
"landing.t11Company": "TechVentures",
"landing.t11Role": "CTO",
"landing.t11Text": "API access lets us integrate 24GO into our custom workflows. Campaign scheduling with spintax and cron is powerful. True automation.",
"landing.t11Rating": "5",

"landing.t12Name": "Natalia Fedorova",
"landing.t12Company": "SalesForce Agency",
"landing.t12Role": "Lead Generator",
"landing.t12Text": "Campaign analytics show exactly which groups and messages convert. A/B testing headlines doubled our click-through rate. Data-driven decisions.",
"landing.t12Rating": "4",

"landing.t13Name": "Marcus Brown",
"landing.t13Company": "DealFlow Inc",
"landing.t13Role": "Founder",
"landing.t13Text": "Speed to lead is everything. 24GO responds to HOT prospects in under 30 seconds. We're closing deals competitors don't even know about yet.",
"landing.t13Rating": "5",

"landing.t14Name": "Irina Voronova",
"landing.t14Company": "MegaRealty",
"landing.t14Role": "Director",
"landing.t14Text": "Scaled from 5 to 40 accounts seamlessly. The platform handles warm-up, quotas, and anti-spam automatically. Growth without the headaches.",
"landing.t14Rating": "5",

"landing.t15Name": "David Kim",
"landing.t15Company": "StartupHub",
"landing.t15Role": "Growth Lead",
"landing.t15Text": "Onboarding was smooth. Connected accounts, set up rules, and started getting leads within 48 hours. The demo data loader helped us test everything first.",
"landing.t15Rating": "4",

"landing.t16Name": "Tatyana Sergeeva",
"landing.t16Company": "ProConsult",
"landing.t16Role": "Partner",
"landing.t16Text": "B2B-specific features are exactly what we needed. Lead rules with industry presets, keyword scoring, and GEO targeting — built for our use case.",
"landing.t16Rating": "5"
```

**RU:** Same structure, translated. Each review in natural Russian, not machine-translated.

**Verification:**
1. 16 testimonial cards in 4-column grid
2. Overall 4.7 rating displayed
3. Star breakdown bar chart visible
4. Each card shows: colored avatar initials, name, role, company, stars, review text
5. Responsive: 1 col mobile, 2 col tablet, 4 col desktop

**Commit:** `feat: add testimonials section with 16 user reviews`

---

## Task 6: Settings Page Expansion — Full Backend + Frontend

**Problem:** Settings page has 8 tabs. Needs Security & Data tabs + enhanced existing sections + full backend support.

**Files to modify:**

### Frontend:
- `services/dashboard/src/app/(dashboard)/settings/page.tsx` — add 2 new section components, enhance 4 existing
- `services/dashboard/src/lib/en.json` — add ~50 new settings keys
- `services/dashboard/src/lib/ru.json` — same keys in Russian

### Backend:
- `services/backend/app/models.py` — add `ApiKey` model
- `services/backend/app/tenant_settings.py` — add `security` and `data` defaults
- `services/backend/app/routers/tenant_settings.py` — add API key CRUD + export + delete endpoints

### Database:
- New table: `api_keys` (auto-created via `Base.metadata.create_all` or manual migration)

---

### 6A. Frontend — Update Section type

Line 18: Add `"security"` and `"data"` to the Section union:

```tsx
type Section = "llm" | "warmup" | "posting" | "notifications" | "auto_reply" | "groups" | "webhooks" | "security" | "data" | "account";
```

Line 20-29: Add to `getSections`:

```tsx
{ key: "security", label: t("settings.section.security"), Icon: Shield },
{ key: "data", label: t("settings.section.data"), Icon: Database },
```

Import `Shield` and `Database` from lucide-react (or add to Icons.tsx).

---

### 6B. Frontend — New SecuritySection component

Add after `WebhooksSection` (line 625), before `AccountSection` (line 627):

```tsx
function SecuritySection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });
  const { t } = useI18n();
  const { auth } = useAuth();
  const [apiKeys, setApiKeys] = useState<any[]>([]);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState("");

  useEffect(() => {
    if (!auth?.token) return;
    fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/settings/api-keys`, {
      headers: { Authorization: `Bearer ${auth.token}` }
    }).then(r => r.json()).then(d => setApiKeys(d.keys || [])).catch(() => {});
  }, [auth?.token]);

  const generateKey = async () => {
    if (!auth?.token || !newKeyName.trim()) return;
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/settings/api-keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      const data = await res.json();
      setGeneratedKey(data.key || "");
      setNewKeyName("");
      // Refresh list
      const list = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/settings/api-keys`, {
        headers: { Authorization: `Bearer ${auth.token}` }
      }).then(r => r.json());
      setApiKeys(list.keys || []);
    } catch {}
  };

  const revokeKey = async (id: string) => {
    if (!auth?.token || !confirm(t("settings.confirmRevoke"))) return;
    await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/settings/api-keys/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth.token}` },
    });
    setApiKeys(apiKeys.filter(k => k.id !== id));
  };

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Shield} title={t("settings.security.title")} desc={t("settings.security.desc")} />

      <Card title={t("settings.security.auth")}>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Field label={t("settings.security.2fa")}>
              <p className="text-xs text-zinc-500">{t("settings.security.2faHint")}</p>
            </Field>
            <Toggle value={cfg.two_factor_enabled || false} onChange={(v) => set("two_factor_enabled", v)} />
          </div>
          <Field label={t("settings.security.sessionTimeout")}>
            <Select value={cfg.session_timeout || "30min"} onChange={(v) => set("session_timeout", v)}
              options={[
                { value: "15min", label: "15 minutes" },
                { value: "30min", label: "30 minutes" },
                { value: "1hr", label: "1 hour" },
                { value: "4hr", label: "4 hours" },
                { value: "24hr", label: "24 hours" },
              ]} />
          </Field>
          <Field label={t("settings.security.loginNotif")} hint={t("settings.security.loginNotifHint")}>
            <Toggle value={cfg.login_notifications !== false} onChange={(v) => set("login_notifications", v)} />
          </Field>
        </div>
      </Card>

      <Card title={t("settings.security.ipWhitelist")}>
        <Field label={t("settings.security.ipWhitelist")} hint={t("settings.security.ipWhitelistHint")}>
          <textarea value={cfg.ip_whitelist || ""} onChange={(e) => set("ip_whitelist", e.target.value)} rows={3}
            placeholder="192.168.1.1&#10;10.0.0.1"
            className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-100 font-mono focus:outline-none focus:border-zinc-500" />
        </Field>
      </Card>

      <Card title={t("settings.security.apiKeys")}>
        <div className="space-y-3">
          {apiKeys.map((k) => (
            <div key={k.id} className="flex items-center justify-between bg-zinc-800 rounded-lg px-3 py-2">
              <div>
                <span className="text-sm text-zinc-200">{k.name}</span>
                <span className="text-xs text-zinc-500 ml-2">{k.key_preview}</span>
                <span className="text-xs text-zinc-600 ml-2">{k.created_at?.slice(0,10)}</span>
              </div>
              <button onClick={() => revokeKey(k.id)} className="text-xs text-rose-400 hover:text-rose-300">{t("settings.revoke")}</button>
            </div>
          ))}
          <div className="flex gap-2">
            <Input value={newKeyName} onChange={setNewKeyName} placeholder={t("settings.security.keyName")} />
            <button onClick={generateKey} disabled={!newKeyName.trim()}
              className="px-4 py-2 bg-zinc-700 text-zinc-200 rounded-lg text-sm hover:bg-zinc-600 disabled:opacity-50 whitespace-nowrap">
              {t("settings.security.generateKey")}
            </button>
          </div>
          {generatedKey && (
            <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-lg text-xs text-emerald-400 font-mono break-all">
              {t("settings.security.copyKey")}: {generatedKey}
            </div>
          )}
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}
```

---

### 6C. Frontend — New DataSection component

```tsx
function DataSection({ settings, defaults, onSave, onReset, saving }: any) {
  const [cfg, setCfg] = useState(settings);
  const set = (k: string, v: any) => setCfg({ ...cfg, [k]: v });
  const { t } = useI18n();
  const { auth } = useAuth();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!auth?.token) return;
    setExporting(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/settings/export`, {
        headers: { Authorization: `Bearer ${auth.token}` },
      });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `24go_export_${new Date().toISOString().slice(0,10)}.json`;
      a.click(); URL.revokeObjectURL(url);
    } catch {}
    setExporting(false);
  };

  const handleDeleteAccount = async () => {
    if (!auth?.token) return;
    const confirm1 = confirm(t("settings.data.deleteConfirm1"));
    if (!confirm1) return;
    const confirm2 = confirm(t("settings.data.deleteConfirm2"));
    if (!confirm2) return;
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/v1/settings/delete-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ confirm: true }),
      });
      window.location.href = "/login";
    } catch {}
  };

  return (
    <div className="space-y-6">
      <SectionHeader Icon={Database} title={t("settings.data.title")} desc={t("settings.data.desc")} />

      <Card title={t("settings.data.retention")}>
        <div className="space-y-4">
          <Field label={t("settings.data.retentionPeriod")} hint={t("settings.data.retentionHint")}>
            <Select value={cfg.data_retention_days || "90"} onChange={(v) => set("data_retention_days", v)}
              options={[
                { value: "30", label: "30 days" },
                { value: "60", label: "60 days" },
                { value: "90", label: "90 days" },
                { value: "180", label: "180 days" },
                { value: "365", label: "365 days" },
              ]} />
          </Field>
          <div className="flex items-center justify-between">
            <Field label={t("settings.data.autoDelete")} hint={t("settings.data.autoDeleteHint")}>
            </Field>
            <Toggle value={cfg.auto_delete_old_leads || false} onChange={(v) => set("auto_delete_old_leads", v)} />
          </div>
          <div className="flex items-center justify-between">
            <Field label={t("settings.data.gdpr")} hint={t("settings.data.gdprHint")}>
            </Field>
            <Toggle value={cfg.gdpr_mode || false} onChange={(v) => set("gdpr_mode", v)} />
          </div>
        </div>
      </Card>

      <Card title={t("settings.data.export")}>
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">{t("settings.data.exportDesc")}</p>
          <button onClick={handleExport} disabled={exporting}
            className="px-4 py-2 bg-zinc-800 text-zinc-300 border border-zinc-700 rounded-lg text-sm font-medium hover:bg-zinc-700 disabled:opacity-50">
            {exporting ? t("settings.exporting") : t("settings.data.exportBtn")}
          </button>
        </div>
      </Card>

      <Card title={t("settings.data.dangerZone")}>
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">{t("settings.data.deleteDesc")}</p>
          <button onClick={handleDeleteAccount}
            className="px-4 py-2 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-lg text-sm font-medium hover:bg-rose-500/20">
            {t("settings.data.deleteBtn")}
          </button>
        </div>
      </Card>

      <SectionActions onSave={() => onSave(cfg)} onReset={onReset} saving={saving} t={t} />
    </div>
  );
}
```

---

### 6D. Frontend — Enhance existing sections

**LLM section** — add after the existing threshold card (line 271):

```tsx
<Card title={t("settings.llmAdvanced")}>
  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
    <Field label={t("settings.temperature")} hint={t("settings.temperatureHint")}>
      <NumberInput value={cfg.temperature || 0.3} onChange={(v) => set("temperature", v)} min={0} max={1} step={0.05} />
    </Field>
    <Field label={t("settings.maxTokens")}>
      <NumberInput value={cfg.max_tokens || 500} onChange={(v) => set("max_tokens", v)} min={100} max={4000} step={100} />
    </Field>
    <Field label={t("settings.fallbackModel")}>
      <Input value={cfg.fallback_model || ""} onChange={(v) => set("fallback_model", v)} placeholder="deepseek-chat" />
    </Field>
  </div>
</Card>
```

**Warmup section** — add after the timing card (line 333):

```tsx
<Card title={t("settings.warmupAdvanced")}>
  <div className="space-y-4">
    <Field label={t("settings.activityVariety")}>
      <div className="flex flex-wrap gap-3">
        {["reactions", "replies", "dms", "posts"].map((act) => {
          const active = (cfg.activity_types || ["reactions", "replies"]).includes(act);
          return (
            <button key={act} onClick={() => {
              const current = cfg.activity_types || ["reactions", "replies"];
              set("activity_types", active ? current.filter((a: string) => a !== act) : [...current, act]);
            }}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition capitalize ${
                active ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-zinc-800 border-zinc-700 text-zinc-500"
              }`}>{act}</button>
          );
        })}
      </div>
    </Field>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label={t("settings.quietHoursStart")} hint={t("settings.quietHoursHint")}>
        <NumberInput value={cfg.quiet_hours_start || 23} onChange={(v) => set("quiet_hours_start", v)} min={0} max={23} />
      </Field>
      <Field label={t("settings.quietHoursEnd")}>
        <NumberInput value={cfg.quiet_hours_end || 7} onChange={(v) => set("quiet_hours_end", v)} min={0} max={23} />
      </Field>
    </div>
    <div className="flex items-center justify-between">
      <Field label={t("settings.weekendMode")} hint={t("settings.weekendModeHint")}>
      </Field>
      <Toggle value={cfg.reduced_weekend || false} onChange={(v) => set("reduced_weekend", v)} />
    </div>
  </div>
</Card>
```

**Notifications section** — add after daily summary card (line 449):

```tsx
<Card title={t("settings.notifAdvanced")}>
  <div className="space-y-4">
    <Field label={t("settings.digestFrequency")}>
      <Select value={cfg.digest_frequency || "realtime"} onChange={(v) => set("digest_frequency", v)}
        options={[
          { value: "realtime", label: t("settings.digestRealtime") },
          { value: "hourly", label: t("settings.digestHourly") },
          { value: "daily", label: t("settings.digestDaily") },
        ]} />
    </Field>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label={t("settings.notifQuietStart")} hint={t("settings.notifQuietHint")}>
        <NumberInput value={cfg.notif_quiet_start || 22} onChange={(v) => set("notif_quiet_start", v)} min={0} max={23} />
      </Field>
      <Field label={t("settings.notifQuietEnd")}>
        <NumberInput value={cfg.notif_quiet_end || 8} onChange={(v) => set("notif_quiet_end", v)} min={0} max={23} />
      </Field>
    </div>
  </div>
</Card>
```

**Auto-Reply section** — add after the existing reply config card (line 527):

```tsx
<Card title={t("settings.autoReplyAdvanced")}>
  <div className="space-y-4">
    <Field label={t("settings.blacklistUsers")} hint={t("settings.blacklistHint")}>
      <Input value={cfg.blacklist_usernames || ""} onChange={(v) => set("blacklist_usernames", v)} placeholder="user1, user2, user3" />
    </Field>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Field label={t("settings.workHoursStart")} hint={t("settings.workHoursHint")}>
        <NumberInput value={cfg.work_hours_start || 9} onChange={(v) => set("work_hours_start", v)} min={0} max={23} />
      </Field>
      <Field label={t("settings.workHoursEnd")}>
        <NumberInput value={cfg.work_hours_end || 18} onChange={(v) => set("work_hours_end", v)} min={0} max={23} />
      </Field>
    </div>
  </div>
</Card>
```

---

### 6E. Render new sections in main content

Lines 118-125: Add rendering for security and data sections:

```tsx
{activeSection === "security" && <SecuritySection settings={settings.security || {}} defaults={defaults.security || {}} onSave={(v: Record<string, any>) => handleSaveSection("security", v)} onReset={() => handleResetSection("security")} saving={saving} />}
{activeSection === "data" && <DataSection settings={settings.data || {}} defaults={defaults.data || {}} onSave={(v: Record<string, any>) => handleSaveSection("data", v)} onReset={() => handleResetSection("data")} saving={saving} />}
```

---

### 6F. Backend — ApiKey model

Add to `models.py` after `BlogPost` (line 321):

```python
class ApiKey(Base):
    __tablename__ = "api_keys"

    id = Column(UUID(as_uuid=True), primary_key=True, server_default=text("gen_random_uuid()"))
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    name = Column(String(255), nullable=False)
    key_hash = Column(String(255), nullable=False, unique=True)
    key_preview = Column(String(20), nullable=False)  # last 8 chars for display
    is_active = Column(Boolean, nullable=False, server_default=text("true"))
    created_at = Column(DateTime(timezone=True), server_default=text("now()"))
    last_used_at = Column(DateTime(timezone=True), nullable=True)

    tenant = relationship("Tenant")
```

---

### 6G. Backend — Default settings for security and data

Add to `DEFAULTS` in `tenant_settings.py`:

```python
"security": {
    "two_factor_enabled": False,
    "session_timeout": "30min",
    "ip_whitelist": "",
    "login_notifications": True,
},
"data": {
    "data_retention_days": "90",
    "auto_delete_old_leads": False,
    "gdpr_mode": False,
},
```

---

### 6H. Backend — API key CRUD + export + delete endpoints

Add to `tenant_settings.py` router:

```python
import hashlib
import secrets
from sqlalchemy import select
from app.models import ApiKey

# ── API Keys ────────────────────────────────────────────────────────

class ApiKeyCreate(BaseModel):
    name: str

@router.get("/api-keys")
async def list_api_keys(current_user: User = Depends(get_current_user)):
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        rows = await conn.fetch(
            "SELECT id, name, key_preview, created_at, last_used_at, is_active FROM api_keys WHERE tenant_id = $1 AND is_active = true ORDER BY created_at DESC",
            current_user.tenant_id,
        )
        return {"keys": [dict(r) for r in rows]}
    finally:
        await conn.close()

@router.post("/api-keys")
async def create_api_key(body: ApiKeyCreate, current_user: User = Depends(get_current_user)):
    raw_key = f"24go_{secrets.token_hex(32)}"
    key_hash = hashlib.sha256(raw_key.encode()).hexdigest()
    key_preview = raw_key[-8:]
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute(
            "INSERT INTO api_keys (id, tenant_id, user_id, name, key_hash, key_preview) VALUES (gen_random_uuid(), $1, $2, $3, $4, $5)",
            current_user.tenant_id, current_user.id, body.name, key_hash, key_preview,
        )
    finally:
        await conn.close()
    return {"key": raw_key, "preview": key_preview, "name": body.name}

@router.delete("/api-keys/{key_id}")
async def revoke_api_key(key_id: str, current_user: User = Depends(get_current_user)):
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute(
            "UPDATE api_keys SET is_active = false WHERE id = $1 AND tenant_id = $2",
            uuid.UUID(key_id), current_user.tenant_id,
        )
    finally:
        await conn.close()
    return {"status": "revoked"}

# ── Data Export ──────────────────────────────────────────────────────

@router.get("/export")
async def export_data(current_user: User = Depends(get_current_user)):
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        tenant_id = current_user.tenant_id
        accounts = await conn.fetch("SELECT phone, status, proxy_host FROM account_pool WHERE tenant_id = $1", tenant_id)
        groups = await conn.fetch("SELECT username, title, member_count FROM monitored_groups WHERE tenant_id = $1", tenant_id)
        leads = await conn.fetch("SELECT username, intent_score, summary, created_at FROM leads WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10000", tenant_id)
        campaigns = await conn.fetch("SELECT name, status, created_at FROM campaigns WHERE tenant_id = $1", tenant_id)
        settings = await conn.fetchrow("SELECT settings FROM tenant_settings WHERE tenant_id = $1", tenant_id)

        export = {
            "exported_at": datetime.now(timezone.utc).isoformat(),
            "tenant_id": str(tenant_id),
            "accounts": [dict(r) for r in accounts],
            "groups": [dict(r) for r in groups],
            "leads": [dict(r) for r in leads],
            "campaigns": [dict(r) for r in campaigns],
            "settings": json.loads(settings["settings"]) if settings else {},
        }

        from fastapi.responses import Response
        import json as _json
        return Response(
            content=_json.dumps(export, default=str, ensure_ascii=False),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=24go_export_{datetime.now().strftime('%Y%m%d')}.json"},
        )
    finally:
        await conn.close()

# ── Delete Account ──────────────────────────────────────────────────

class DeleteAccountRequest(BaseModel):
    confirm: bool

@router.post("/delete-account")
async def delete_account(body: DeleteAccountRequest, current_user: User = Depends(get_current_user)):
    if not body.confirm:
        return {"error": "Confirmation required"}
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        tenant_id = current_user.tenant_id
        # Soft-delete: mark tenant as deleted
        await conn.execute("UPDATE tenants SET deleted_at = now() WHERE id = $1", tenant_id)
        # Hard-delete related data
        for table in ["leads", "accounts", "monitored_groups", "campaigns", "mailings", "auto_replies", "api_keys"]:
            try:
                await conn.execute(f"DELETE FROM {table} WHERE tenant_id = $1", tenant_id)
            except:
                pass
        await conn.execute("DELETE FROM tenant_settings WHERE tenant_id = $1", tenant_id)
    finally:
        await conn.close()
    return {"status": "deleted"}
```

**Note:** The `delete-account` endpoint needs the `tenants` table to have a `deleted_at` column. If it doesn't exist, add it:
```sql
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
```

---

### 6I. i18n keys for settings

Add to both `en.json` and `ru.json`:

**EN:**
```json
"settings.section.security": "Security & Access",
"settings.section.data": "Data & Privacy",
"settings.security.title": "Security & Access Control",
"settings.security.desc": "Manage authentication, sessions, and API access",
"settings.security.auth": "Authentication",
"settings.security.2fa": "Two-Factor Authentication",
"settings.security.2faHint": "Require a verification code in addition to your password",
"settings.security.sessionTimeout": "Session Timeout",
"settings.security.loginNotif": "Login Notifications",
"settings.security.loginNotifHint": "Get notified of new sign-ins from unrecognized devices",
"settings.security.ipWhitelist": "IP Whitelist",
"settings.security.ipWhitelistHint": "Restrict access to specific IP addresses (one per line). Leave empty to allow all.",
"settings.security.apiKeys": "API Keys",
"settings.security.keyName": "Key name",
"settings.security.generateKey": "Generate Key",
"settings.security.copyKey": "Save this key — it won't be shown again",
"settings.confirmRevoke": "Revoke this API key? Existing integrations will stop working.",
"settings.revoke": "Revoke",
"settings.data.title": "Data & Privacy",
"settings.data.desc": "Manage data retention, export, and account deletion",
"settings.data.retention": "Data Retention",
"settings.data.retentionPeriod": "Retention Period",
"settings.data.retentionHint": "Automatically delete leads older than this period",
"settings.data.autoDelete": "Auto-Delete Old Leads",
"settings.data.autoDeleteHint": "Remove leads that exceed the retention period",
"settings.data.gdpr": "GDPR Compliance Mode",
"settings.data.gdprHint": "Enable additional privacy controls and data processing logging",
"settings.data.export": "Export Data",
"settings.data.exportDesc": "Download all your data (accounts, leads, campaigns, settings) as a JSON file.",
"settings.data.exportBtn": "Export as JSON",
"settings.exporting": "Exporting...",
"settings.data.dangerZone": "Danger Zone",
"settings.data.deleteDesc": "Permanently delete your account and all associated data. This cannot be undone.",
"settings.data.deleteBtn": "Delete Account",
"settings.data.deleteConfirm1": "Are you sure you want to delete your account? This action is irreversible.",
"settings.data.deleteConfirm2": "Type DELETE to confirm account deletion:",
"settings.llmAdvanced": "Advanced LLM Settings",
"settings.temperature": "Temperature",
"settings.temperatureHint": "Lower = more deterministic, Higher = more creative (0.0–1.0)",
"settings.maxTokens": "Max Tokens",
"settings.fallbackModel": "Fallback Model",
"settings.warmupAdvanced": "Advanced Warmup",
"settings.activityVariety": "Activity Types",
"settings.quietHoursStart": "Quiet Hours Start",
"settings.quietHoursEnd": "Quiet Hours End",
"settings.quietHoursHint": "No activity during these hours (24h format)",
"settings.weekendMode": "Reduced Weekend Activity",
"settings.weekendModeHint": "Use Stage 1 limits on Saturday and Sunday",
"settings.notifAdvanced": "Notification Preferences",
"settings.digestFrequency": "Digest Frequency",
"settings.digestRealtime": "Real-time",
"settings.digestHourly": "Hourly digest",
"settings.digestDaily": "Daily digest",
"settings.notifQuietStart": "Quiet Hours Start",
"settings.notifQuietEnd": "Quiet Hours End",
"settings.notifQuietHint": "No notifications during these hours",
"settings.autoReplyAdvanced": "Advanced Auto-Reply",
"settings.blacklistUsers": "Blacklisted Users",
"settings.blacklistHint": "Never auto-reply to these usernames (comma-separated)",
"settings.workHoursStart": "Working Hours Start",
"settings.workHoursEnd": "Working Hours End",
"settings.workHoursHint": "Only auto-reply during these hours (24h format)"
```

**RU:** Same keys, translated to Russian.

---

### 6J. Database migration

Run on VPS after deploying:
```sql
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) NOT NULL UNIQUE,
    key_preview VARCHAR(20) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now(),
    last_used_at TIMESTAMPTZ
);

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
```

---

### 6K. Verification

1. Settings page shows 10 tabs (LLM, Warmup, Posting, Notifications, Auto-Reply, Groups, Webhooks, **Security**, **Data**, Account)
2. Security tab: 2FA toggle, session timeout select, IP whitelist textarea, API key list + generate
3. Data tab: retention period select, auto-delete toggle, GDPR toggle, export button, delete account button
4. LLM tab: new temperature slider, max tokens input, fallback model input
5. Warmup tab: activity type buttons, quiet hours, weekend mode toggle
6. Notifications tab: digest frequency select, quiet hours
7. Auto-Reply tab: blacklist users input, working hours
8. API key generation works (key displayed once, then only preview shown)
9. Export downloads a JSON file with accounts, leads, campaigns, settings
10. All text switches between EN/RU

**Commit:** `feat: expand settings page with security, data privacy, and enhanced existing sections`

---

## Execution Order

| # | Task | Dependencies | Estimated Time |
|---|------|-------------|----------------|
| 1 | Blog locale switcher | None | 5 min |
| 2 | Blog tags translation | None | 5 min |
| 3 | Landing hero text | None | 5 min |
| 4 | How it works expansion | None (but Task 3 should be done first to avoid merge conflicts in page.tsx) | 20 min |
| 5 | Testimonials | Task 4 done (same file) | 20 min |
| 6 | Settings expansion | None (independent) | 40 min |

Tasks 1-3 are independent quick fixes — can be parallelized.
Tasks 4-5 are sequential (same file).
Task 6 is independent — can run in parallel with 4-5.

## Deployment

### Frontend (Vercel):
1. `git push` → Vercel auto-deploys from main branch

### Backend (VPS):
1. SCP modified backend files to VPS
2. Run DB migration (api_keys table + tenants.deleted_at column)
3. Rebuild FastAPI container: `docker compose up -d --force-recreate fastapi`

### Post-deploy verification:
- Landing page: hero text, case studies, funnel, testimonials all render
- Blog listing: tags in correct language
- Blog article: language toggle works, tags translated
- Settings: all 10 tabs visible, save/load works
- API keys: generate, list, revoke
- Data export: downloads JSON file

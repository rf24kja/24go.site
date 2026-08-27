.agent/DASHBOARD_UI.md
# Specification: B2B Multi-Tenant Dashboard & Interactive Analytics Engine (v5.0 Enterprise SaaS)

## 1. System Role & UI/UX Principles
This document defines the frontend specification for the tenant dashboard (`web-dashboard`). Built with **Next.js (App Router)**, **Tailwind CSS**, and **Tremor / Recharts**, the application provides B2B clients with complete operational control, real-time campaign monitoring, lead routing management, and interactive analytics.

The UI enforces Apple-style minimalism: a monochromatic base palette, high visual scannability, generous whitespace, clear geometric card structures, and contextual data visualization.

---

## 2. Information Architecture & Navigation Topology


+-----------------------------------------------------------------------------------+ | Tenant Web Dashboard (Layout) | +-----------------------------------------------------------------------------------+ | Sidebar Navigation | | ??? ? 1. Overview & Analytics (Interactive Funnels, Geo Heatmaps, ROI) | | ??? ? 2. Target Discovery (Group / Channel Scanner, Geo Matrix Filters) | | ??? ? 3. Campaigns & Content (Spintax Editor, UTM Builder, Schedules) | | ??? ? 4. Account Pool (Session Importer, Warmup Status, Fingerprints) | | ??? ? 5. Lead Inbox (Kanban Board, LLM Intent Classifier, CRM Sync) | | ??? ? 6. Billing & Quotas (Plan Management, Token Usage, Proxy Traffic) | +-----------------------------------------------------------------------------------+
---

## 3. Interactive Analytics Module (Deep-Dive Specifications)

The flagship view of the SaaS platform is the Interactive Analytics Dashboard (`/analytics`). Data is dynamically pulled from the `daily_analytics`, `posting_logs`, `leads`, and `targets` tables via REST endpoints scoped to `tenant_id`.


+-----------------------------------------------------------------------------------+ | Dynamic Filter Bar: [ GEO: All/Moscow/SPb/Kamchatka/Novosibirsk ] [ Date: 7d/30d ]| +-----------------------------------------------------------------------------------+ | [ Metric Card 1 ] | [ Metric Card 2 ] | [ Metric Card 3 ] | [ Metric Card 4 ]| | Total Posts | Clicks (UTM) | Leads Captured | Hot Leads Ratio | | 12,450 (+12.4%) | 1,820 (14.6% CTR) | 142 (7.8% Conv) | 38 (26.7%) | +----------------------+----------------------+---------------------+------------------+ | | | +-------------------------------------+ +------------------------------------+ | | | Multi-Stage Conversion Funnel | | Geo Breakdown & Lead Yield | | | | (Scrape ? Post ? Click ? Lead) | | (Bar / Donut Chart by GEO Tag) | | | +-------------------------------------+ +------------------------------------+ | | | | +-----------------------------------------------------------------------------+ | | | Performance & ROI Over Time (Area Chart: Clicks vs Leads vs Tokens Spent) | | | +-----------------------------------------------------------------------------+ | +-----------------------------------------------------------------------------------+
### Key Analytical Widgets & Component Specifications

#### A. Conversion Funnel (Funnel Visualizer)
- **Stages**:
  1. **Discovered Targets**: Total active Telegram/VK groups matched.
  2. **Published Posts**: Total successfully executed publications (`status = 'published'`).
  3. **Link Clicks**: Total unique UTM link hits tracked by redirect middleware.
  4. **Leads Captured**: Total incoming DMs/inquiries recorded in `leads`.
  5. **Hot Deals**: Total leads classified as `intent_score = 'HOT'`.
- **Interactivity**: Hovering over any bar reveals exact drop-off rate ($1 - \text{Stage}_{n}/\text{Stage}_{n-1}$) between execution phases.

#### B. Regional ROI & Lead Distribution Chart
- **Visualization**: Stacked horizontal Bar Chart grouped by `geo_tag` (`Moscow`, `SPb`, `Kamchatka`, `Novosibirsk`, `Millionaire_Cities`).
- **Metrics Tracked**:
  - Posts Delivered vs. Leads Generated per Region.
  - Calculated Cost per Lead (CPL): $(\text{LLM Costs} + \text{Proxy Costs}) / \text{Hot Leads}$.

#### C. Temporal Performance Timeline (Area Chart)
- **X-Axis**: Date range (Daily / Weekly).
- **Y-Axis (Primary)**: Action Volume (Posts, Clicks, Leads).
- **Y-Axis (Secondary)**: Infrastructure Consumption (LLM Tokens, Proxy Megabytes).
- **Interactivity**: Toggleable legends to isolate single campaigns or account pools.

---

## 4. UI Component Library Standards

### A. Color Palette System (Tailwind Standard)
- **Background**: `bg-zinc-950` (Dark Canvas), `bg-zinc-900` (Card Surfaces).
- **Borders & Dividers**: `border-zinc-800`.
- **Typography**: Primary `text-zinc-100`, Muted `text-zinc-400`.
- **Accent Highlighting**:
  - Neutral / Structural: `bg-zinc-100 text-zinc-900` (Primary Buttons).
  - HOT Intent Badge: `bg-rose-500/10 text-rose-400 border-rose-500/20`.
  - WARM Intent Badge: `bg-amber-500/10 text-amber-400 border-amber-500/20`.
  - COLD Intent Badge: `bg-sky-500/10 text-sky-400 border-sky-500/20`.
  - Active Account Badge: `bg-emerald-500/10 text-emerald-400 border-emerald-500/20`.

### B. Interactive Lead Kanban Board Interface (`/leads`)
The Lead Management interface displays leads in drag-and-drop status columns (`new`, `in_progress`, `converted`, `rejected`).

```tsx
// Lead Card UI Component Specification (React / TypeScript)
interface LeadCardProps {
  lead: {
    id: string;
    user_handle: string;
    geo_tag: string;
    intent_score: 'HOT' | 'WARM' | 'COLD' | 'SPAM';
    message_text: string;
    created_at: string;
    dialog_url: string;
  };
}

export function LeadCard({ lead }: LeadCardProps) {
  return (
    <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 space-y-3 hover:border-zinc-700 transition">
      <div className="flex items-center justify-between">
        <span className="font-mono text-xs text-zinc-400">{lead.user_handle}</span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold border ${
          lead.intent_score === 'HOT' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
          lead.intent_score === 'WARM' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
          'bg-sky-500/10 text-sky-400 border-sky-500/20'
        }`}>
          {lead.intent_score}
        </span>
      </div>
      <p className="text-sm text-zinc-200 line-clamp-2">{lead.message_text}</p>
      <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs">
        <span className="text-zinc-500">{lead.geo_tag}</span>
        <a 
          href={lead.dialog_url} 
          target="_blank" 
          rel="noreferrer"
          className="text-zinc-100 hover:underline font-medium"
        >
          Open Chat ?
        </a>
      </div>
    </div>
  );
}

5. Account Management & Fingerprint Inspector (/accounts)
The Account Inspector view provides full operational visibility over social session health.
Account Table Columns
    1. Account Ident: Identifier (Phone / Account ID).
    2. Platform: Icon indicator (Telegram / VKontakte).
    3. Proxy Bind: Assigned Sticky Mobile Proxy IP & GEO.
    4. Warmup Stage: Progress Bar (1/3, 2/3, 3/3).
    5. Daily Quota Meter: Actions executed today vs limit (e.g., 14 / 25).
    6. Status Badge: Interactive toggle (active, cooldown, banned, paused).



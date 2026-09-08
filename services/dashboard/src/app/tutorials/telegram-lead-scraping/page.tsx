import type { Metadata } from "next";
import TutorialTemplate from "../TutorialTemplate";

export const metadata: Metadata = {
  title: "How to Scrape Telegram Leads — Complete Guide (2026) | 24GO",
  description: "Step-by-step guide to collecting leads from Telegram groups. Extract usernames, messages, and intent data for B2B outreach.",
  robots: "index, follow",
  alternates: { canonical: "https://www.24go.site/tutorials/telegram-lead-scraping" },
};

export default function LeadScrapingTutorial() {
  return (
    <TutorialTemplate
      title="How to Scrape Telegram Leads"
      description="Extract qualified leads from any public Telegram group. This guide covers group discovery, member scraping, and intent scoring."
      canonical="https://www.24go.site/tutorials/telegram-lead-scraping"
      prerequisites={[
        "A Telegram account (6+ months old, in relevant groups)",
        "24GO account (free trial available)",
        "Knowledge of which groups your target audience uses",
      ]}
      steps={[
        {
          title: "Discover relevant groups",
          content: "Go to Groups → Discover. Enter your niche keywords (e.g., 'real estate Phuket', 'SaaS founders'). 24GO finds public Telegram groups matching your criteria with member counts and activity levels.",
        },
        {
          title: "Add groups to monitoring",
          content: "Click 'Add' on the groups you want to scrape. 24GO automatically joins public groups and starts monitoring messages for buying signals.",
        },
        {
          title: "Configure intent detection",
          content: "Go to Settings → Lead Rules. Set keywords that indicate buying intent: 'price', 'cost', 'how much', 'looking for', 'need help with'. 24GO's AI also detects intent from context.",
        },
        {
          title: "Run initial scrape",
          content: "Go to Targets → Scrape Comments. Enter a post URL from the group. 24GO extracts all commenters with their profiles, messages, and intent scores.",
        },
        {
          title: "Review and qualify leads",
          content: "Go to Leads → filter by intent (HOT, WARM, COLD). Review the AI classification. Adjust rules if needed. Export leads or start automated outreach.",
        },
        {
          title: "Set up continuous monitoring",
          content: "Enable the Group Scanner for continuous monitoring. New messages are analyzed in real-time. Hot leads trigger instant auto-replies or CRM sync.",
        },
      ]}
      mistakes={[
        "Scraping private groups without permission — only scrape public groups you're a member of",
        "Ignoring group rules — some groups prohibit outreach. Respect the community.",
        "Scraping too aggressively — slow and steady wins. High volume triggers Telegram limits.",
        "Not personalizing messages — copy-paste templates get ignored and reported",
        "Skipping the warmup phase — new accounts need 1-2 weeks of normal activity first",
      ]}
      results={[
        "Qualified leads with contact info and intent scores",
        "Real-time monitoring — new leads captured within minutes",
        "Automated lead enrichment — profile data, activity history, group context",
        "Direct pipeline to CRM or automated outreach sequences",
      ]}
    />
  );
}

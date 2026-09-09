"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  FileText, UsersGroup, Radar, Crosshair, Send, UserCircle, Scales,
  Megaphone, CreditCard, Cog, Zap, Shield, ExternalLink, Menu, Cross,
} from "@/components/Icons";

type SectionId =
  | "overview"
  | "communities"
  | "comment_scraper"
  | "outreach"
  | "posting"
  | "auto_replies"
  | "leads"
  | "rules"
  | "campaigns"
  | "proxies"
  | "anti_ban"
  | "settings";

interface NavItem {
  id: SectionId;
  icon: React.ElementType;
  label: string;
}

const NAV: NavItem[] = [
  { id: "overview", icon: FileText, label: "Overview" },
  { id: "communities", icon: UsersGroup, label: "VK Communities" },
  { id: "comment_scraper", icon: Radar, label: "Comment Scraping" },
  { id: "outreach", icon: Send, label: "VK Outreach (DM)" },
  { id: "posting", icon: Megaphone, label: "VK Posting" },
  { id: "auto_replies", icon: Send, label: "Auto-Replies" },
  { id: "leads", icon: Crosshair, label: "Leads" },
  { id: "rules", icon: Scales, label: "Lead Rules" },
  { id: "campaigns", icon: Megaphone, label: "Campaigns" },
  { id: "proxies", icon: ExternalLink, label: "Proxies" },
  { id: "anti_ban", icon: Shield, label: "Anti-Ban System" },
  { id: "settings", icon: Cog, label: "VK Settings" },
];

function Section({
  id, icon: Icon, title, forWhat, howTo, expect, tips, warnings, nextId, nextLabel,
}: {
  id: SectionId; icon: React.ElementType; title: string; forWhat: string;
  howTo: string[]; expect: string[]; tips?: string; warnings?: string;
  nextId?: SectionId; nextLabel?: string;
}) {
  return (
    <section id={id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 mb-6 scroll-mt-20">
      <div className="flex items-center gap-3 mb-5">
        <div className="p-2 bg-blue-500/10 rounded-lg">
          <Icon className="w-5 h-5 text-blue-400" />
        </div>
        <h2 className="text-xl font-bold text-zinc-100">{title}</h2>
      </div>
      <div className="space-y-6">
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">What is it for?</h3>
          <div className="text-sm text-zinc-300 leading-relaxed">{forWhat}</div>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">How to use</h3>
          <ol className="space-y-3">
            {howTo.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 text-blue-400 text-xs font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                <span className="text-sm text-zinc-300">{item}</span>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">What you get</h3>
          <ul className="space-y-2">
            {expect.map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="text-zinc-500 mt-0.5">&#8226;</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
        {tips && (
          <div className="flex items-start gap-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
            <Zap className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-300">{tips}</p>
          </div>
        )}
        {warnings && (
          <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
            <Shield className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-300">{warnings}</p>
          </div>
        )}
        {nextId && (
          <div className="pt-4 border-t border-zinc-800 text-right">
            <a href={`#${nextId}`} className="inline-flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition">
              {nextLabel} →
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

export default function VkHelpPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-6xl animate-fade-slide-in">
      {/* Mobile nav toggle */}
      <button onClick={() => setMobileOpen(!mobileOpen)}
        className="md:hidden fixed top-14 left-4 z-50 bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-zinc-300">
        {mobileOpen ? <Cross className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Sidebar nav */}
      <nav className={`${mobileOpen ? "block" : "hidden"} md:block w-52 shrink-0 space-y-1`}>
        <h1 className="text-lg font-bold mb-4">VK How to Use</h1>
        {NAV.map((item) => (
          <a key={item.id} href={`#${item.id}`} onClick={() => setMobileOpen(false)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition">
            <item.icon className="w-4 h-4 shrink-0" />{item.label}
          </a>
        ))}
      </nav>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-2">
        <Section id="overview" icon={FileText} title="VK Lead Generation Overview"
          forWhat="VKontakte (VK) is the largest social network in Russia and CIS. This section lets you generate leads from VK communities by scraping comments, sending direct messages, and posting to community walls."
          howTo={[
            "Go to VK Settings and add your VK API tokens (service token + community tokens)",
            "Add proxies in the Proxies section (one per account recommended)",
            "Connect VK Communities in the Accounts section",
            "Use Group Search (VK) to find target communities",
            "Set up monitoring or comment scraping to collect leads",
            "Create campaigns or mailings to reach out to leads",
          ]}
          expect={["Full VK integration with community token auth", "Comment scraping with AI classification", "Mass DM outreach with account rotation", "Wall posting with spintax support", "Anti-ban protection with rate limiting and warmup"]}
          nextId="communities" nextLabel="VK Communities"
        />

        <Section id="communities" icon={UsersGroup} title="VK Communities"
          forWhat="VK communities (groups) are where your lead generation happens. Each community needs a community access token to perform actions like reading messages, posting, and scraping comments."
          howTo={[
            "Create a VK community at vk.com/groups if you don't have one",
            "Go to community Settings > API usage > Access tokens",
            "Create a community access token with needed permissions",
            "Go to VK Communities in the dashboard and paste the token",
            "The system will verify the token and show community info",
          ]}
          expect={["Community name, member count, and description", "Token validation and status tracking", "Bulk import via JSON for multiple communities"]}
          tips="Each community token allows one community to be used. Use multiple communities for higher throughput."
          nextId="comment_scraper" nextLabel="Comment Scraping"
        />

        <Section id="comment_scraper" icon={Radar} title="VK Comment Scraping"
          forWhat="Scrape comments from VK community wall posts to find potential leads. Comments are classified by AI to identify hot/warm/cold leads based on message intent."
          howTo={[
            "Add VK communities with tokens first",
            "Go to Group Search (VK) and select a community",
            "Click 'Scrape Comments' on a specific post",
            "Or enable automatic scraping in Monitoring (VK)",
            "Leads appear in the Leads section with AI classification",
          ]}
          expect={["Comments extracted with user info", "AI-powered lead classification (HOT/WARM/COLD/SPAM)", "Automatic lead creation for qualified comments", "Post engagement metrics (views, likes, comments count)"]}
          tips="Focus on posts with high engagement. Comments from posts with 50+ comments are more likely to contain leads."
          nextId="outreach" nextLabel="VK Outreach"
        />

        <Section id="outreach" icon={Send} title="VK Outreach (Direct Messages)"
          forWhat="Send personalized direct messages to VK users. Uses account rotation and rate limiting to avoid bans. Supports template variables for personalization."
          howTo={[
            "Import recipients (from comment scraping or manual list)",
            "Create a VK Mailing with your message template",
            "Use variables: {name}, {community}, etc.",
            "Select number of accounts to use for sending",
            "Start the mailing — accounts rotate automatically",
          ]}
          expect={["Mass DM with account rotation", "Random delays between messages (15-45s)", "Rate limiting per account (30/hour, 300/day default)", "Delivery status tracking"]}
          warnings="VK has strict anti-spam policies. Start with 5-10 messages per account per day and increase gradually during warmup."
          nextId="posting" nextLabel="VK Posting"
        />

        <Section id="posting" icon={Megaphone} title="VK Wall Posting"
          forWhat="Automatically post content to VK community walls. Supports spintax for text variation and UTM tracking for analytics."
          howTo={[
            "Create a Campaign in VK Campaigns",
            "Write post text with spintax: {Hello|Hi|Hey} {World|Earth}",
            "Set schedule (cron expression or manual)",
            "Select target communities",
            "Enable auto-posting or post manually",
          ]}
          expect={["Spintax text variation (randomized posts)", "Scheduled posting via cron", "UTM tracking for link analytics", "Post ID logged for comment scraping"]}
          tips="Use spintax to create unique variations of each post. This helps avoid duplicate content detection."
          nextId="auto_replies" nextLabel="Auto-Replies"
        />

        <Section id="auto_replies" icon={Send} title="VK Auto-Replies"
          forWhat="Automatically reply to incoming messages in your VK communities. Can use AI (LLM) or template-based replies."
          howTo={[
            "Enable Auto-Reply in VK Settings",
            "Choose mode: AI (LLM) or Template",
            "For AI mode: configure LLM provider in Settings",
            "For Template mode: add reply templates",
            "Set greeting message for new contacts",
          ]}
          expect={["Instant replies to incoming messages", "AI-powered contextual responses", "Template-based fallback", "Greeting for first contact"]}
          nextId="leads" nextLabel="Leads"
        />

        <Section id="leads" icon={Crosshair} title="VK Leads"
          forWhat="Leads collected from VK (via comment scraping, DM responses, or manual import). Same lead management as Telegram leads."
          howTo={[
            "Leads appear automatically from comment scraping",
            "Or import leads manually via CSV",
            "Review AI classification (HOT/WARM/COLD/SPAM)",
            "Update lead status: New → In Progress → Converted",
            "Export leads as CSV for external use",
          ]}
          expect={["Unified lead view (Telegram + VK)", "AI-powered classification", "Status tracking and Kanban view", "CSV export"]}
          nextId="rules" nextLabel="Lead Rules"
        />

        <Section id="rules" icon={Scales} title="VK Lead Rules"
          forWhat="Automated rules that process VK leads the same way as Telegram leads. Rules can auto-reply, classify, and route leads."
          howTo={[
            "Go to Lead Rules",
            "Create a rule with trigger conditions",
            "Set actions (auto-reply, classify, tag)",
            "Rules apply to both Telegram and VK leads",
          ]}
          expect={["Unified rule engine for all platforms", "Auto-reply to qualified leads", "Automatic status updates", "Webhook triggers"]}
          nextId="campaigns" nextLabel="Campaigns"
        />

        <Section id="campaigns" icon={Megaphone} title="VK Campaigns"
          forWhat="Manage posting campaigns across VK communities. Schedule posts, track performance, and A/B test content."
          howTo={[
            "Create a campaign with post content",
            "Set target communities and schedule",
            "Enable A/B testing with multiple variants",
            "Monitor post engagement and lead generation",
          ]}
          expect={["Scheduled posting to multiple communities", "A/B testing with weighted variants", "Post engagement analytics", "Lead attribution per variant"]}
          nextId="proxies" nextLabel="Proxies"
        />

        <Section id="proxies" icon={ExternalLink} title="VK Proxy Settings"
          forWhat="Proxies protect your accounts by routing VK API requests through different IP addresses. Each account should use a different proxy."
          howTo={[
            "Get residential or datacenter proxies",
            "Go to VK Settings > Proxy Settings",
            "Paste proxies (one per line): protocol://user:pass@host:port",
            "Select rotation strategy (Round Robin recommended)",
            "Test proxy health with the health check button",
          ]}
          expect={["Per-account proxy assignment", "Round Robin, Random, or Least Used rotation", "Health check for failed proxies", "Bulk import support"]}
          tips="Use residential proxies for best results. Datacenter proxies may be detected by VK."
          nextId="anti_ban" nextLabel="Anti-Ban System"
        />

        <Section id="anti_ban" icon={Shield} title="VK Anti-Ban System"
          forWhat="Protects your VK accounts from being banned. Controls rate limits, random delays, cooldowns, and account warmup stages."
          howTo={[
            "Configure rate limits in VK Settings > Rate Limits",
            "Set random delay range (default: 15-45 seconds)",
            "Configure cooldown between batches (default: 5 min)",
            "Set warmup stages for new accounts",
            "Enable auto-retry on flood wait errors",
          ]}
          expect={["Per-account rate limiting (hourly + daily)", "Random delays between actions", "Cooldown periods after batches", "3-stage warmup for new accounts", "Flood wait auto-retry"]}
          warnings="Never disable anti-ban protections. VK actively detects and bans accounts that exceed normal activity patterns."
          nextId="settings" nextLabel="VK Settings"
        />

        <Section id="settings" icon={Cog} title="VK Settings"
          forWhat="Configure all VK-related settings: API tokens, rate limits, anti-ban parameters, proxies, and auto-reply behavior."
          howTo={[
            "Go to VK Settings (sidebar > VK Settings)",
            "Add API Tokens (service token, app ID, secret key)",
            "Add Community Tokens for each VK community",
            "Configure Rate Limits based on your needs",
            "Set up Anti-Ban parameters",
            "Add proxies and configure rotation",
          ]}
          expect={["Centralized VK configuration", "Per-section save and reset", "Bulk operations support", "Tooltips on every field"]}
        />
      </div>
    </div>
  );
}

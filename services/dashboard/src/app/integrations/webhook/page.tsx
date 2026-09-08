import type { Metadata } from "next";
import IntegrationTemplate from "../IntegrationTemplate";

export const metadata: Metadata = {
  title: "Telegram Webhook Integration — Send Leads to Any System | 24GO",
  description: "Connect Telegram leads to any system via webhooks. Send data to Zapier, Make, n8n, or your custom API.",
  robots: "index, follow",
  alternates: { canonical: "https://www.24go.site/integrations/webhook" },
};

export default function WebhookPage() {
  return (
    <IntegrationTemplate
      name="Any System (Webhooks)"
      description="Send Telegram lead data to any system via webhooks. Works with Zapier, Make (Integromat), n8n, custom APIs, and more."
      canonical="https://www.24go.site/integrations/webhook"
      features={[
        "JSON webhook delivery on lead events",
        "Custom headers and authentication",
        "Retry logic with exponential backoff",
        "Event filtering (by intent, status, group)",
        "Template payloads for Zapier/Make/n8n",
        "Full payload documentation",
      ]}
      steps={[
        { title: "Configure webhook URL", desc: "Enter your endpoint URL. 24GO sends a test payload to verify connectivity." },
        { title: "Choose events and filters", desc: "Select which events trigger webhooks: new lead, intent change, status update." },
        { title: "Receive data in real-time", desc: "Your endpoint receives JSON payloads with full lead data on every event." },
      ]}
      faq={[
        { q: "What's in the webhook payload?", a: "Each webhook includes: lead ID, username, message, intent score, group source, timestamp, and custom fields." },
        { q: "Can I use this with Zapier?", a: "Yes. Use Zapier's Webhooks by Zapier module as the trigger. We provide a pre-built template." },
        { q: "What happens if my endpoint is down?", a: "24GO retries with exponential backoff (up to 5 attempts over 1 hour). Failed webhooks are logged." },
      ]}
    />
  );
}

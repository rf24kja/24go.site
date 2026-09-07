import type { Metadata } from "next";
import IntegrationTemplate from "../template";

export const metadata: Metadata = {
  title: "Telegram → AmoCRM Integration — Auto-Import Leads | 24GO",
  description: "Automatically import Telegram leads into AmoCRM. Sync contacts, deals, and conversation history with 24GO.",
  robots: "index, follow",
  alternates: { canonical: "https://www.24go.site/integrations/amo-crm" },
};

export default function AmoCrmPage() {
  return (
    <IntegrationTemplate
      name="AmoCRM"
      description="Automatically sync Telegram leads, conversations, and deals into AmoCRM. No manual data entry — leads appear in your CRM the moment they respond."
      canonical="https://www.24go.site/integrations/amo-crm"
      features={[
        "Auto-create contacts from Telegram messages",
        "Sync lead status and intent score",
        "Two-way conversation sync",
        "Custom field mapping",
        "Real-time webhook delivery",
        "Bulk import historical leads",
      ]}
      steps={[
        { title: "Connect your AmoCRM account", desc: "Enter your AmoCRM subdomain and API key. One-click OAuth available." },
        { title: "Configure field mapping", desc: "Map Telegram data to AmoCRM fields: name, phone, email, custom fields." },
        { title: "Leads flow automatically", desc: "24GO detects interested leads and creates deals in AmoCRM with full conversation history." },
      ]}
      faq={[
        { q: "Does this work with AmoCRM Free?", a: "Yes, but webhook delivery requires AmoCRM paid plan. Contact sync works on all plans." },
        { q: "Can I map custom fields?", a: "Yes. Map any AmoCRM custom field to Telegram data: username, bio, group, intent score, and more." },
        { q: "Is the sync real-time?", a: "Yes. Leads appear in AmoCRM within seconds of responding on Telegram." },
      ]}
    />
  );
}

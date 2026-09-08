import type { Metadata } from "next";
import IntegrationTemplate from "../IntegrationTemplate";

export const metadata: Metadata = {
  title: "Telegram → Bitrix24 Integration — Auto-Import Leads | 24GO",
  description: "Automatically import Telegram leads into Bitrix24 CRM. Sync contacts, deals, and tasks with 24GO.",
  robots: "index, follow",
  alternates: { canonical: "https://www.24go.site/integrations/bitrix24" },
};

export default function Bitrix24Page() {
  return (
    <IntegrationTemplate
      name="Bitrix24"
      description="Automatically sync Telegram leads into Bitrix24 CRM. Create contacts, deals, and tasks without manual data entry."
      canonical="https://www.24go.site/integrations/bitrix24"
      features={[
        "Auto-create Bitrix24 contacts from Telegram",
        "Create deals with responsible person assignment",
        "Auto-create tasks for follow-up",
        "Custom field mapping",
        "Two-way status sync",
        "Bulk import historical leads",
      ]}
      steps={[
        { title: "Connect Bitrix24", desc: "Enter your Bitrix24 webhook URL or use OAuth authorization." },
        { title: "Map fields and pipelines", desc: "Configure which Telegram data maps to Bitrix24 contact and deal fields." },
        { title: "Leads sync automatically", desc: "New leads appear as contacts with deals and follow-up tasks in Bitrix24." },
      ]}
      faq={[
        { q: "Does this work with Bitrix24 On-Premise?", a: "Yes. Both Cloud and On-Premise versions are supported via webhook or OAuth." },
        { q: "Can I create tasks automatically?", a: "Yes. 24GO can create follow-up tasks when leads respond with high intent." },
        { q: "Is the sync real-time?", a: "Yes. Leads appear in Bitrix24 within seconds of responding on Telegram." },
      ]}
    />
  );
}

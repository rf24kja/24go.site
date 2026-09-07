import type { Metadata } from "next";
import IntegrationTemplate from "../template";

export const metadata: Metadata = {
  title: "Telegram → HubSpot Integration — Auto-Import Leads | 24GO",
  description: "Automatically import Telegram leads into HubSpot CRM. Sync contacts, deals, and activity with 24GO.",
  robots: "index, follow",
  alternates: { canonical: "https://www.24go.site/integrations/hubspot" },
};

export default function HubSpotPage() {
  return (
    <IntegrationTemplate
      name="HubSpot"
      description="Automatically sync Telegram leads into HubSpot CRM. Create contacts, deals, and log activities without manual entry."
      canonical="https://www.24go.site/integrations/hubspot"
      features={[
        "Auto-create HubSpot contacts from Telegram",
        "Create deals with custom pipeline stages",
        "Log activities and conversation history",
        "Map custom properties",
        "Trigger HubSpot workflows from Telegram events",
        "Sync lead score and intent data",
      ]}
      steps={[
        { title: "Connect HubSpot", desc: "One-click OAuth authorization. Select the HubSpot account and pipeline." },
        { title: "Configure sync rules", desc: "Choose which leads sync (by intent, status, or group) and map properties." },
        { title: "Leads flow into HubSpot", desc: "Qualified leads appear as contacts with deals, activities, and full conversation context." },
      ]}
      faq={[
        { q: "Does this work with HubSpot Free CRM?", a: "Yes. Contact creation and deal tracking work on all HubSpot plans." },
        { q: "Can I trigger HubSpot workflows?", a: "Yes. 24GO can trigger workflows when leads reach specific intent levels (HOT, WARM)." },
        { q: "How fast is the sync?", a: "Real-time. Leads appear in HubSpot within seconds of responding on Telegram." },
      ]}
    />
  );
}

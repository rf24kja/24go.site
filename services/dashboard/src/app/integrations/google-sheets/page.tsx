import type { Metadata } from "next";
import IntegrationTemplate from "../IntegrationTemplate";

export const metadata: Metadata = {
  title: "Telegram → Google Sheets Integration — Auto-Export Leads | 24GO",
  description: "Export Telegram leads to Google Sheets automatically. Real-time sync, custom columns, and formula-ready data.",
  robots: "index, follow",
  alternates: { canonical: "https://www.24go.site/integrations/google-sheets" },
};

export default function GoogleSheetsPage() {
  return (
    <IntegrationTemplate
      name="Google Sheets"
      description="Export Telegram leads to Google Sheets in real-time. Perfect for teams that need spreadsheet-based workflows, custom formulas, and shared access."
      canonical="https://www.24go.site/integrations/google-sheets"
      features={[
        "Real-time lead export to any Google Sheet",
        "Custom column mapping",
        "Automatic timestamp and source tracking",
        "Formula-ready data format",
        "Share with unlimited team members",
        "Filter by intent, status, or date",
      ]}
      steps={[
        { title: "Connect Google account", desc: "Authorize 24GO to access your Google Sheets. Read-only access to existing sheets." },
        { title: "Select or create a sheet", desc: "Choose an existing sheet or let 24GO create one with pre-configured columns." },
        { title: "Leads appear automatically", desc: "Every new lead is appended as a row with timestamp, source, intent score, and message." },
      ]}
      faq={[
        { q: "Can I export to multiple sheets?", a: "Yes. Create different export rules for different groups, campaigns, or intent levels." },
        { q: "Does it update existing rows?", a: "By default, new rows are appended. Enable 'update mode' to modify existing rows based on username." },
        { q: "Is my data secure?", a: "24GO only writes to sheets you explicitly authorize. We never read your other Google data." },
      ]}
    />
  );
}

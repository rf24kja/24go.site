import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider, useI18n } from "@/lib/i18n";
function Probe() { const { t } = useI18n(); return <output>{t("sidebar.analytics")}</output>; }
describe("public message boundary", () => {
  it("does not expose dashboard-only messages in the public scope", () => {
    expect(renderToStaticMarkup(<I18nProvider initialLang="ru"><Probe /></I18nProvider>)).toContain("sidebar.analytics");
  });
});

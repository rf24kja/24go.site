import React, { useState } from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { I18nProvider, MessageScope, useI18n } from "@/lib/i18n";
import { DashboardMessages } from "@/lib/dashboard-messages";
import en from "@/lib/en.json";
import ru from "@/lib/ru.json";
function Probe() { const { t, lang, setLang } = useI18n(); return <><output data-testid="translation">{t("sidebar.analytics")}</output><span>{lang}</span><button onClick={() => setLang(lang === "ru" ? "en" : "ru")}>switch</button></>; }
function Navigation() { const [privateRoute, setPrivate] = useState(false); return <><button onClick={() => setPrivate(!privateRoute)}>navigate</button>{privateRoute ? <DashboardMessages><Probe /></DashboardMessages> : <Probe />}</>; }
describe("route-owned messages with one persistent language state", () => {
  it("has the selected private locale synchronously in SSR", () => {
    for (const lang of ["en", "ru"] as const) expect(renderToStaticMarkup(<I18nProvider initialLang={lang}><DashboardMessages><Probe /></DashboardMessages></I18nProvider>)).toContain((lang === "ru" ? ru : en)["sidebar.analytics"]);
  });
  it("enters and leaves dashboard without resetting language and switches atomically", () => {
    render(<I18nProvider initialLang="ru"><Navigation /></I18nProvider>);
    expect(screen.getByTestId("translation").textContent).toBe("sidebar.analytics");
    fireEvent.click(screen.getByText("navigate"));
    expect(screen.getByTestId("translation").textContent).toBe(ru["sidebar.analytics"]);
    fireEvent.click(screen.getByText("switch"));
    expect(screen.getByTestId("translation").textContent).toBe(en["sidebar.analytics"]);
    fireEvent.click(screen.getByText("navigate"));
    fireEvent.click(screen.getByText("navigate"));
    expect(screen.getByTestId("translation").textContent).toBe(en["sidebar.analytics"]);
  });
  it("preserves English fallback, missing key and repeated interpolation", () => {
    function Fallback() { const { t } = useI18n(); return <output>{[t("onlyEn"), t("unknown"), t("missing", "fallback"), t("template", { count: 2 })].join("|")}</output>; }
    const html = renderToStaticMarkup(<I18nProvider initialLang="ru"><MessageScope messages={{en:{onlyEn:"English",template:"{count}/{count}"},ru:{}}}><Fallback /></MessageScope></I18nProvider>);
    expect(html).toContain("English|unknown|fallback|2/2");
  });
});

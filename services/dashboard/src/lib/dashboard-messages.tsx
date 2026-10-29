"use client";
import type { ReactNode } from "react";
import { MessageScope } from "./i18n";
import en from "./en.json";
import ru from "./ru.json";
const messages = { en, ru };
// Imported only by the dashboard route group, never by the root provider.
export function DashboardMessages({ children }: { children: ReactNode }) {
  return <MessageScope messages={messages}>{children}</MessageScope>;
}

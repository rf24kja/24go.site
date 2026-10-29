"use client";

import { AuthProvider } from "@/lib/auth";
import { I18nProvider, type Lang } from "@/lib/i18n";

export function Providers({ children, initialLang }: { children: React.ReactNode; initialLang: Lang }) {
  return (
    <I18nProvider initialLang={initialLang}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </I18nProvider>
  );
}

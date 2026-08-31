"use client";

import { AuthProvider } from "@/lib/auth";
import { I18nProvider } from "@/lib/i18n";
import { OnboardingWizard } from "@/components/OnboardingWizard";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <I18nProvider>
      <AuthProvider>
        {children}
        <OnboardingWizard />
      </AuthProvider>
    </I18nProvider>
  );
}

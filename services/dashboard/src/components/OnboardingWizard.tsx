"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { getAccounts } from "@/lib/api";

export function OnboardingWizard() {
  const { t } = useI18n();
  const { auth } = useAuth();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(false);
  const [hasAccount, setHasAccount] = useState(false);

  useEffect(() => {
    if (localStorage.getItem("onboarding_complete") === "true") return;
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!auth?.token) return;
    getAccounts(auth.token)
      .then((res) => setHasAccount((res.items || []).length > 0))
      .catch(() => {});
  }, [auth?.token]);

  const close = () => {
    localStorage.setItem("onboarding_complete", "true");
    setVisible(false);
  };

  const goNext = () => {
    if (step < 2) setStep(step + 1);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-lg mx-4 bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-6 pb-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                i === step ? "bg-emerald-400 w-6" : i < step ? "bg-emerald-400" : "bg-zinc-700"
              }`}
            />
          ))}
        </div>

        {/* Screen content */}
        <div className="px-8 pb-6 pt-4 min-h-[340px] flex flex-col">
          <div className="flex-1 flex flex-col items-center text-center">
            {step === 0 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-6xl mb-6">🚀</div>
                <h2 className="text-2xl font-bold text-zinc-100 mb-3">{t("wizard.welcome")}</h2>
                <p className="text-zinc-400 text-base">{t("wizard.welcomeDesc")}</p>
              </div>
            )}

            {step === 1 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-6xl mb-6">📱</div>
                <h2 className="text-2xl font-bold text-zinc-100 mb-3">{t("wizard.connectTitle")}</h2>
                <p className="text-zinc-400 text-base mb-6">{t("wizard.connectDesc")}</p>
                <div className="flex items-center justify-center gap-3 text-sm">
                  <span className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-300">
                    {t("wizard.connectStep1")}
                  </span>
                  <span className="text-zinc-600">→</span>
                  <span className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-300">
                    {t("wizard.connectStep2")}
                  </span>
                  <span className="text-zinc-600">→</span>
                  <span className="bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-300">
                    {t("wizard.connectStep3")}
                  </span>
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-6xl mb-6">🎉</div>
                <h2 className="text-2xl font-bold text-zinc-100 mb-3">{t("wizard.readyTitle")}</h2>
                <p className="text-zinc-400 text-base mb-6">{t("wizard.readyDesc")}</p>
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 text-left space-y-3">
                  <div className="flex items-center gap-3">
                    <span className={hasAccount ? "text-emerald-400" : "text-zinc-500"}>
                      {hasAccount ? "✅" : "⏳"}
                    </span>
                    <span className={`text-sm ${hasAccount ? "text-emerald-400" : "text-zinc-400"}`}>
                      {hasAccount ? t("wizard.accountConnected") : t("wizard.accountPending")}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500">⏳</span>
                    <span className="text-sm text-zinc-400">{t("wizard.groupTask")}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500">⏳</span>
                    <span className="text-sm text-zinc-400">{t("wizard.leadTask")}</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex justify-between items-center mt-8">
            <button
              onClick={close}
              className="text-sm text-zinc-500 hover:text-zinc-300 transition"
            >
              {t("wizard.skip")}
            </button>

            {step < 2 ? (
              step === 0 ? (
                <button
                  onClick={goNext}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-medium text-sm px-6 py-2.5 rounded-lg transition"
                >
                  {t("wizard.getStarted")}
                </button>
              ) : (
                <button
                  onClick={() => {
                    close();
                    router.push("/accounts");
                  }}
                  className="bg-emerald-500 hover:bg-emerald-400 text-black font-medium text-sm px-6 py-2.5 rounded-lg transition"
                >
                  {t("wizard.connectBtn")}
                </button>
              )
            ) : (
              <button
                onClick={() => {
                  close();
                  router.push("/targets");
                }}
                className="bg-emerald-500 hover:bg-emerald-400 text-black font-medium text-sm px-6 py-2.5 rounded-lg transition"
              >
                {t("wizard.goDashboard")}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

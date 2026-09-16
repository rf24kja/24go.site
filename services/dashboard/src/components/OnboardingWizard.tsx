"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { Bot, UsersGroup, Scales, Megaphone, CheckCircle } from "@/components/Icons";

const STEPS = [
  {
    icon: Bot,
    titleEn: "Connect Accounts",
    titleRu: "Подключите аккаунты",
    descEn: "Add your Telegram or VK accounts with proxies. 24GO handles warm-up automatically.",
    descRu: "Добавьте аккаунты Telegram или VK с прокси. 24GO автоматически выполнит прогрев.",
    href: "/accounts",
  },
  {
    icon: Scales,
    titleEn: "Add Target Groups",
    titleRu: "Добавьте целевые группы",
    descEn: "Specify Telegram groups or VK communities to monitor for leads.",
    descRu: "Укажите Telegram-группы или сообщества VK для мониторинга лидов.",
    href: "/targets",
  },
  {
    icon: UsersGroup,
    titleEn: "Configure Lead Rules",
    titleRu: "Настройте правила лидов",
    descEn: "Set up scoring rules to classify HOT/WARM/COLD leads automatically.",
    descRu: "Настройте правила оценки для автоматической классификации лидов.",
    href: "/lead-rules",
  },
  {
    icon: Megaphone,
    titleEn: "Launch Campaign",
    titleRu: "Запустите кампанию",
    descEn: "Create your first campaign and start generating leads on autopilot.",
    descRu: "Создайте первую кампанию и начните генерировать лиды в автоматическом режиме.",
    href: "/campaigns",
  },
];

export default function OnboardingWizard() {
  const { auth } = useAuth();
  const { t } = useI18n();
  const [completed, setCompleted] = useState<Record<number, boolean>>({});

  const toggle = (i: number) => setCompleted((prev) => ({ ...prev, [i]: !prev[i] }));
  const allDone = Object.values(completed).filter(Boolean).length === STEPS.length;

  if (!auth) return null;

  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-zinc-100">Quick Start Guide</h2>
          <p className="text-sm text-zinc-500 mt-1">Complete these steps to start generating leads</p>
        </div>
        {allDone && (
          <span className="flex items-center gap-2 text-emerald-400 text-sm font-medium">
            <CheckCircle className="w-4 h-4" /> All done!
          </span>
        )}
      </div>
      <div className="space-y-3">
        {STEPS.map((step, i) => (
          <div
            key={i}
            className={`flex items-center gap-4 p-4 rounded-xl border transition ${
              completed[i]
                ? "bg-emerald-500/5 border-emerald-500/20"
                : "bg-zinc-800/30 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <button
              onClick={() => toggle(i)}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 transition ${
                completed[i]
                  ? "bg-emerald-500 text-white"
                  : "bg-zinc-800 text-zinc-400 border border-zinc-700"
              }`}
            >
              {completed[i] ? "✓" : i + 1}
            </button>
            <step.icon className={`w-5 h-5 shrink-0 ${completed[i] ? "text-emerald-400" : "text-zinc-500"}`} />
            <div className="flex-1 min-w-0">
              <div className={`font-medium text-sm ${completed[i] ? "text-emerald-400 line-through opacity-60" : "text-zinc-100"}`}>
                {t("lang") === "ru" ? step.titleRu : step.titleEn}
              </div>
              <div className="text-xs text-zinc-500 mt-0.5 truncate">
                {t("lang") === "ru" ? step.descRu : step.descEn}
              </div>
            </div>
            <Link
              href={step.href}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400 transition shrink-0"
            >
              Go →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

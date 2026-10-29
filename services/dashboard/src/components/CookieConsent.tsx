"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";

import { useI18n } from "@/lib/i18n";

const CONSENT_KEY = "24go_cookie_consent";

export default function CookieConsent() {
  const { lang } = useI18n();
  const ru = lang === "ru";
  const [visible, setVisible] = useState(false);
  const [height, setHeight] = useState(0);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
  }, []);

  useEffect(() => {
    const notice = noticeRef.current;
    if (!visible || !notice) return;
    const measure = () => setHeight(notice.getBoundingClientRect().height);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(notice);
    return () => observer.disconnect();
  }, [visible]);

  if (!visible) return null;

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    setVisible(false);
  };

  return (
    <>
    <div aria-hidden="true" data-testid="cookie-consent-space" style={{ height }} />
    <div ref={noticeRef} data-cookie-notice className="fixed bottom-0 inset-x-0 z-50 p-4">
      <div className="max-w-4xl mx-auto bg-zinc-900 border border-zinc-700 rounded-xl p-5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-zinc-300 flex-1">
          {ru ? "Мы используем необходимые cookie для входа и управления сессией. Мы не используем рекламные или отслеживающие cookie." : "We use essential cookies for authentication and session management. We do not use advertising or tracking cookies."}{" "}
          <Link href={`/privacy?locale=${lang}`} className="text-emerald-400 underline hover:text-emerald-300">
            {ru ? "Политика конфиденциальности" : "Privacy Policy"}
          </Link>
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={decline}
            className="px-4 py-2 text-sm text-zinc-400 hover:text-zinc-100 border border-zinc-700 rounded-lg transition-colors"
          >
            {ru ? "Отклонить" : "Decline"}
          </button>
          <button
            onClick={accept}
            className="px-4 py-2 text-sm bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg transition-colors"
          >
            {ru ? "Принять" : "Accept"}
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

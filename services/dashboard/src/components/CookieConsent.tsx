"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import YandexMetrika from './YandexMetrika';

import { useI18n } from "@/lib/i18n";

const CONSENT_KEY = "24go_cookie_consent";
const ANALYTICS_KEY = "24go_analytics_consent_v1";

export default function CookieConsent() {
  const { lang } = useI18n();
  const ru = lang === "ru";
  const [visible, setVisible] = useState(false);
  const [height, setHeight] = useState(0);
  const noticeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('analytics') === 'reset') {
      localStorage.removeItem(ANALYTICS_KEY);
      window.dispatchEvent(new Event('24go:analytics-consent'));
      url.searchParams.delete('analytics');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    if (!localStorage.getItem(ANALYTICS_KEY)) setVisible(true);
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

  if (!visible) return <YandexMetrika />;

  const accept = () => {
    localStorage.setItem(CONSENT_KEY, "accepted");
    localStorage.setItem(ANALYTICS_KEY, "accepted");
    window.dispatchEvent(new Event('24go:analytics-consent'));
    setVisible(false);
  };

  const decline = () => {
    localStorage.setItem(CONSENT_KEY, "declined");
    localStorage.setItem(ANALYTICS_KEY, "declined");
    window.dispatchEvent(new Event('24go:analytics-consent'));
    setVisible(false);
  };

  return (
    <>
    <YandexMetrika />
    <div aria-hidden="true" data-testid="cookie-consent-space" style={{ height }} />
    <div ref={noticeRef} data-cookie-notice className="fixed bottom-0 inset-x-0 z-50 p-4">
      <div className="max-w-4xl mx-auto bg-zinc-900 border border-zinc-700 rounded-xl p-5 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <p className="text-sm text-zinc-300 flex-1">
          {ru ? "Необходимые cookie обеспечивают вход. С вашего согласия Яндекс Метрика использует аналитические cookie и Вебвизор для анализа посещений и взаимодействий на публичных страницах. Отказ не ограничивает работу сайта." : "Essential cookies support sign-in. With your consent, Yandex.Metrica uses analytics cookies and Webvisor to analyse visits and interactions on public pages. Declining does not limit access to the site."}{" "}
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

"use client";

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

type MetricaFunction = ((...args: unknown[]) => void) & { a?: unknown[][]; l?: number };
declare global { interface Window { ym?: MetricaFunction; dataLayer?: unknown[] } }
const COUNTER = 114036227;
const SOURCE = 'https://mc.yandex.ru/metrika/tag.js?id=114036227';
const CONSENT = '24go_analytics_consent_v1';
let active = false;
let lastUrl = '';

export function isAnalyticsPage(path: string) {
  return path === '/' || /^\/(blog|tools|features|pricing|privacy|terms|help|tutorials|integrations)(\/|$)/.test(path);
}

function publicUrl(value: string) {
  if (!value) return '';
  const url = new URL(value, window.location.origin);
  if (!isAnalyticsPage(url.pathname)) return '';
  const locale = url.searchParams.get('locale');
  return url.origin + url.pathname + (locale === 'ru' || locale === 'en' ? '?locale=' + locale : '');
}

export default function YandexMetrika() {
  const pathname = usePathname();
  useEffect(() => {
    const maskFields = () => document.querySelectorAll('input,textarea,[contenteditable]').forEach(el => el.classList.add('ym-disable-keys'));
    const sync = () => {
      if (!isAnalyticsPage(pathname || '') || new URLSearchParams(window.location.search).get('analytics') === 'reset' || localStorage.getItem(CONSENT) !== 'accepted') {
        if (active) window.ym?.(COUNTER, 'destruct');
        active = false;
        lastUrl = '';
        return;
      }
      // Never record entered form values, including on public calculator/contact pages.
      maskFields();
      if (!window.ym) {
        const queue: MetricaFunction = (...args) => { (queue.a ||= []).push(args); };
        queue.l = Date.now();
        window.ym = queue;
      }
      if (!document.querySelector(`script[src="${SOURCE}"]`)) {
        const script = document.createElement('script');
        script.async = true;
        script.src = SOURCE;
        document.head.appendChild(script);
      }
      const url = publicUrl(window.location.href);
      if (!active) {
        window.dataLayer ||= [];
        window.ym(COUNTER, 'init', { ssr: true, webvisor: true, clickmap: true,
          ecommerce: 'dataLayer', referrer: publicUrl(document.referrer), url,
          accurateTrackBounce: true, trackLinks: true });
        active = true;
      } else if (url !== lastUrl) {
        window.ym(COUNTER, 'hit', url, { referer: lastUrl });
      }
      lastUrl = url;
    };
    sync();
    const observer = new MutationObserver(maskFields);
    observer.observe(document.body, { childList: true, subtree: true });
    window.addEventListener('24go:analytics-consent', sync);
    window.addEventListener('storage', sync);
    return () => {
      observer.disconnect();
      window.removeEventListener('24go:analytics-consent', sync);
      window.removeEventListener('storage', sync);
    };
  }, [pathname]);
  return null;
}

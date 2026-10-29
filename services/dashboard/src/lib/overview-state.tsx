"use client";
import { useEffect, useState } from 'react';
export const overviewCopy = (lang: string) => lang === 'ru' ? {
  error: 'Не удалось загрузить данные. Значения недоступны.', partial: 'Данные загружены частично. Недоступные показатели не равны нулю.',
  retry: 'Повторить', unavailable: 'Недоступно', loading: 'Загрузка данных…',
  waScope: 'Только WhatsApp. Контакты — записи с известным WhatsApp JID, не охват и не подтверждение доставки. API не предоставляет сводную статистику отправок, доставки, прочтений и ответов.',
  history: 'Последние кампании WhatsApp (до 20)', vkScope: 'Только VK. Сводка лидов и сообщества — за выбранный период; аккаунты — текущее сохранённое состояние, последние 10 лидов — за всё время. Это не проверка доступности провайдера.',
} : {
  error: 'Could not load data. Values are unavailable.', partial: 'Some data could not be loaded. Unavailable metrics are not zero.',
  retry: 'Retry', unavailable: 'Unavailable', loading: 'Loading data…',
  waScope: 'WhatsApp only. Contacts are records with a known WhatsApp JID, not reach or confirmed delivery. The API does not provide aggregate sending, delivery, read or reply statistics.',
  history: 'Latest WhatsApp campaigns (up to 20)', vkScope: 'VK only. Lead summary and communities cover the selected period; accounts show current saved state, latest 10 leads cover all time. This is not a provider availability check.',
};
export function useOverview<T>(key: string, enabled: boolean, load: () => Promise<T>) {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{key:string; attempt:number; data?:T; failed?:boolean}>({key:'',attempt:-1});
  useEffect(() => {
    if (!enabled) return;
    let live = true;
    load().then(data => { if (live) setState({key,attempt,data}); }, () => { if (live) setState({key,attempt,failed:true}); });
    return () => { live = false; };
    // The request identity includes token, platform and period; loaders are render-local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, attempt]);
  const current = enabled && state.key === key && state.attempt === attempt;
  return {data:current ? state.data : undefined, failed:current && state.failed, loading:enabled && !current, retry:()=>setAttempt(n=>n+1)};
}
export function OverviewNotice({text,retry,label}:{text:string;retry:()=>void;label:string}) {
  return <div role="alert" className="border border-amber-700 rounded-xl p-4 text-amber-200"><p>{text}</p><button onClick={retry} className="mt-2 px-3 py-2 rounded bg-zinc-800">{label}</button></div>;
}

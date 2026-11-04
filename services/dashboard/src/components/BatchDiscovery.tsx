"use client";
import { useEffect, useRef, useState } from 'react';
import { dispatchParser, type BatchDiscoveryResponse } from '@/lib/api';

interface Props {
 token: string | null;
 platform: 'telegram' | 'vkontakte';
 lang: string;
 readOnly: boolean;
 onRefresh: () => void;
}
export function BatchDiscovery({token, platform, lang, readOnly, onRefresh}: Props) {
 const ru = lang === 'ru';
 const [geos,setGeos]=useState('Moscow');
 const [niches,setNiches]=useState('travel');
 const [limit,setLimit]=useState('20');
 const [pending,setPending]=useState(false);
 const [error,setError]=useState('');
 const [result,setResult]=useState<BatchDiscoveryResponse|null>(null);
 const scope=useRef(0);
 useEffect(()=>{scope.current++;setResult(null);setError('');setPending(false);return ()=>{scope.current++;};},[token,platform]);
 async function run() {
  if (!token || readOnly || pending) return;
  const target_geos=geos.split(',').map(s=>s.trim());
  const ns=niches.split(',').map(s=>s.trim());
  const valid=(xs:string[])=>xs.length>=1 && xs.length<=3 && new Set(xs).size===xs.length && xs.every(s=>s.length>0 && [...s].length<=100);
  const count=Number(limit);
  if (!valid(target_geos)||!valid(ns)||target_geos.length*ns.length>6||!Number.isInteger(count)||count<1||count>20) {
   setError(ru?'Укажите 1–3 уникальных GEO и ниши по 1–100 символов, не более 6 сочетаний; лимит — целое число 1–20.':'Enter 1–3 unique GEOs and niches of 1–100 characters, at most 6 combinations; limit must be an integer 1–20.');return;
  }
  const current=scope.current;setPending(true);setError('');
  try {
   const response=await dispatchParser(token,{platforms:[platform],target_geos,niches:ns,max_results_per_niche:count});
   if(current!==scope.current)return;
   setResult(response);onRefresh();
  } catch {
   if(current!==scope.current)return;
   setError(ru?'Запрос не завершён. Проверьте сохранённые группы перед повтором: часть данных могла сохраниться.':'Request did not complete. Check saved groups before retrying: some data may have persisted.');
   onRefresh();
  } finally {if(current===scope.current)setPending(false);}
 }
 const style='w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm';
 return <section className="mt-4 p-4 border border-zinc-700 rounded-xl space-y-3" aria-label={ru?'Пакетный поиск':'Batch discovery'}>
  <h3>{ru?'Поиск групп и каналов':'Search groups and channels'}</h3>
  <p className="text-xs text-zinc-400">{ru?'Telegram: GEO и все слова ниши должны встречаться в названии или username. Это текстовое совпадение, не подтверждённое местоположение. Нет совпадений — уточните слова. Результаты сохраняются; крупнейшие известные аудитории первыми.':'Telegram: GEO and every niche word must match the title or username. This is a text match, not verified location. No matches? Refine the words. Results are saved; largest known audiences first.'}</p>
  <details className="text-xs text-zinc-400"><summary>{ru?'Несколько GEO / ниш и ограничения':'Multiple GEOs / niches and limits'}</summary>{ru?'Через запятую: до 3 GEO и 3 ниш, максимум 6 сочетаний. 1–20 результатов на запрос. До 45 секунд на сочетание, до 270 секунд всего. Запросы сохраняются отдельными транзакциями; весь пакет не атомарен. Фоновой задачи, автоматических повторов и платного TGStat нет.':'Comma-separated: up to 3 GEOs and 3 niches, at most 6 combinations. 1–20 results per query. Up to 45 seconds per combination, 270 seconds per batch. Each query saves in its own transaction; the batch is not atomic. No background job, automatic retries or paid TGStat.'}</details>
  {readOnly && <p role="note">{ru?'Роль viewer: только чтение в рамках команды. Поиск с сохранением недоступен.':'Viewer role: tenant-wide read-only access. Discovery that saves groups is unavailable.'}</p>}
  <div className="grid gap-3 md:grid-cols-3">
   <label>{ru?'GEO пакета':'Batch GEOs'}<input className={style} value={geos} disabled={pending||readOnly} onChange={e=>setGeos(e.target.value)}/></label>
   <label>{ru?'Ниши пакета':'Batch niches'}<input className={style} value={niches} disabled={pending||readOnly} onChange={e=>setNiches(e.target.value)}/></label>
   <label>{ru?'Результатов на запрос':'Results per query'}<input className={style} type="number" min={1} max={20} step={1} value={limit} disabled={pending||readOnly} onChange={e=>setLimit(e.target.value)}/></label>
  </div>
  <button className="px-4 py-2 border rounded-lg disabled:opacity-50" disabled={pending||readOnly||!token} onClick={run}>{pending?(ru?'Поиск…':'Searching…'):(ru?'Запустить пакетный поиск':'Run batch discovery')}</button>
  {error&&<p role="alert">{error}</p>}
  {result&&<div role="status">
   <p>{({completed:ru?'Завершено':'Completed',partial:ru?'Частично завершено':'Partial completion',failed:ru?'Все запросы завершились ошибкой':'All queries failed'})[result.status]}: {result.completed_queries}/{result.total_queries}</p>
   <ul>{result.queries.map((q,i)=><li key={i} className="mt-2">
    <span>{q.geo_tag} · {q.niche}: {q.status==='completed'?(ru?`Сохранено результатов: ${q.total}`:`Saved results: ${q.total}`):(q.error==='query_timeout'?(ru?'Таймаут':'Timed out'):(ru?'Ошибка поиска':'Discovery failed'))}{q.http_status?` (HTTP ${q.http_status})`:''}</span>
    {q.persistence_may_be_partial&&<p>{ru?'Часть данных могла сохраниться. Проверьте список перед повторным поиском этого сочетания.':'Some data may have persisted. Check the list before searching this combination again.'}</p>}
    {q.results?.map((r,j)=><p key={j}>{r.title||r.target_id_code||'—'} <span className="text-xs text-zinc-400">{r.entity_type === 'group' ? (ru?'группа':'group') : r.entity_type === 'channel' ? (ru?'канал':'channel') : (ru?'тип неизвестен':'type unknown')} · {typeof r.members_count === 'number' ? r.members_count.toLocaleString() : '—'}</span></p>)}
   </li>)}</ul>
  </div>}
 </section>;
}

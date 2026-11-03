"use client";
import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useI18n } from '@/lib/i18n';
import { api } from '@/lib/api';
import { usePathname } from 'next/navigation';
import YTOAuthSetup from '@/components/YTOAuthSetup';
import YTSettings from '@/components/YTSettings';
interface Row { id: string; name?: string; channel_id?: string; text?: string; title?: string; video_id?: string; status?: string; enabled?: boolean; template_id?: string; account_id?: string; approved_by?: string; }
interface Capabilities { external_enabled?: boolean; oauth_enabled?: boolean; monitoring_enabled?: boolean; posting_enabled?: boolean; oauth_configured?: boolean; }
const capability = (value: boolean | undefined, legacy: boolean | undefined) => value === undefined ? legacy === true : value === true;
export default function YTPage() {
 const { auth } = useAuth(); const { lang } = useI18n(); const ru = lang === 'ru';
 const pathname = usePathname();
 const tab = pathname.split('/')[2] || 'accounts';
 const token = auth.token; const writable = ['owner','admin','member','operator'].includes(auth.user?.role || '');
 const admin = ['owner','admin'].includes(auth.user?.role || '');
 const [rows,setRows] = useState<Record<string,Row[]>>({accounts:[],channels:[],templates:[],queue:[]});
 const [loading,setLoading] = useState(true);
 const [caps,setCaps] = useState<Capabilities|null>(null); const [error,setError] = useState('');
 const [pending,setPending] = useState(false); const [channel,setChannel] = useState('');
 const [name,setName] = useState(''); const [text,setText] = useState('О видео {title}: {description}');
 const [template,setTemplate] = useState(''); const [account,setAccount] = useState('');
 const generation = useRef(0); const current = useRef(token); current.current=token;
 const load = useCallback(async () => {
  if (!token) return;
  const scope=token; const version=++generation.current; setLoading(true);
  try {
   const [c,...lists] = await Promise.all([api<Capabilities>('/yt/capabilities',{token}), ...['accounts','channels','templates','queue'].map(k=>api<Row[]>('/yt/'+k,{token}))]);
   if(current.current!==scope || generation.current!==version) return;
   setCaps(c); setRows(Object.fromEntries(['accounts','channels','templates','queue'].map((k,i)=>[k,lists[i]]))); setError('');
  } catch { if(current.current===scope && generation.current===version) setError(ru?'Не удалось загрузить YT. Повторите.':'YT could not be loaded. Retry.'); }
   finally { if(current.current===scope && generation.current===version) setLoading(false); }
 },[token,ru]);
 useEffect(()=>{ setRows({accounts:[],channels:[],templates:[],queue:[]}); setCaps(null); setError(''); setPending(false); setAccount(''); setTemplate(''); void load(); return ()=>{ generation.current++; }; },[load]);
 async function mutate(path:string, method='POST', body?:unknown) {
  if(!token || pending) return; const scope=token; const version=generation.current;
  setPending(true); setError('');
  try { const result=await api<any>('/yt'+path,{token,method,...(body===undefined?{}:{body:JSON.stringify(body)})});
   if(current.current!==scope || generation.current!==version) return;
   if(result.authorization_url) { const target=new URL(result.authorization_url); if(target.origin==='https://accounts.google.com') window.location.assign(target.href); }
   else await load();
  } catch { if(current.current===scope && generation.current===version) setError(ru?'Действие не выполнено. Проверьте доступ и состояние YT.':'Action failed. Check YT access and state.'); }
  finally { if(current.current===scope) setPending(false); }
 }
 const oauthEnabled=capability(caps?.oauth_enabled,caps?.external_enabled);
 const monitoringEnabled=capability(caps?.monitoring_enabled,caps?.external_enabled);
 const postingEnabled=caps?.posting_enabled === true;
 const configured=caps?.oauth_configured === true;
 const disabled=!token||!writable||pending||loading||!caps;
 const selectedAccount=rows.accounts.find(a=>a.id===account && a.status==='connected');
 const selectedTemplate=rows.templates.find(t=>t.id===template);
 return <section className="space-y-6 max-w-5xl">
  <h1 className="text-2xl font-bold">YouTube · YT</h1>
  <p>{ru?'Аккаунты, каналы, контекстные шаблоны и очередь YouTube. Публикации требуют подтверждения человеком.':'YouTube accounts, channels, contextual templates and queue. Publishing requires human approval.'}</p>
  {loading&&<p role="status">{ru?'Загрузка YT…':'Loading YT…'}</p>}
  {!writable&&<p>{ru?'Только просмотр: действия недоступны для вашей роли.':'Read-only: your role cannot perform actions.'}</p>}
  {caps&&<p role="status">{!caps.posting_enabled ? (ru?'Внешняя публикация выключена':'External posting is disabled') : (ru?'Разрешена только подтверждённая отправка':'Only approved sending is enabled')}</p>}
  {caps&&['accounts','help'].includes(tab)&&<YTOAuthSetup ru={ru} configured={configured} login={oauthEnabled} authenticated={rows.accounts.some(a=>a.status==='connected')} monitoring={monitoringEnabled} posting={postingEnabled}/>}
  {tab==='settings'&&<YTSettings ru={ru}/>}
  {tab==='help'&&<div className="space-y-3">
   <h2>{ru?'Как использовать YouTube':'How to use YouTube'}</h2>
   <ol className="list-decimal pl-6 space-y-2">
    <li>{ru?'Аккаунты: подключение Google доступно только после настройки OAuth и разрешения провайдера администратором. Пароли и токены не отправляйте в чат.':'Accounts: Google connection requires administrator-configured OAuth and an enabled provider. Never send passwords or tokens in chat.'}</li>
    <li>{ru?'Шаблоны: сохраните текст с обязательным {title}; доступны {description} и {video_url}.':'Templates: save text containing {title}; {description} and {video_url} are optional.'}</li>
    <li>{ru?'Каналы: добавьте точный UC ID канала, выберите шаблон и включите наблюдение. Первый опрос запоминает имеющиеся видео.':'Channels: add the exact UC channel ID, select a template and enable monitoring. The first scan baselines existing videos.'}</li>
    <li>{ru?'Очередь: проверьте и подтвердите каждый комментарий, затем выберите подключённый аккаунт. Расписание привязывает аккаунт, а не время отправки.':'Queue: review and approve every comment, then choose a connected account. Scheduling binds an account, not a send time.'}</li>
   </ol>
   <p>{ru?'Опрос требует разрешения мониторинга и worker; отправка — отдельного разрешения публикации, подключённого аккаунта и подтверждения человеком. Неизвестный результат не повторяется автоматически. Отключение аккаунта локальное; отзыв доступа выполняется отдельно в настройках Google.':'Scanning requires monitoring permission and a worker; sending requires separate posting permission, a connected account and human approval. Unknown outcomes are not retried automatically. Account disconnection is local; revoke access separately in Google settings.'}</p>
  </div>}
  {error&&<div role="alert">{error} <button onClick={()=>void load()}>{ru?'Повторить':'Retry'}</button></div>}
  {tab==='accounts'&&<><h2>{ru?'Аккаунты OAuth':'OAuth accounts'}</h2>
  <button disabled={disabled||!admin||!oauthEnabled||!configured} onClick={()=>void mutate('/oauth/start')}>{ru?'Подключить Google':'Connect Google'}</button>
  <ul>{rows.accounts.map(a=><li key={a.id}>{a.name} · {a.status} <button disabled={disabled||!admin} onClick={()=>{if(window.confirm(ru?'Отключить локально? Отзыв доступа в Google выполняется отдельно.':'Disconnect locally? Revoke access in Google separately.')) void mutate('/accounts/'+a.id,'DELETE');}}>{ru?'Отключить':'Disconnect'}</button></li>)}</ul>
  </>}
  {tab==='channels'&&<><h2>{ru?'Наблюдаемые каналы':'Monitored channels'}</h2>
  <form onSubmit={e=>{e.preventDefault();void mutate('/channels','POST',{channel_id:channel,name:channel});}} className="flex flex-wrap gap-3">
   <input aria-label="Channel ID" placeholder="UC…" value={channel} onChange={e=>setChannel(e.target.value)} pattern="UC(?:[A-Za-z0-9_]|-){22}" required className="bg-zinc-900 p-2"/>
   <button disabled={disabled}>{ru?'Добавить канал':'Add channel'}</button>
  </form>
  <select disabled={disabled} aria-label={ru?'Шаблон наблюдения':'Monitoring template'} value={template} onChange={e=>setTemplate(e.target.value)} className="bg-zinc-900 p-2"><option value="">{ru?'Шаблон опроса':'Scan template'}</option>{rows.templates.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
  <ul>{rows.channels.map(c=><li key={c.id} className="py-2 flex flex-wrap gap-3">{c.name} <span>{ru?'Шаблон: ':'Template: '}{rows.templates.find(t=>t.id===c.template_id)?.name || (ru?'не назначен':'not assigned')}</span> <button disabled={disabled||(!c.enabled&&!selectedTemplate)} onClick={()=>void mutate('/channels/'+c.id,'PATCH',c.enabled?{enabled:false}:{enabled:true,template_id:template})}>{c.enabled?(ru?'Остановить':'Stop'):(ru?'Наблюдать':'Monitor')}</button><button disabled={disabled||!c.enabled||!template||!monitoringEnabled} onClick={()=>void mutate('/channels/'+c.id+'/sync','POST',{template_id:template})}>{ru?'Опросить':'Scan'}</button></li>)}</ul>
  </>}
  {tab==='templates'&&<><h2>{ru?'Редактируемые шаблоны':'Editable templates'}</h2>
  <p>{ru?'Обязательно {title}; допустимы {description}, {video_url}. Сохранённая очередь не меняется вместе с шаблоном.':'Required: {title}; optional: {description}, {video_url}. Existing queue text remains a snapshot.'}</p>
  <form onSubmit={e=>{e.preventDefault();void mutate('/templates','POST',{name,text});}} className="grid gap-3">
   <input aria-label="Template name" value={name} onChange={e=>setName(e.target.value)} required className="bg-zinc-900 p-2"/>
   <textarea aria-label="Template text" value={text} onChange={e=>setText(e.target.value)} required className="bg-zinc-900 p-2"/>
   <button disabled={disabled}>{ru?'Создать шаблон':'Create template'}</button>
  </form>
  {rows.templates.map(t=><article key={t.id}><strong>{t.name}</strong><textarea aria-label={'Template '+t.id} defaultValue={t.text} disabled={disabled} onBlur={e=>{if(e.target.value!==t.text) void mutate('/templates/'+t.id,'PUT',{name:t.name,text:e.target.value});}} className="block w-full bg-zinc-900 p-2"/></article>)}
  </>}
  {tab==='queue'&&<><h2>{ru?'Очередь и история':'Queue and history'}</h2>
  <p>{ru?'Выберите подключённый аккаунт вашей организации. Привязка расписания доступна только после подтверждения человеком.':'Choose a connected account owned by your organization. Schedule binding requires human approval first.'}</p>
  <select disabled={disabled} aria-label={ru?'Аккаунт отправителя':'Sender account'} value={account} onChange={e=>setAccount(e.target.value)} className="bg-zinc-900 p-2"><option value="">{ru?'Аккаунт отправителя':'Sender account'}</option>{rows.accounts.filter(a=>a.status==='connected').map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>
  {!loading&&!error&&rows.queue.length===0&&<p>{ru?'Очередь пуста':'Queue is empty'}</p>}
  {rows.queue.map(q=><article key={q.id} className="border border-zinc-700 p-3 space-y-2"><a href={'https://www.youtube.com/watch?v='+q.video_id} target="_blank" rel="noreferrer">{q.title}</a><p>{q.status}</p>
   <textarea aria-label={'Draft '+q.id} defaultValue={q.text} disabled={disabled||!['draft','approved'].includes(q.status||'')} onBlur={e=>{if(e.target.value!==q.text) void mutate('/queue/'+q.id,'PATCH',{text:e.target.value});}} className="w-full bg-zinc-900 p-2"/>
   <button disabled={disabled||q.status!=='draft'} onClick={()=>void mutate('/queue/'+q.id+'/approve')}>{ru?'Подтвердить':'Approve'}</button>{' '}
   <button disabled={disabled||!['draft','approved'].includes(q.status||'')} onClick={()=>void mutate('/queue/'+q.id+'/reject')}>{ru?'Отклонить':'Reject'}</button>{' '}
   <p>{q.account_id ? (ru?'Аккаунт расписания: ':'Scheduled account: ')+(rows.accounts.find(a=>a.id===q.account_id)?.name || (ru?'недоступен':'unavailable')) : (ru?'Аккаунт расписания не назначен':'No scheduled account')}</p>
   <button disabled={disabled||q.status!=='approved'||!q.approved_by||!selectedAccount} onClick={()=>void mutate('/queue/'+q.id+'/schedule','POST',{account_id:account})}>{ru?'Назначить расписание':'Schedule approved comment'}</button>{' '}
   <button disabled={disabled||q.status!=='approved'||!selectedAccount||!postingEnabled||!q.approved_by} onClick={()=>{if(window.confirm(ru?'Опубликовать этот комментарий на YouTube?':'Publish this comment on YouTube?')) void mutate('/queue/'+q.id+'/send','POST',{account_id:account});}}>{ru?'Отправить':'Send'}</button>
  </article>)}
  </>}
 </section>;
}

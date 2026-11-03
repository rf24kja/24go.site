"use client";
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
interface Status { status: 'missing'|'configured'; oauth_enabled: boolean; monitoring_enabled: boolean; posting_enabled: boolean; }
const CALLBACK='https://www.24go.site/YT/callback';
export default function YTSettings({ru}:{ru:boolean}) {
 const {auth}=useAuth(); const token=auth.token;
 const admin=['owner','admin'].includes(auth.user?.role||'');
 const [status,setStatus]=useState<Status|null>(null); const [error,setError]=useState('');
 const [client,setClient]=useState(''); const [secret,setSecret]=useState(''); const [enabled,setEnabled]=useState(false);
 const [pending,setPending]=useState(false); const [saved,setSaved]=useState(false);
 const identity=useRef(token); identity.current=token;
 useEffect(()=>{setClient('');setSecret('');setStatus(null);setEnabled(false);setError('');setSaved(false);
  if(!token||!admin)return;let live=true;
  api<Status>('/yt/settings',{token}).then(s=>{if(live){setStatus(s);setEnabled(s.oauth_enabled);}}).catch(()=>{if(live)setError(ru?'Настройки недоступны. Обновите страницу.':'Settings unavailable. Reload the page.');});
  return()=>{live=false;};
 },[token,admin,ru]);
 if(!admin)return <p>{ru?'Настройки доступны только владельцу и администратору организации.':'Settings require your organization owner or administrator.'}</p>;
 async function save(e:React.FormEvent){e.preventDefault();if(!token||pending)return;const scope=token;setPending(true);setError('');setSaved(false);
  try{const result=await api<Status>('/yt/settings',{token,method:'PUT',body:JSON.stringify({client_id:client,client_secret:secret,redirect_uri:CALLBACK,oauth_enabled:enabled})});
   if(identity.current!==scope)return;setStatus(result);setSecret('');setClient('');setSaved(true);
  }catch{if(identity.current===scope)setError(ru?'Не сохранено. Проверьте Web client, права доступа и отключите прежние аккаунты перед заменой клиента.':'Not saved. Check the Web client, permissions and disconnect existing accounts before replacing the client.');}
  finally{if(identity.current===scope)setPending(false);}
 }
 return <section className="space-y-4 max-w-2xl ym-disable-keys" aria-label={ru?'Настройки Google OAuth':'Google OAuth settings'}>
  <h2 className="text-xl font-semibold">{ru?'Google OAuth для YouTube':'Google OAuth for YouTube'}</h2>
  <p>{ru?'Свой клиент только для вашей организации. Общая конфигурация и другие организации не изменяются. Секрет шифруется на сервере и никогда не возвращается в браузер.':'Your client belongs only to your organization. Shared configuration and other tenants are unchanged. The secret is encrypted on the server and is never returned to the browser.'}</p>
  <p role="status">{status?(status.status==='configured'?(ru?'Настроено':'Configured'):(ru?'Не настроено':'Missing')):(ru?'Загрузка…':'Loading…')}</p>
  <p>{ru?'В Google Cloud создайте Web application и добавьте точный Authorized redirect URI:':'Create a Web application in Google Cloud and register this exact Authorized redirect URI:'} <code className="break-all">{CALLBACK}</code></p>
  <p>{ru?'Сервер не может прочитать список redirect URI в Google Cloud: его нужно добавить там самостоятельно. Здесь сохраняется только указанный точный callback.':'The server cannot inspect Google Cloud redirect registration: add it there yourself. Only this exact callback is stored here.'}</p>
  <form onSubmit={save} className="grid gap-3" autoComplete="off">
   <label>Google client ID<input className="block w-full bg-zinc-900 p-2" aria-label="Google client ID" required maxLength={512} pattern="[A-Za-z0-9_\-]+\.apps\.googleusercontent\.com" value={client} disabled={pending} onChange={e=>setClient(e.target.value)} autoComplete="off"/></label>
   <label>Google client secret<input className="block w-full bg-zinc-900 p-2" aria-label="Google client secret" type="password" required minLength={16} maxLength={512} value={secret} disabled={pending} onChange={e=>setSecret(e.target.value)} autoComplete="new-password"/></label>
   <label>Authorized redirect URI<input className="block w-full bg-zinc-900 p-2" value={CALLBACK} readOnly/></label>
   <label><input type="checkbox" checked={enabled} disabled={pending} onChange={e=>setEnabled(e.target.checked)}/> {ru?'Разрешить ТОЛЬКО OAuth (подключение Google)':'Enable OAuth ONLY (Google connection)'}</label>
   <p>{ru?'Мониторинг и публикация не включаются. Повторное сохранение требует повторного ввода секретного ключа и отменяет незавершённые подключения.':'Monitoring and posting are not enabled. Saving again requires re-entering the secret and cancels pending connections.'}</p>
   <button className="rounded bg-red-600 px-4 py-2 disabled:opacity-40" disabled={pending||!status}>{pending?(ru?'Сохранение…':'Saving…'):(ru?'Сохранить настройки':'Save settings')}</button>
  </form>
  {error&&<p role="alert">{error}</p>}{saved&&<p role="status">{ru?'Настройки сохранены. Можно перейти к подключению Google.':'Settings saved. You can now connect Google.'}</p>}
  <a href="/YT/accounts" className="underline">{ru?'Аккаунты → Подключить Google':'Accounts → Connect Google'}</a>
 </section>;
}

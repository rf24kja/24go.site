"use client";
import {useEffect,useState} from 'react';
import {api} from '@/lib/api';
import {useAuth} from '@/lib/auth';
import {useI18n} from '@/lib/i18n';
const path='/api/v1/accounts/vk-discovery/credential';
const errors:Record<string,[string,string]>={
 vk_user_token_required:['Нужен действующий пользовательский токен VK, не токен сообщества или сервиса.','A valid VK user token is required, not a community or service token.'],
 vk_search_permission_required:['Приложению токена недоступен groups.search. Нужен разрешённый VK доступ; подключение сообщества не поможет.','This token application cannot use groups.search. VK-authorized access is required; connecting a community will not help.'],
 vk_token_only:['Введите только токен, не URL авторизации.','Enter only the token, not an authorization URL.'],
 vk_encryption_unavailable:['Безопасное хранилище недоступно. Обратитесь к администратору.','Secure storage is unavailable. Contact the administrator.'],
};
export default function VkDiscoveryConnection(){
 const {auth}=useAuth();const {lang}=useI18n();const ru=lang==='ru';
 const [secret,setSecret]=useState('');const [status,setStatus]=useState<{connected:boolean;user_id?:number}|null>(null);
 const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const load=()=>api(path,{token:auth?.token || undefined}).then(setStatus).catch(()=>setError(ru?'Не удалось проверить подключение. Повторите.':'Cannot check connection. Retry.'));
 useEffect(()=>{if(auth?.token)void load();},[auth?.token]);
 async function change(remove=false){
  if(!auth?.token)return;setBusy(true);setError('');
  try{setStatus(await api(path,{token:auth.token,method:remove?'DELETE':'POST',...(remove?{}:{body:JSON.stringify({access_token:secret})})}));}
  catch(e){const message=e instanceof Error?e.message:'';const code=Object.keys(errors).find(k=>message.includes(k));setError(code?errors[code][ru?0:1]:(ru?'VK недоступен или подключение не сохранено. Повторите.':'VK unavailable or connection not saved. Retry.'));}
  finally{setSecret('');setBusy(false);}
 }
 return <section className="p-5 border border-zinc-700 rounded-xl space-y-3">
  <h2>{ru?'Поиск VK: отдельный пользовательский токен':'VK search: separate user token'}</h2>
  <p>{ru?'Только поиск сообществ. Этот токен не создаёт отправителя кампаний и не запускает рассылки. Нужен уже выданный пользовательский токен приложения, которому VK разрешает groups.search. Вход через VK ID сам по себе не гарантирует это право. Если такого токена нет — сначала настройте разрешённый доступ приложения у VK.':'Community search only. This token does not create a campaign sender or start messaging. Supply an already issued user token from an application VK permits to call groups.search. VK ID login alone does not guarantee that permission. Without such a token, arrange authorized application access with VK first.'}</p>
  <a href="https://dev.vk.com/ru/method/groups.search" target="_blank" rel="noreferrer">groups.search — VK</a>
  {status===null?<button onClick={()=>void load()}>{ru?'Проверить подключение':'Check connection'}</button>:<p>{status.connected?(ru?`Поиск подключён: ${status.user_id}`:`Search connected: ${status.user_id}`):(ru?'Поиск не подключён':'Search not connected')}</p>}
  <label className="block">{ru?'Пользовательский токен VK':'VK user access token'}<input type="password" autoComplete="off" value={secret} onChange={e=>setSecret(e.target.value)} className="block bg-zinc-800 border border-zinc-600 rounded px-3 py-2"/></label>
  <button disabled={busy||!secret.trim()} onClick={()=>void change()}>{busy?(ru?'Проверка…':'Checking…'):(ru?'Подключить поиск':'Connect search')}</button>
  {status?.connected&&<button disabled={busy} onClick={()=>void change(true)}>{ru?'Отключить поиск':'Disconnect search'}</button>}
  <a className="block" href="/VK/targets">{ru?'Перейти к поиску':'Go to search'}</a>
  {error&&<p role="alert">{error}</p>}
 </section>;
}

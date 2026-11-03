"use client";
import { useEffect, useRef, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { api } from '@/lib/api';
export default function YTCallback() {
 const {auth}=useAuth(); const grant=useRef<{code:string;state:string}|null>(null);
 const [status,setStatus]=useState('Confirm this Google connection / Подтвердите подключение Google');
 const [pending,setPending]=useState(false);
 useEffect(()=>{
  const p=new URLSearchParams(window.location.search); const code=p.get('code'),state=p.get('state');
  window.history.replaceState(null,'','/YT/callback');
  if(code&&state) grant.current={code,state};
 },[]);
 async function complete() {
  if(!auth.token||!grant.current||pending) return;
  const body=grant.current; grant.current=null; setPending(true);
  try { await api('/yt/oauth/complete',{token:auth.token,method:'POST',body:JSON.stringify(body)}); setStatus('Connected / Подключено'); }
  catch { setStatus('Connection not confirmed. Start again from YT. / Подключение не подтверждено. Начните заново из YT.'); }
  finally {setPending(false);}
 }
 return <section><h1>YouTube OAuth</h1><p role="status">{status}</p><button disabled={pending||!auth.token} onClick={()=>void complete()}>Confirm / Подтвердить</button><p><a href="/YT">YouTube</a></p></section>;
}

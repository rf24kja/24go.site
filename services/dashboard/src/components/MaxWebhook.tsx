"use client";
import {useEffect, useRef, useState} from 'react';
import {subscribeMax} from '@/lib/api';
import {useI18n} from '@/lib/i18n';
interface Props { token: string; accountId: string; secret?: string; configured?: boolean; clearSecret: () => void }
export function MaxWebhook({token,accountId,secret,configured,clearSecret}:Props) {
  const {t}=useI18n();
  const [open,setOpen]=useState(false), [consent,setConsent]=useState(false);
  const [busy,setBusy]=useState(false), [error,setError]=useState(false), [subscribed,setSubscribed]=useState(false);
  const live=useRef(true), pending=useRef(false);
  useEffect(()=>{live.current=true;return ()=>{live.current=false;};},[]);
  const close=()=>{if(pending.current)return;setOpen(false);setConsent(false);setError(false);clearSecret();};
  const submit=async()=>{
    if(pending.current || (!secret && !consent))return;
    pending.current=true;setBusy(true);setError(false);
    try {
      // New/replacement secrets are generated only after explicit consent and submit.
      const value=secret || Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
      const result=await subscribeMax(token,accountId,value);
      if(!result.subscribed)throw new Error('not subscribed');
      if(live.current){setSubscribed(true);setOpen(false);setConsent(false);clearSecret();}
    } catch {if(live.current)setError(true);}
    finally {pending.current=false;if(live.current)setBusy(false);}
  };
  return <div className="space-y-2">
    <button disabled={busy} onClick={()=>{setOpen(true);setConsent(false);setError(false);}} className="px-3 py-1.5 text-xs text-emerald-300 border border-zinc-700 rounded">{t('maxAccounts.subscribe')}</button>
    <p className="text-xs text-zinc-400">{t(subscribed || configured?'maxAccounts.subscribedNotLive':'maxAccounts.webhookUnconfigured')}</p>
    {open && <div role="dialog" aria-modal="true" aria-label={t('maxAccounts.subscribe')} className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 max-w-lg space-y-4">
        <h2>{t('maxAccounts.subscribe')}</h2>
        <p>{t(secret?'maxAccounts.useConnectSecret':'maxAccounts.replaceSecretWarning')}</p>
        {!secret && <label className="flex gap-2"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>setConsent(e.target.checked)}/>{t('maxAccounts.replaceSecretConsent')}</label>}
        <p className="text-xs text-zinc-400">{t('maxAccounts.webhookDeliveryHint')}</p>
        {error && <p role="alert">{t('maxAccounts.subscribeFailed')}</p>}
        <button onClick={submit} disabled={busy || (!secret && !consent)} className="px-3 py-2 bg-emerald-600 rounded disabled:opacity-40">{t('maxAccounts.registerWebhook')}</button>
        <button onClick={close} disabled={busy} className="px-3 py-2">{t('accounts.cancel')}</button>
      </div>
    </div>}
  </div>;
}

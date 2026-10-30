"use client";
import {useRef,useState} from 'react';
import {api} from '@/lib/api';
interface Props {token:string;accounts:{id:string;phone_number:string;status:string}[];readOnly:boolean;ru:boolean}
export function WaTextSender({token,accounts,readOnly,ru}:Props){
 const eligible=accounts.filter(a=>a.status==='connected');
 const [account,setAccount]=useState('');const [recipient,setRecipient]=useState('');const [text,setText]=useState('');const [confirmed,setConfirmed]=useState(false);
 const [pending,setPending]=useState(false);const [result,setResult]=useState('');const [locked,setLocked]=useState(false);const busy=useRef(false);const next=useRef(0);
 const label=(en:string,ruText:string)=>ru?ruText:en;
 const send=async()=>{
  if(readOnly||busy.current||locked||Date.now()<next.current||!confirmed||!/^\+[1-9]\d{7,14}$/.test(recipient)||!text.trim()||text.length>2000)return;
  const id=account||eligible[0]?.id;if(!eligible.some(a=>a.id===id))return;
  busy.current=true;setPending(true);setResult('');setConfirmed(false);
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),18000);
  try{const value=await api<{status:string}>('/api/v1/wa/send-text',{method:'POST',token,signal:controller.signal,body:JSON.stringify({account_id:id,recipient,text,confirmed:true})});
   if(value.status==='accepted'){setResult(label('Server accepted; delivery is not confirmed.','Сервер принял; доставка не подтверждена.'));next.current=Date.now()+30000;}
   else if(value.status==='failed'){setResult(label('Not sent. Check account and confirmation before a new action.','Не отправлено. Проверьте аккаунт и подтверждение перед новым действием.'));}
   else{setLocked(true);setResult(label('Outcome unknown. Do not retry; verify in WhatsApp.','Результат неизвестен. Не повторяйте; проверьте в WhatsApp.'));}
  }catch{setLocked(true);setResult(label('Outcome unknown. Do not retry; verify in WhatsApp.','Результат неизвестен. Не повторяйте; проверьте в WhatsApp.'));}
  finally{clearTimeout(timeout);busy.current=false;setPending(false);}
 };
 const disabled=readOnly||pending||locked;
 return <section className="min-w-0 space-y-3 rounded-lg border border-zinc-700 p-4">
  <h2>{label('One consented WhatsApp text','Одно сообщение WhatsApp с согласием')}</h2>
  <p>{label('Only a recipient who agreed to this message. No bulk sending. After acceptance wait 30 seconds.','Только получателю, согласившемуся на это сообщение. Не массовая рассылка. После принятия подождите 30 секунд.')}</p>
  <select aria-label={label('Sender','Отправитель')} disabled={disabled} value={account||eligible[0]?.id||''} onChange={e=>{setAccount(e.target.value);setConfirmed(false)}} className="w-full bg-zinc-900">{eligible.map(a=><option key={a.id} value={a.id}>{a.phone_number}</option>)}</select>
  {!eligible.length&&<p>{label('Connect a WhatsApp account first.','Сначала подключите аккаунт WhatsApp.')}</p>}
  <label className="block">{label('Recipient','Получатель')}<input aria-label={label('Recipient','Получатель')} value={recipient} disabled={disabled} maxLength={16} placeholder="+15555550101" onChange={e=>{setRecipient(e.target.value);setConfirmed(false)}} className="block w-full bg-zinc-900"/></label>
  <label className="block">{label('Text','Текст')}<textarea aria-label={label('Text','Текст')} value={text} disabled={disabled} maxLength={2000} onChange={e=>{setText(e.target.value);setConfirmed(false)}} className="block w-full bg-zinc-900"/></label>
  <label><input type="checkbox" checked={confirmed} disabled={disabled} onChange={e=>setConfirmed(e.target.checked)}/>{label(` I confirm consent and recipient ${recipient}`,` Подтверждаю согласие и получателя ${recipient}`)}</label>
  <button type="button" disabled={disabled||!eligible.length} onClick={send} className="block rounded bg-emerald-700 px-4 py-2 disabled:opacity-50">{pending?label('Sending…','Отправка…'):label('Send one text','Отправить одно сообщение')}</button>
  {result&&<p role="status">{result}</p>}
 </section>;
}

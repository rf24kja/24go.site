import { render, screen, waitFor, fireEvent, cleanup, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, it, vi, expect } from 'vitest';
import YTPage from '../app/(dashboard)/YT/page';
const state=vi.hoisted(()=>({role:'operator',lang:'en', fail:false, mutationFail:false, enabled:false, bound:'', resolve:null as null|(()=>void)}));
vi.mock('@/lib/auth',()=>({useAuth:()=>({auth:{token:'synthetic',user:{role:state.role}}})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({lang:state.lang})}));
const ids={channel:'11111111-1111-4111-8111-111111111111',template:'22222222-2222-4222-8222-222222222222',account:'33333333-3333-4333-8333-333333333333',queue:'44444444-4444-4444-8444-444444444444'};
vi.mock('@/lib/api',()=>({api:vi.fn(async(path:string,options:{method?:string;body?:string})=>{
 if(options.method){
  if(state.mutationFail) throw new Error('synthetic 403');
  const body=JSON.parse(options.body||'{}');
  if(path==='/yt/channels/'+ids.channel && options.method==='PATCH'){state.enabled=body.enabled;return {id:ids.channel,enabled:body.enabled,template_id:body.template_id};}
  if(path==='/yt/queue/'+ids.queue+'/schedule' && options.method==='POST'){state.bound=body.account_id;return {id:ids.queue,status:'approved',approved_by:'human',account_id:body.account_id};}
  throw new Error('Unexpected mutation '+path);
 }
 if(state.fail) throw new Error('synthetic 503');
 if(path==='/yt/capabilities') return {external_enabled:false,posting_enabled:false,oauth_configured:false};
 if(path==='/yt/accounts') return [{id:ids.account,name:'Owned connected',status:'connected'},{id:'55555555-5555-4555-8555-555555555555',name:'Disconnected',status:'disconnected'}];
 if(path==='/yt/channels') return [{id:ids.channel,name:'Watched channel',enabled:state.enabled,template_id:state.enabled?ids.template:undefined}];
 if(path==='/yt/templates') return [{id:ids.template,name:'Context template',text:'Regarding {title}: {description}'}];
 if(path==='/yt/queue') return [{id:ids.queue,title:'Approved video',video_id:'abcdefghijk',text:'Human approved contextual comment',status:'approved',approved_by:'human',account_id:state.bound},{id:'66666666-6666-4666-8666-666666666666',title:'Draft video',status:'draft',text:'Unapproved contextual comment'}];
 throw new Error('Unexpected read '+path);
})}));
import { api } from '@/lib/api';
const button=(name:string)=>screen.getByRole('button',{name}) as HTMLButtonElement;
afterEach(cleanup);
beforeEach(()=>{Object.assign(state,{role:'operator',lang:'en',fail:false,mutationFail:false,enabled:false,bound:''});vi.mocked(api).mockClear();});
describe('YT scheduling candidate',()=>{
 it('binds the selected template on Start and stops without erasing it',async()=>{
  render(<YTPage/>);
  expect(screen.getByText('Loading YT…')).toBeTruthy();
  await screen.findByText('External posting is disabled');
  expect(button('Monitor').disabled).toBe(true);
  fireEvent.change(screen.getByLabelText('Monitoring template'),{target:{value:ids.template}});
  fireEvent.click(button('Monitor'));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/yt/channels/'+ids.channel,expect.objectContaining({method:'PATCH',body:JSON.stringify({enabled:true,template_id:ids.template})})));
  await waitFor(()=>expect(button('Stop').disabled).toBe(false));
  expect(screen.getByText('Template: Context template')).toBeTruthy();
  fireEvent.click(button('Stop'));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/yt/channels/'+ids.channel,expect.objectContaining({method:'PATCH',body:'{"enabled":false}'})));
 },15000);
 it('schedules only human-approved queue with explicit connected owned account while sending stays OFF',async()=>{
  render(<YTPage/>);await screen.findByText('External posting is disabled');
  const approved=screen.getByText('Approved video').closest('article')!;
  const draft=screen.getByText('Draft video').closest('article')!;
  expect((within(approved).getByText('Schedule approved comment') as HTMLButtonElement).disabled).toBe(true);
  const select=screen.getByLabelText('Sender account');
  expect(within(select).queryByRole('option',{name:'Disconnected'})).toBeNull();
  fireEvent.change(select,{target:{value:ids.account}});
  expect((within(draft).getByText('Schedule approved comment') as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(within(approved).getByText('Schedule approved comment'));
  await waitFor(()=>expect(api).toHaveBeenCalledWith('/yt/queue/'+ids.queue+'/schedule',expect.objectContaining({method:'POST',body:JSON.stringify({account_id:ids.account})})));
  await screen.findByText('Scheduled account: Owned connected');
  expect((within(approved).getByText('Send') as HTMLButtonElement).disabled).toBe(true);
  expect(button('Connect Google').disabled).toBe(true);
 });
 it.each(['en','ru'])('keeps viewer read-only with localized provider status (%s)',async lang=>{
  state.lang=lang;state.role='viewer';render(<YTPage/>);
  await screen.findByText(lang==='ru'?'Внешняя публикация выключена':'External posting is disabled');
  expect(button(lang==='ru'?'Добавить канал':'Add channel').disabled).toBe(true);
  expect((screen.getByLabelText(lang==='ru'?'Аккаунт отправителя':'Sender account') as HTMLSelectElement).disabled).toBe(true);
  expect(screen.getByText(lang==='ru'?'Только просмотр: действия недоступны для вашей роли.':'Read-only: your role cannot perform actions.')).toBeTruthy();
 });
 it.each(['en','ru'])('shows localized load failure and recovers on retry (%s)',async lang=>{
  state.lang=lang;state.fail=true;render(<YTPage/>);
  await screen.findByRole('alert');
  expect(screen.queryByText(lang==='ru'?'Очередь пуста':'Queue is empty')).toBeNull();
  state.fail=false;fireEvent.click(button(lang==='ru'?'Повторить':'Retry'));
  await screen.findByText('Approved video');expect(screen.queryByRole('alert')).toBeNull();
 });
 it('shows schedule rejection without claiming a saved binding',async()=>{
  state.mutationFail=true;render(<YTPage/>);await screen.findByText('Approved video');
  fireEvent.change(screen.getByLabelText('Sender account'),{target:{value:ids.account}});
  fireEvent.click(within(screen.getByText('Approved video').closest('article')!).getByText('Schedule approved comment'));
  await screen.findByRole('alert');expect(screen.queryByText('Scheduled account: Owned connected')).toBeNull();
 });
});

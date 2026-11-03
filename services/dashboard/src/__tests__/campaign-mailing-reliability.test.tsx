import { render, screen, cleanup, fireEvent, waitFor, act } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const toast=vi.hoisted(()=>vi.fn());
const s=vi.hoisted(()=>({platform:'telegram',token:'fixture',getCampaigns:vi.fn(),getMailings:vi.fn(),createMailing:vi.fn(),getMailing:vi.fn(),getCampaignStats:vi.fn(),createCampaign:vi.fn()}));
vi.mock('@/lib/auth',()=>({useAuth:()=>({auth:s.token?{token:s.token}:null})}));
vi.mock('@/lib/platform',()=>({usePlatform:()=>({platform:s.platform})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({t:(k:string)=>k})}));
vi.mock('@/components/Toast',()=>({useToast:()=>({toast})}));
vi.mock('@/components/PlanGuard',()=>({PlanGuard:({children}:any)=>children}));
vi.mock('@/components/FieldHint',()=>({FieldHint:()=>null}));
vi.mock('@/components/GlassChart',()=>({GlassBarStatic:()=>null}));
vi.mock('@/lib/api',()=>({getCampaigns:s.getCampaigns,getMailings:s.getMailings,createMailing:s.createMailing,getMailing:s.getMailing,getCampaignStats:s.getCampaignStats,createCampaign:s.createCampaign}));
import Campaigns from '@/app/(dashboard)/campaigns/page';
import Mailings from '@/app/(dashboard)/mailings/page';
const campaign={id:'c',name:'Synthetic campaign',base_text:'test',target_geos:[],target_niches:[],media_urls:[],is_active:true,ab_variants:[]};
const mailing={id:'m',name:'Synthetic mailing',message_text:'test',platform:'telegram',status:'draft',total_count:0,sent_count:0,read_count:0,failed_count:0,delay_seconds:30};
beforeEach(()=>{vi.resetAllMocks();s.platform='telegram';s.token='fixture';s.getCampaigns.mockResolvedValue({items:[campaign]});s.getMailings.mockResolvedValue({items:[mailing]});});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('rejected read-check HTTP is an error, never scheduled success',async()=>{
 s.getMailing.mockResolvedValue({...mailing,status:'completed',sent_count:1});
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:503}));
 render(<Mailings/>);fireEvent.click(await screen.findByText(mailing.name));
 fireEvent.click(await screen.findByRole('button',{name:'mailings.checkReads'}));
 await waitFor(()=>expect(toast).toHaveBeenCalledWith('mailings.readCheckFailed','error'));
 expect(toast).not.toHaveBeenCalledWith('mailings.readCheckScheduled','success');
});
for(const [Component,get,row] of [[Campaigns,s.getCampaigns,campaign],[Mailings,s.getMailings,mailing]] as const){
 it(`${row.id}: list failure is not empty success; retry retains rows after refresh failure`,async()=>{
 get.mockRejectedValueOnce(new Error('synthetic failure'));render(<Component/>);
 expect(await screen.findByRole('alert')).toBeTruthy();expect(screen.queryByText(row.id==='c'?'campaigns.empty':'mailings.empty')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'common.retry'}));await screen.findByText(row.name);
 get.mockRejectedValueOnce(new Error('refresh failure'));fireEvent.click(screen.getByRole('button',{name:'common.refresh'}));
 await screen.findByRole('alert');expect(screen.getByText(row.name)).toBeTruthy();
 });
}

for(const [Component,get,row] of [[Campaigns,s.getCampaigns,campaign],[Mailings,s.getMailings,mailing]] as const){
 it(`${row.id}: clears rows on platform/token change and rejects late lists`,async()=>{
 let finish!:(v:any)=>void;get.mockImplementationOnce(()=>new Promise(r=>finish=r));
 const view=render(<Component/>);s.platform='vkontakte';get.mockResolvedValue({items:[{...row,name:'New scope'}]});view.rerender(<Component/>);
 await screen.findByText('New scope');await act(async()=>finish({items:[row]}));expect(screen.queryByText(row.name)).toBeNull();
 s.token='';view.rerender(<Component/>);expect(screen.queryByText('New scope')).toBeNull();
 });
 it(`${row.id}: closes open creation form when platform changes`,async()=>{
 const view=render(<Component/>);await screen.findByText(row.name);
 fireEvent.click(screen.getByRole('button',{name:row.id==='c'?'campaigns.newCampaign':'mailings.newMailing'}));
 expect(document.querySelector('form')).toBeTruthy();s.platform='vkontakte';view.rerender(<Component/>);
 await waitFor(()=>expect(document.querySelector('form')).toBeNull());
 });
}
it('MAX creation and reset stay MAX; label is not Telegram',async()=>{
 s.platform='max';s.createMailing.mockResolvedValue({});render(<Mailings/>);await screen.findByText(mailing.name);
 const create=()=>fireEvent.click(screen.getByRole('button',{name:'mailings.newMailing'}));
 for(let n=0;n<2;n++){
 create();expect(screen.getByText('MAX')).toBeTruthy();
 fireEvent.change(screen.getByPlaceholderText('mailings.namePlaceholder'),{target:{value:'Synthetic'}});
 fireEvent.change(screen.getByPlaceholderText('mailings.messagePlaceholder'),{target:{value:'Synthetic text'}});
 fireEvent.submit(document.querySelector('form')!);await waitFor(()=>expect(s.createMailing).toHaveBeenCalledTimes(n+1));
 await waitFor(()=>expect(document.querySelector('form')).toBeNull());
 expect(s.createMailing.mock.calls[n][1].platform).toBe('max');
 }
});

it('late create completion cannot close or refresh the new platform form',async()=>{
 let finish!:(v:any)=>void;s.createMailing.mockImplementation(()=>new Promise(r=>finish=r));
 const view=render(<Mailings/>);await screen.findByText(mailing.name);
 fireEvent.click(screen.getByRole('button',{name:'mailings.newMailing'}));fireEvent.submit(document.querySelector('form')!);
 s.platform='vkontakte';view.rerender(<Mailings/>);await waitFor(()=>expect(document.querySelector('form')).toBeNull());
 fireEvent.click(screen.getByRole('button',{name:'mailings.newMailing'}));
 const calls=s.getMailings.mock.calls.length;await act(async()=>finish({}));
 expect(document.querySelector('form')).toBeTruthy();expect(s.getMailings).toHaveBeenCalledTimes(calls);
});
it('late detail response cannot reopen a mailing from another token',async()=>{
 let finish!:(v:any)=>void;s.getMailing.mockImplementation(()=>new Promise(r=>finish=r));
 const view=render(<Mailings/>);fireEvent.click(await screen.findByText(mailing.name));
 s.token='new-fixture';view.rerender(<Mailings/>);await act(async()=>finish({...mailing,name:'Old detail'}));
 expect(screen.queryByText('Old detail')).toBeNull();
});

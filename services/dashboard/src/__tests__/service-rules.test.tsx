import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react';
const state=vi.hoisted(()=>({platform:'telegram',token:'synthetic'}));
const api=vi.hoisted(()=>({getScoringRules:vi.fn(),createScoringRule:vi.fn(),deleteScoringRule:vi.fn()}));
vi.mock('@/lib/platform',()=>({usePlatform:()=>({platform:state.platform})}));
vi.mock('@/lib/auth',()=>({useAuth:()=>({auth:{token:state.token}})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({t:(key:string)=>key,locale:'ru'})}));
vi.mock('@/components/FieldHint',()=>({FieldHint:()=>null}));
vi.mock('@/lib/api',()=>api);
import LeadRules from '@/app/(dashboard)/lead-rules/page';
import Scoring from '@/app/(dashboard)/scoring/page';
beforeEach(()=>{cleanup();vi.clearAllMocks();state.platform='telegram';state.token='synthetic';api.getScoringRules.mockResolvedValue([]);api.createScoringRule.mockResolvedValue({});api.deleteScoringRule.mockResolvedValue({});vi.spyOn(window,'confirm').mockReturnValue(true)});
for(const [name,Page] of [['rules',LeadRules],['legacy-scoring',Scoring]] as const){
 for(const service of ['telegram','vkontakte','whatsapp','facebook','max','youtube']){
  it(`${name}: reads only ${service}`,async()=>{state.platform=service;render(<Page/>);await waitFor(()=>expect(api.getScoringRules).toHaveBeenCalledWith('synthetic',service))});
 }
 it(`${name}: create and delete keep selected service`,async()=>{
  state.platform='vkontakte';api.getScoringRules.mockResolvedValue([{id:'rule-vk',name:'synthetic-rule',intent:'WARM',keywords:['marker'],priority:5,min_confidence:.5}]);render(<Page/>);
  const prefix=name==='rules'?'leadRules':'scoring';
  await screen.findByText('synthetic-rule');fireEvent.click(screen.getByText(prefix+'.newRule'));
  const form=document.querySelector('form')!;const inputs=form.querySelectorAll('input');
  fireEvent.change(inputs[0],{target:{value:'VK rule'}});fireEvent.change(inputs[1],{target:{value:'marker'}});fireEvent.submit(form);
  await waitFor(()=>expect(api.createScoringRule).toHaveBeenCalledWith('synthetic',expect.objectContaining({service:'vkontakte',name:'VK rule'})));
  const del=await screen.findByText(prefix+'.delete');fireEvent.click(del);await waitFor(()=>expect(api.deleteScoringRule).toHaveBeenCalledWith('synthetic','rule-vk','vkontakte'));
 });
 it(`${name}: platform switch rejects delayed previous-service rows`,async()=>{
  let resolve!:(v:any)=>void;api.getScoringRules.mockImplementationOnce(()=>new Promise(r=>{resolve=r})).mockResolvedValue([]);
  const view=render(<Page/>);state.platform='vkontakte';view.rerender(<Page/>);
  await waitFor(()=>expect(api.getScoringRules).toHaveBeenCalledWith('synthetic','vkontakte'));resolve([{id:'old',name:'TG stale',intent:'SPAM',keywords:[],priority:1,min_confidence:.5}]);
  await new Promise(r=>setTimeout(r,0));expect(screen.queryByText('TG stale')).toBeNull();
 });
}

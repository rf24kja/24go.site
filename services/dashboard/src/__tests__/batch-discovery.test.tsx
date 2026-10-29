import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
const state=vi.hoisted(()=>({platform:'telegram',lang:'en',role:'member'}));
vi.mock('@/lib/auth',()=>({useAuth:()=>({auth:{token:'synthetic',user:{role:state.role}}})}));
vi.mock('@/lib/platform',()=>({usePlatform:()=>({platform:state.platform})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({lang:state.lang,t:(s:string)=>s})}));
vi.mock('@/components/Toast',()=>({useToast:()=>({toast:vi.fn()})}));
import TargetsPage from '@/app/(dashboard)/targets/page';
afterEach(()=>{cleanup();vi.unstubAllGlobals();state.platform='telegram';state.lang='en';state.role='member';});
for (const [geos,niches,limit] of [['','travel','20'],['a,a','travel','20'],['a,b,c','x,y,z','20'],['a,b,c,d','travel','20'],['x'.repeat(101),'travel','20'],['a','x,','20'],['a','x','0'],['a','x','21'],['a','x','1.5']]) it(`rejects invalid batch ${geos.length}/${niches}/${limit} before POST`,async()=>{
 const fetcher=vi.fn(async(_url: any, _opts?: any)=>new Response(JSON.stringify({items:[]})));vi.stubGlobal('fetch',fetcher);render(<TargetsPage/>);
 fireEvent.change(screen.getByLabelText('Batch GEOs'),{target:{value:geos}});fireEvent.change(screen.getByLabelText('Batch niches'),{target:{value:niches}});fireEvent.change(screen.getByLabelText('Results per query'),{target:{value:limit}});
 fireEvent.click(screen.getByRole('button',{name:'Run batch discovery'}));await screen.findByRole('alert');expect(fetcher.mock.calls.some(([u])=>String(u).includes('tasks/parser'))).toBe(false);
});
for (const lang of ['en','ru']) it(`disables viewer batch mutations in ${lang}`,async()=>{
 state.lang=lang;state.role='viewer';const fetcher=vi.fn(async(_url: any, _opts?: any)=>new Response(JSON.stringify({items:[]})));vi.stubGlobal('fetch',fetcher);render(<TargetsPage/>);
 const button=screen.getByRole('button',{name:lang==='ru'?'Запустить пакетный поиск':'Run batch discovery'});expect(button.hasAttribute('disabled')).toBe(true);fireEvent.click(button);await waitFor(()=>expect(fetcher).toHaveBeenCalled());expect(fetcher.mock.calls.some(([u])=>String(u).includes('tasks/parser'))).toBe(false);
});
for (const platform of ['whatsapp','facebook','max']) it(`does not expose batch discovery for ${platform}`,async()=>{state.platform=platform;vi.stubGlobal('fetch',vi.fn(async(_url: any, _opts?: any)=>new Response(JSON.stringify({items:[]}))));render(<TargetsPage/>);expect(screen.queryByRole('button',{name:'Run batch discovery'})).toBeNull();await waitFor(()=>expect(screen.queryByText('targets.loading')).toBeNull());});
it('reports VK total failure and request failure without claiming success or leaking server text',async()=>{
 state.platform='vkontakte';let reject=false;const fetcher=vi.fn(async(url: any,opts: any)=>new Response(JSON.stringify(String(url).includes('tasks/parser')?(reject?{detail:'SECRET-provider-value'}:{status:'failed',execution:'synchronous',atomic:false,completed_queries:0,total_queries:1,queries:[{platform:'vkontakte',geo_tag:'Moscow',niche:'travel',status:'failed',error:'discovery_failed',http_status:409,persistence_may_be_partial:true}]}):{items:[]}),{status:reject&&String(url).includes('tasks/parser')?503:200}));vi.stubGlobal('fetch',fetcher);render(<TargetsPage/>);
 fireEvent.click(screen.getByRole('button',{name:'Run batch discovery'}));await screen.findByText('All queries failed: 0/1');expect(JSON.parse(fetcher.mock.calls.find(([u])=>String(u).includes('tasks/parser'))![1].body).platforms).toEqual(['vkontakte']);reject=true;
 fireEvent.click(screen.getByRole('button',{name:'Run batch discovery'}));await screen.findByRole('alert');expect(screen.queryByText(/SECRET-provider/)).toBeNull();expect(screen.getByText('All queries failed: 0/1')).toBeTruthy();
});
it('submits scoped batch and retains partial query outcomes while refreshing saved targets',async()=>{
 const fetcher=vi.fn(async(url: any,opts: any)=>new Response(JSON.stringify(String(url).includes('tasks/parser')?{status:'partial',execution:'synchronous',atomic:false,completed_queries:1,total_queries:2,queries:[{platform:'telegram',geo_tag:'Moscow',niche:'travel',status:'completed',total:1,results:[{title:'Synthetic group'}]},{platform:'telegram',geo_tag:'Bangkok',niche:'travel',status:'failed',error:'query_timeout',persistence_may_be_partial:true}]}:{items:[]})));
 vi.stubGlobal('fetch',fetcher);render(<TargetsPage/>);
 fireEvent.change(screen.getByLabelText('Batch GEOs'),{target:{value:'Moscow, Bangkok'}});
 fireEvent.change(screen.getByLabelText('Batch niches'),{target:{value:'travel'}});
 fireEvent.click(screen.getByRole('button',{name:'Run batch discovery'}));
 await screen.findByText('Partial completion: 1/2');
 expect(screen.getByText(/Bangkok.*travel/)).toBeTruthy();expect(screen.getByText('Synthetic group')).toBeTruthy();
 const calls=fetcher.mock.calls.filter(([u])=>String(u).includes('tasks/parser'));
 expect(calls).toHaveLength(1);expect(JSON.parse(calls[0][1].body)).toEqual({platforms:['telegram'],target_geos:['Moscow','Bangkok'],niches:['travel'],max_results_per_niche:20});
 await waitFor(()=>expect(fetcher.mock.calls.filter(([u])=>String(u).includes('/targets')).length).toBeGreaterThan(1));
});

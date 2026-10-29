import {render, screen, fireEvent, waitFor, cleanup} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
const state=vi.hoisted(()=>({lang:'en',toast:vi.fn()}));
vi.mock('@/lib/auth',()=>({useAuth:()=>({auth:{token:'synthetic'}})}));
vi.mock('@/lib/platform',()=>({usePlatform:()=>({platform:'vkontakte'})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({lang:state.lang,t:(s:string)=>s})}));
vi.mock('@/components/Toast',()=>({useToast:()=>({toast:state.toast})}));
import TargetsPage from '@/app/(dashboard)/targets/page';
afterEach(()=>{cleanup();vi.unstubAllGlobals();state.toast.mockClear();});
for(const lang of ['en','ru']) for(const [code,hint] of [['vk_discovery_not_connected',lang==='ru'?'Интеграции':'Integrations'],['vk_encryption_unavailable',lang==='ru'?'Безопасное хранилище':'Secure storage'],['vk_unavailable',lang==='ru'?'Повторите позже':'Retry later']]) it(`offers secure onboarding and ${code} error in ${lang}`,async()=>{
 state.lang=lang;
 vi.stubGlobal('fetch',vi.fn(async(url)=>new Response(JSON.stringify(String(url).includes('groups/discover')?{detail:{code}}:{items:[]}),{status:String(url).includes('groups/discover')?409:200})));
 render(<TargetsPage/>);
 expect(screen.getByRole('link',{name:lang==='ru'?'Подключить пользовательский токен VK':'Connect VK user token'}).getAttribute('href')).toBe('/VK/integrations');
 fireEvent.click(screen.getByText('targets.scan'));
 await waitFor(()=>expect(state.toast).toHaveBeenCalledWith(expect.stringContaining(hint),'error'));
});

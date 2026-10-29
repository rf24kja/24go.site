import { render, cleanup } from '@testing-library/react';
import { expect, it, vi, afterEach } from 'vitest';
const state=vi.hoisted(()=>({platform:'whatsapp',lang:'en'}));
vi.mock('@/lib/platform',()=>({usePlatform:()=>({platform:state.platform})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({lang:state.lang,t:(k:string)=>k})}));
vi.mock('next/link',()=>({default:({children,...props}:any)=><a {...props}>{children}</a>}));
import Help from '@/app/(dashboard)/help/page';
import { PlatformHelp } from '@/components/PlatformHelp';
import { routePlatform } from '@/lib/platform-routes';
vi.stubGlobal('IntersectionObserver',class { observe(){} disconnect(){} unobserve(){} });
afterEach(cleanup);
it('provides allowlisted platform help without exposing other platform routes',()=>{
 for(const [prefix,p] of [['WA','whatsapp'],['MAX','max'],['FB','facebook']])expect(routePlatform('/'+prefix+'/help')).toBe(p);
 expect(routePlatform('/FB/targets')).toBeNull(); expect(routePlatform('/MAX/campaigns')).toBeNull();
});
it('renders localized actionable help with platform-only links and security limits',()=>{
 for(const [p,prefix,name] of [['telegram','TG','Telegram'],['vkontakte','VK','VK'],['whatsapp','WA','WhatsApp'],['max','MAX','MAX'],['facebook','FB','Facebook']])for(const lang of ['ru','en']){
 state.platform=p;state.lang=lang;const v=render(state.platform==='telegram'||state.platform==='vkontakte'?<PlatformHelp/>:<Help/>);
 expect(v.container.textContent).toContain(name);
 expect(v.container.textContent).toContain(lang==='ru'?'защищён':'secure');
 const links=Array.from(v.container.querySelectorAll('a')).map(a=>a.getAttribute('href'));
 expect(links).toContain('/'+prefix+'/accounts');
 for(const href of links)expect(href==='/billing'||href?.startsWith('/'+prefix+'/')).toBe(true);
 v.unmount();
 }
});

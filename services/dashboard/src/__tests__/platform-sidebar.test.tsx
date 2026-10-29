import { render, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({platform:'telegram'}));
vi.mock('@/lib/platform',()=>({usePlatform:()=>({platform:state.platform,setPlatform:vi.fn()})}));
vi.mock('@/lib/auth',()=>({useAuth:()=>({auth:{token:'fixture',user:{role:'owner',tenant_id:'fixture'}},logout:vi.fn()})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({t:(k:string)=>k,lang:'ru',setLang:vi.fn()})}));
vi.mock('@/lib/useWebSocket',()=>({useWebSocket:()=>({connected:false})}));
vi.mock('@/components/Toast',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('@/hooks/usePlanAccess',()=>({usePlanAccess:()=>({hasAccess:()=>true})}));
vi.mock('next/navigation',()=>({usePathname:()=>'/TG/settings',useRouter:()=>({push:vi.fn()})}));
vi.mock('next/link',()=>({default:({children,...props}:any)=><a {...props}>{children}</a>}));
import { Sidebar } from '@/components/Sidebar';
import { PREFIXES, Platform } from '@/lib/platform-routes';
afterEach(cleanup);
it('renders every menu link under its selected platform with Billing as the sole exception',()=>{
 for(const p of Object.keys(PREFIXES) as Platform[]){
  state.platform=p;const view=render(<Sidebar/>);
  const links=Array.from(view.container.querySelectorAll('aside nav a')).map(a=>a.getAttribute('href'));
  expect(links.length).toBeGreaterThan(2);
  expect(links).toContain('/billing');expect(links).toContain('/'+PREFIXES[p]+'/settings');
  for(const href of links)expect(href==='/billing'||href?.startsWith('/'+PREFIXES[p]+'/')).toBe(true);
  view.unmount();
 }
});

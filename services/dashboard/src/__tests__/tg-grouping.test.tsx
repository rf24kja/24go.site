import { render, cleanup } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
const state=vi.hoisted(()=>({platform:'telegram',path:'/TG/lead-rules'}));
vi.mock('@/lib/platform',()=>({usePlatform:()=>({platform:state.platform,setPlatform:vi.fn()})}));
vi.mock('@/lib/auth',()=>({useAuth:()=>({auth:{token:'fixture',user:{email:'other@example.com',role:'owner',tenant_id:'fixture'}},logout:vi.fn()})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({t:(k:string)=>k,lang:'en',setLang:vi.fn()})}));
vi.mock('@/lib/useWebSocket',()=>({useWebSocket:()=>({connected:false})}));
vi.mock('@/components/Toast',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('@/hooks/usePlanAccess',()=>({usePlanAccess:()=>({hasAccess:()=>true})}));
vi.mock('next/navigation',()=>({usePathname:()=>state.path,useRouter:()=>({push:vi.fn()})}));
vi.mock('next/link',()=>({default:({children,...props}:any)=><a {...props}>{children}</a>}));
import {Sidebar} from '@/components/Sidebar';
afterEach(cleanup);
it('groups TG tasks without exposing rules proxies diagnostics or blog as primary navigation',()=>{const v=render(<Sidebar/>);const links=Array.from(v.container.querySelectorAll('aside nav a')).map(a=>a.getAttribute('href'));expect(links).not.toContain('/TG/lead-rules');expect(links).not.toContain('/TG/proxies');expect(links).not.toContain('/TG/health');expect(links).not.toContain('/TG/blog-admin');expect(links).toContain('/TG/targets');expect(v.container.querySelector('a[href="/TG/leads"]')?.getAttribute('aria-current')).toBe('page');});

it('consolidates VK primary entries and keeps nested route active',()=>{state.platform='vkontakte';state.path='/VK/lead-rules';const v=render(<Sidebar/>);const links=Array.from(v.container.querySelectorAll('aside nav a')).map(a=>a.getAttribute('href'));for(const page of ['lead-rules','groups','proxies','health','blog-admin'])expect(links).not.toContain('/VK/'+page);for(const page of ['leads','targets','accounts','settings'])expect(links).toContain('/VK/'+page);expect(v.container.querySelector('a[href="/VK/leads"]')?.getAttribute('aria-current')).toBe('page');state.platform='telegram';state.path='/TG/lead-rules';});

import {render,cleanup,screen} from '@testing-library/react';
import {afterEach,expect,it,vi} from 'vitest';
const state=vi.hoisted(()=>({platform:'telegram',path:'/TG/groups',lang:'en'}));
vi.mock('@/lib/platform',()=>({usePlatform:()=>({platform:state.platform})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({lang:state.lang})}));
vi.mock('next/navigation',()=>({usePathname:()=>state.path}));
vi.mock('next/link',()=>({default:({children,...p}:any)=><a {...p}>{children}</a>}));
import {WorkspaceTabs} from '@/components/WorkspaceTabs';
afterEach(cleanup);
it('retains both real route destinations and marks the current tab for all TG workspaces in both locales',()=>{for(const lang of ['en','ru'])for(const pair of [['leads','lead-rules'],['targets','groups'],['accounts','proxies'],['settings','health']])for(const page of pair){state.path='/TG/'+page;state.lang=lang;const v=render(<WorkspaceTabs/>);const a=Array.from(v.container.querySelectorAll('a'));expect(a.map(x=>x.getAttribute('href'))).toEqual(pair.map(x=>'/TG/'+x));expect(a.filter(x=>x.getAttribute('aria-current')==='page').map(x=>x.getAttribute('href'))).toEqual(['/TG/'+page]);v.unmount();}});
it('does not add unrelated platform workspace navigation',()=>{state.platform='youtube';const v=render(<WorkspaceTabs/>);expect(v.container.textContent).toBe('');state.platform='telegram';});

it('groups all VK routes with selected service destinations in RU and EN',()=>{state.platform='vkontakte';for(const lang of ['en','ru'])for(const pair of [['leads','lead-rules'],['targets','groups'],['accounts','proxies'],['settings','health']])for(const page of pair){state.path='/VK/'+page;state.lang=lang;const v=render(<WorkspaceTabs/>);const a=Array.from(v.container.querySelectorAll('a'));expect(a.map(x=>x.getAttribute('href'))).toEqual(pair.map(x=>'/VK/'+x));expect(a.filter(x=>x.getAttribute('aria-current')==='page').map(x=>x.getAttribute('href'))).toEqual(['/VK/'+page]);expect(v.container.textContent).not.toContain('Telegram only');v.unmount();}state.platform='telegram';});

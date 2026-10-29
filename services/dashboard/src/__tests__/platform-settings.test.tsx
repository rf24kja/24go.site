import { render, screen, cleanup, waitFor, fireEvent } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
const state=vi.hoisted(()=>({platform:'facebook',get:vi.fn().mockResolvedValue({settings:{},defaults:{}}),save:vi.fn().mockResolvedValue({})}));
vi.mock('@/lib/auth',()=>({useAuth:()=>({auth:{token:'fixture'}})}));
vi.mock('@/lib/platform',()=>({usePlatform:()=>({platform:state.platform})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({t:(k:string)=>k,lang:'ru'})}));
vi.mock('@/lib/api',()=>({getTenantSettings:state.get,updateSettingsSection:state.save}));
vi.mock('next/link',()=>({default:({children,...props}:any)=><a {...props}>{children}</a>}));
import Settings from '@/app/(dashboard)/settings/page';
afterEach(cleanup);
it('shows explicit settings platform destinations and no Telegram-only tabs in Facebook',async()=>{
 state.platform='facebook';render(<Settings/>);
 await waitFor(()=>expect(state.get).toHaveBeenCalledWith('fixture','facebook'));
 for(const p of ['TG','VK','WA','FB','MAX'])expect(screen.getByRole('link',{name:p}).getAttribute('href')).toBe('/'+p+'/settings');
 expect(screen.queryByRole('button',{name:'settings.section.tgstat'})).toBeNull();
 expect(screen.queryByRole('button',{name:'settings.section.warmup'})).toBeNull();
});
it('saves VK settings with the selected service and keeps legacy integrations reachable',async()=>{
 state.platform='vkontakte';render(<Settings/>);
 await waitFor(()=>expect(screen.getByRole('button',{name:'settings.save'})).toBeTruthy());
 fireEvent.click(screen.getByRole('button',{name:'settings.save'}));
 await waitFor(()=>expect(state.save).toHaveBeenCalledWith('fixture','ai_auto_reply',expect.any(Object),'vkontakte'));
 expect(screen.getByRole('link',{name:'VK API'}).getAttribute('href')).toBe('/VK/integrations');
});

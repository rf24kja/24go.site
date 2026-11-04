import {render,screen,cleanup} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
vi.mock('@/lib/auth',()=>({useAuth:()=>({auth:{token:'synthetic',user:{role:'member'}}})}));
vi.mock('@/lib/platform',()=>({usePlatform:()=>({platform:'telegram'})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({lang:'en',t:(s:string)=>s})}));
vi.mock('@/components/Toast',()=>({useToast:()=>({toast:vi.fn()})}));
import TargetsPage from '@/app/(dashboard)/targets/page';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('has one free search form and labels stored GEO as requested not verified',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({items:[],total:0}))));render(<TargetsPage/>);
 expect(screen.getAllByRole('textbox')).toHaveLength(2);
 expect(screen.getByText(/Requested GEO/)).toBeTruthy();
 expect(screen.getByText(/Members ↓/)).toBeTruthy();
});

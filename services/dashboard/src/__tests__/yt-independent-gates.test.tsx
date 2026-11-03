import {render,screen,fireEvent,cleanup} from '@testing-library/react';
import {it,expect,vi,afterEach} from 'vitest';
import YTPage from '../app/(dashboard)/YT/page';
const s=vi.hoisted(()=>({tab:'accounts',caps:{} as Record<string,boolean>}));
vi.mock('next/navigation',()=>({usePathname:()=>'/YT/'+s.tab}));
vi.mock('@/lib/auth',()=>({useAuth:()=>({auth:{token:'synthetic',user:{role:'owner'}}})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({lang:'en'})}));
vi.mock('@/lib/api',()=>({api:vi.fn(async(p:string)=>p.endsWith('capabilities')?s.caps:p.endsWith('accounts')?[{id:'a',name:'Account',status:'connected'}]:p.endsWith('channels')?[{id:'c',name:'Channel',enabled:true}]:p.endsWith('templates')?[{id:'t',name:'Template'}]:[{id:'q',title:'Approved',status:'approved',approved_by:'human'},{id:'d',title:'Draft',status:'draft'}])}));
afterEach(cleanup);
it.each([
 [{oauth_enabled:true,monitoring_enabled:false,posting_enabled:false,oauth_configured:true,external_enabled:false},false,true,true],
 [{oauth_enabled:false,monitoring_enabled:true,posting_enabled:false,oauth_configured:true,external_enabled:true},true,false,true],
 [{oauth_enabled:true,monitoring_enabled:false,posting_enabled:true,oauth_configured:false},true,true,false],
 [{external_enabled:true,posting_enabled:true,oauth_configured:true},false,false,false],
 [{external_enabled:true,posting_enabled:false},true,false,true],
])('independent login/scan/send gates %#',async(caps,connect,scan,send)=>{
 s.caps=caps;s.tab='accounts';const a=render(<YTPage/>);await screen.findByText('Account · connected');expect((screen.getByText('Connect Google') as HTMLButtonElement).disabled).toBe(connect);a.unmount();
 s.tab='channels';const c=render(<YTPage/>);await screen.findByText('Channel');fireEvent.change(screen.getByLabelText('Monitoring template'),{target:{value:'t'}});expect((screen.getByText('Scan') as HTMLButtonElement).disabled).toBe(scan);c.unmount();
 s.tab='queue';render(<YTPage/>);await screen.findByText('Approved');fireEvent.change(screen.getByLabelText('Sender account'),{target:{value:'a'}});const buttons=screen.getAllByText('Send') as HTMLButtonElement[];expect(buttons[0].disabled).toBe(send);expect(buttons[1].disabled).toBe(true);
});

import {render,screen,fireEvent,waitFor,cleanup} from '@testing-library/react';
import {it,vi,expect,afterEach} from 'vitest';
import Page from '@/app/(dashboard)/contacts/page';
import * as api from '@/lib/api';
vi.mock('@/lib/auth',()=>({useAuth:()=>({auth:{token:'fixture'}})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({t:(k:string)=>k})}));
vi.mock('@/components/Toast',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('@/lib/api',()=>({getContacts:vi.fn(async()=>({items:Array.from({length:50},(_,i)=>({id:String(i),phone:'fixture'+i,tags:['chosen'],platforms:{}})),total:65})),getContactStats:vi.fn(async()=>({total:65})),exportContactsCsv:vi.fn(async()=>new Blob()),refreshPlatforms:vi.fn(),bulkTagContacts:vi.fn(),checkPlatforms:vi.fn()}));
afterEach(()=>{cleanup();vi.clearAllMocks()});
it('disables unavailable filters and exports current filters without page',async()=>{
 URL.createObjectURL=vi.fn(()=> 'blob:fixture');URL.revokeObjectURL=vi.fn();vi.spyOn(HTMLAnchorElement.prototype,'click').mockImplementation(()=>{});
 render(<Page/>);await waitFor(()=>expect(screen.getAllByText('fixture0').length).toBeGreaterThan(0));
 expect(screen.getByRole('combobox',{name:'contacts.country'})).toBeDisabled();
 expect(screen.getByRole('combobox',{name:'contacts.quality'})).toBeDisabled();
 fireEvent.change(screen.getAllByRole('combobox')[0],{target:{value:'whatsapp'}});
 fireEvent.change(screen.getByPlaceholderText('contacts.search'),{target:{value:'Match'}});
 await waitFor(()=>expect(api.getContacts).toHaveBeenLastCalledWith('fixture',expect.objectContaining({search:'Match',platform:'whatsapp'})));
 fireEvent.click(screen.getByText('contacts.exportCsv'));
 await waitFor(()=>expect(api.exportContactsCsv).toHaveBeenCalledWith('fixture',{search:'Match',platform:'whatsapp'}));
});
it('shows request errors instead of empty success',async()=>{
 vi.mocked(api.getContacts).mockRejectedValueOnce(new Error('fixture'));
 render(<Page/>);await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('contacts.loadFailed'));
 expect(screen.queryByText('contacts.empty')).not.toBeInTheDocument();
});

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, vi, expect } from 'vitest';
import ContactsPage from '@/app/(dashboard)/contacts/page';
vi.mock('@/lib/auth',()=>({useAuth:()=>({auth:{token:'fixture'}})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({t:(k:string)=>k})}));
vi.mock('@/components/Toast',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('@/lib/api',()=>({
 getContacts:vi.fn(async()=>({items:[],total:0})),getContactStats:vi.fn(async()=>({total:0})),
 exportContactsCsv:vi.fn(),refreshPlatforms:vi.fn(),bulkTagContacts:vi.fn(),
 checkPlatforms:vi.fn(async()=>({results:[{phone:'+79000000000',telegram:{exists:null,error:'phone_lookup_unsupported'},vkontakte:{exists:null,error:'phone_lookup_unsupported'},whatsapp:{exists:null,error:'account_not_connected'}}]})),
}));
describe('contact lookup errors',()=>{
 it('does not call unknown platform checks phone not found',async()=>{
  render(<ContactsPage/>);
  fireEvent.change(screen.getByPlaceholderText('contacts.phonePlaceholder'),{target:{value:'+79000000000'}});
  fireEvent.click(screen.getByText('contacts.checkPhone'));
  await waitFor(()=>expect(screen.getByText('+79000000000')).toBeInTheDocument());
  expect(screen.queryByText('contacts.phoneNotFound')).not.toBeInTheDocument();
  expect(screen.getByText('contacts.checkFailed')).toBeInTheDocument();
 });
});

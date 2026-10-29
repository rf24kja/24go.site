import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { vi, it, expect, beforeEach, afterEach } from 'vitest';
const s = vi.hoisted(() => ({ platform:'telegram', lang:'en', bulk:vi.fn(), add:vi.fn() }));
vi.mock('@/lib/auth',()=>({useAuth:()=>({auth:{token:'fixture'}})}));
vi.mock('@/lib/platform',()=>({usePlatform:()=>({platform:s.platform})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({lang:s.lang,t:(k:string)=>k})}));
vi.mock('@/components/Toast',()=>({useToast:()=>({toast:vi.fn()})}));
vi.mock('@/lib/api',()=>({getGroups:async()=>({items:[]}),getAccounts:async()=>({items:[]}),bulkImportGroups:s.bulk,addGroup:s.add}));
import Page from '@/app/(dashboard)/groups/page';
beforeEach(()=>{s.platform='telegram';s.lang='en';vi.clearAllMocks();s.bulk.mockResolvedValue({imported:1,skipped:1,errors:['fixture partial failure']});});
afterEach(cleanup);
function preview(text:string){fireEvent.click(screen.getByText('groups.bulkImport'));fireEvent.change(screen.getByRole('textbox'),{target:{value:text}});fireEvent.click(screen.getByText('groups.bulkPreview'));}
it('rejects an unrelated URL without extracting a Telegram username',async()=>{render(<Page/>);preview('https://evil.example/t.me/Good_name');expect(screen.getByRole('alert').textContent).toContain('telegram');expect(screen.queryByText('groups.bulkImportBtn')).toBeNull();expect(s.bulk).not.toHaveBeenCalled();});
it.each(['en','ru'])('valid mixed input retains duplicates and reports invalid line in %s',async lang=>{s.lang=lang;render(<Page/>);preview('@Good_name\nhttps://evil.example/@Other_name\nhttps://t.me/Good_name');expect(screen.getByRole('alert').textContent).toContain('2');fireEvent.click(screen.getByText('groups.bulkImportBtn'));await waitFor(()=>expect(s.bulk).toHaveBeenCalledWith('fixture',[{group_identifier:'@Good_name',platform:'telegram'},{group_identifier:'@Good_name',platform:'telegram'}]));expect(await screen.findByText('fixture partial failure')).toBeTruthy();});
it('platform changes invalidate the old preview',()=>{const v=render(<Page/>);preview('@Good_name');s.platform='vkontakte';v.rerender(<Page/>);expect(screen.queryByText('groups.bulkImportBtn')).toBeNull();});
it('editing invalidates the previous preview',()=>{render(<Page/>);preview('@Good_name');fireEvent.change(screen.getByRole('textbox'),{target:{value:'https://evil.example'}});expect(screen.queryByText('groups.bulkImportBtn')).toBeNull();});
it('Facebook URL is preserved literally and its guidance remains',async()=>{s.platform='facebook';render(<Page/>);preview('https://mbasic.facebook.com/groups/Abc-12/');fireEvent.click(screen.getByText('groups.bulkImportBtn'));await waitFor(()=>expect(s.bulk).toHaveBeenCalledWith('fixture',[{platform:'facebook',group_identifier:'https://mbasic.facebook.com/groups/Abc-12/'}]));expect(screen.getAllByText(/Facebook: connect an account/).length).toBeGreaterThan(0);});

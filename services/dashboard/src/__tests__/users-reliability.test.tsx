import { render, screen, cleanup, waitFor, fireEvent } from '@testing-library/react';
import { beforeEach, afterEach, expect, it, vi } from 'vitest';
const s=vi.hoisted(()=>({role:'owner',get:vi.fn(),invite:vi.fn(),update:vi.fn(),remove:vi.fn()}));
vi.mock('@/lib/auth',()=>({useAuth:()=>({auth:{token:'fixture',user:{id:'self',role:s.role}}})}));
vi.mock('@/lib/i18n',()=>({useI18n:()=>({t:(k:string)=>k})}));
vi.mock('@/lib/api',()=>({getUsers:s.get,inviteUser:s.invite,updateUserRole:s.update,removeUser:s.remove}));
vi.mock('@/components/PlanGuard',()=>({PlanGuard:({children}:any)=>children}));
vi.mock('@/components/FieldHint',()=>({FieldHint:()=>null}));
import Users from '@/app/(dashboard)/users/page';
const row={id:'other',email:'member@example.test',role:'member',created_at:'2026-01-01',is_active:true};
beforeEach(()=>{vi.resetAllMocks();s.role='owner';s.get.mockResolvedValue([row]);vi.spyOn(window,'confirm').mockReturnValue(true);});
afterEach(()=>{cleanup();vi.restoreAllMocks();});
it('distinguishes failed listing from empty success and retries',async()=>{
 s.get.mockRejectedValueOnce(new Error('list unavailable'));render(<Users/>);
 expect(await screen.findByRole('alert')).toHaveTextContent('list unavailable');
 expect(screen.queryByText('users.empty')).toBeNull();
 fireEvent.click(screen.getByRole('button',{name:'users.retry'}));
 expect(await screen.findByText(row.email)).toBeTruthy();expect(screen.queryByRole('alert')).toBeNull();
});
it('shows role failure, retains row and prevents duplicate pending mutations',async()=>{
 let reject!:(e:Error)=>void;s.update.mockImplementation(()=>new Promise((_,r)=>{reject=r}));render(<Users/>);
 await screen.findByText(row.email);const select=screen.getAllByRole('combobox')[1];
 fireEvent.change(select,{target:{value:'admin'}});
 expect(select).toBeDisabled();expect(screen.getByRole('button',{name:'users.remove'})).toBeDisabled();
 reject(new Error('role refused'));
 expect(await screen.findByRole('alert')).toHaveTextContent('role refused');expect(select).not.toBeDisabled();expect(s.get).toHaveBeenCalledTimes(1);
});
it('shows removal failure without removing the row and allows retry',async()=>{
 s.remove.mockRejectedValueOnce(new Error('remove refused')).mockResolvedValueOnce({});render(<Users/>);await screen.findByText(row.email);
 fireEvent.click(screen.getByRole('button',{name:'users.remove'}));expect(await screen.findByRole('alert')).toHaveTextContent('remove refused');expect(screen.getByText(row.email)).toBeTruthy();
 s.get.mockResolvedValue([]);fireEvent.click(screen.getByRole('button',{name:'users.remove'}));expect(await screen.findByText('users.empty')).toBeTruthy();
});
it('keeps member management controls hidden',async()=>{s.role='member';render(<Users/>);await screen.findByText(row.email);expect(screen.queryByRole('combobox')).toBeNull();expect(screen.queryByRole('button',{name:'users.remove'})).toBeNull();});

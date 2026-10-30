import {render,screen,fireEvent,waitFor} from '@testing-library/react';
import {vi,it,expect,beforeEach} from 'vitest';
import {WaTextSender} from './WaTextSender';
vi.mock('@/lib/api',()=>({api:vi.fn()}));
import {api} from '@/lib/api';
beforeEach(()=>{vi.mocked(api).mockReset();});
it('requires recipient confirmation, locks pending and unknown; never sends on render',async()=>{
 let resolve:any;vi.mocked(api).mockImplementation(()=>new Promise(r=>{resolve=r}));
 render(<WaTextSender token="fixture" accounts={[{id:'a',phone_number:'+15555550100',status:'connected'}]} readOnly={false} ru={false}/>);
 expect(api).not.toHaveBeenCalled();
 fireEvent.change(screen.getByLabelText('Recipient'),{target:{value:'+15555550101'}});
 fireEvent.change(screen.getByLabelText('Text'),{target:{value:'hello'}});
 fireEvent.click(screen.getByText('Send one text'));expect(api).not.toHaveBeenCalled();
 fireEvent.click(screen.getByRole('checkbox'));
 fireEvent.click(screen.getByText('Send one text'));fireEvent.click(screen.getByText('Sending…'));expect(api).toHaveBeenCalledTimes(1);
 resolve({status:'unknown'});await waitFor(()=>expect(screen.getByText(/Do not retry/)).toBeTruthy());
 expect((screen.getByText('Send one text') as HTMLButtonElement).disabled).toBe(true);
});

it('RU viewer cannot send and sees localized control',()=>{
 render(<WaTextSender token="fixture" accounts={[{id:'a',phone_number:'+15555550100',status:'connected'}]} readOnly={true} ru={true}/>);
 expect((screen.getByText('Отправить одно сообщение') as HTMLButtonElement).disabled).toBe(true);expect(api).not.toHaveBeenCalled();
});
it('failed permits explicitly reconfirmed retry; accepted is not delivery',async()=>{
 vi.mocked(api).mockResolvedValueOnce({status:'failed'}).mockResolvedValueOnce({status:'accepted'});
 render(<WaTextSender token="fixture" accounts={[{id:'a',phone_number:'+15555550100',status:'connected'}]} readOnly={false} ru={false}/>);
 fireEvent.change(screen.getByLabelText('Recipient'),{target:{value:'+15555550101'}});fireEvent.change(screen.getByLabelText('Text'),{target:{value:'hello'}});
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByText('Send one text'));await waitFor(()=>expect(screen.getByText(/Not sent/)).toBeTruthy());
 fireEvent.click(screen.getByText('Send one text'));expect(api).toHaveBeenCalledTimes(1);
 fireEvent.click(screen.getByRole('checkbox'));fireEvent.click(screen.getByText('Send one text'));await waitFor(()=>expect(screen.getByText(/delivery is not confirmed/)).toBeTruthy());expect(api).toHaveBeenCalledTimes(2);
});

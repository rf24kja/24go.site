import { render, screen, cleanup } from '@testing-library/react';
import { afterEach, describe, it, expect } from 'vitest';
import YTOAuthSetup from '../components/YTOAuthSetup';
afterEach(cleanup);
describe('YT OAuth actionable setup',()=>{
 it.each([true,false])('provides exact callback and distinct honest states, RU=%s',ru=>{
  render(<YTOAuthSetup ru={ru} configured={false} authenticated={false} monitoring={false} posting={false}/>);
  expect(screen.getByText('https://www.24go.site/YT/callback')).toBeTruthy();
  expect(screen.getByText('https://www.googleapis.com/auth/youtube.force-ssl')).toBeTruthy();
  expect(screen.getByRole('link',{name:ru?'Управление доступом в Google':'Manage access in Google'}).getAttribute('href')).toBe('https://myaccount.google.com/connections');
  expect(screen.getByRole('link',{name:ru?'К аккаунтам YouTube':'YouTube accounts'}).getAttribute('href')).toBe('/YT/accounts');
  expect(document.querySelectorAll('dt').length).toBe(5);
  expect(document.querySelectorAll('dd')[0].textContent).toBe(ru?'нет':'no');
 });
 it('does not describe configured or connected as provider/send permission',()=>{
  render(<YTOAuthSetup ru={false} configured authenticated monitoring={false} posting/>);
  const values=document.querySelectorAll('dd');
  expect(values[0].textContent).toBe('yes');
  expect(values[1].textContent).toContain('not a live Google access check');
  expect(values[2].textContent).toMatch(/^no/);
  expect(values[3].textContent).toMatch(/^no/);
  expect(values[4].textContent).toMatch(/^yes/);
 });
});

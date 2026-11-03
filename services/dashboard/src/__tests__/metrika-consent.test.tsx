import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import { vi, it, expect, beforeEach, afterEach } from 'vitest';
import CookieConsent from '@/components/CookieConsent';
import { isAnalyticsPage } from '@/components/YandexMetrika';

vi.mock('@/lib/i18n', () => ({ useI18n: () => ({ lang: 'en' }) }));
const route = vi.hoisted(() => ({ path: '/' }));
vi.mock('next/navigation', () => ({ usePathname: () => route.path }));
beforeEach(() => { route.path = '/'; localStorage.clear(); document.querySelectorAll('script[src*="mc.yandex.ru"]').forEach(s => s.remove()); delete window.ym; vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('requests analytics permission separately from historical essential-cookie acceptance', async () => {
  localStorage.setItem('24go_cookie_consent', 'accepted');
  const listener = vi.fn(); window.addEventListener('24go:analytics-consent', listener);
  render(<CookieConsent />);
  const accept = await screen.findByText('Accept');
  expect(screen.getByText(/Yandex.Metrica/)).toBeInTheDocument();
  fireEvent.click(accept);
  expect(localStorage.getItem('24go_analytics_consent_v1')).toBe('accepted');
  expect(listener).toHaveBeenCalledTimes(1);
  window.removeEventListener('24go:analytics-consent', listener);
});
it('loads the invisible counter only after explicit analytics acceptance', async () => {
  render(<CookieConsent />);
  expect(document.querySelector('script[src*="mc.yandex.ru/metrika/"]')).toBeNull();
  fireEvent.click(await screen.findByText('Accept'));
  await waitFor(() => expect(document.querySelector('script[src="https://mc.yandex.ru/metrika/tag.js?id=114036227"]')).not.toBeNull());
  expect(document.querySelector('img[src*="mc.yandex.ru/watch/"]')).toBeNull();
});
it.each(['/login','/register','/forgot-password','/reset-password','/TG/leads','/VK/accounts','/settings','/billing','/api/health'])('does not load analytics on private route %s', (path) => {
  route.path = path;
  localStorage.setItem('24go_analytics_consent_v1', 'accepted');
  render(<CookieConsent />);
  expect(isAnalyticsPage(path)).toBe(false);
  expect(document.querySelector('script[src*="mc.yandex.ru/"]')).toBeNull();
});
it('decline does not load analytics', async () => {
  render(<CookieConsent />);
  fireEvent.click(await screen.findByText('Decline'));
  expect(localStorage.getItem('24go_analytics_consent_v1')).toBe('declined');
  expect(document.querySelector('script[src*="mc.yandex.ru/"]')).toBeNull();
});
it('initializes the requested counter once and stops it when navigating to a private page', async () => {
  const view = render(<CookieConsent />);
  fireEvent.click(await screen.findByText('Accept'));
  const init = window.ym?.a?.find(args => args[1] === 'init');
  expect(init?.[0]).toBe(114036227);
  expect(init?.[2]).toMatchObject({ssr:true,webvisor:true,clickmap:true,ecommerce:'dataLayer',accurateTrackBounce:true,trackLinks:true});
  const ym = vi.fn(); window.ym = ym;
  route.path = '/TG/leads'; view.rerender(<CookieConsent />);
  await waitFor(() => expect(ym).toHaveBeenCalledWith(114036227, 'destruct'));
});

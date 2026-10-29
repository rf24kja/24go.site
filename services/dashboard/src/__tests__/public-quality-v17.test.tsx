import { expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nProvider, useI18n } from '@/lib/i18n';
import CookieConsent from '@/components/CookieConsent';
import en from '@/lib/en.json';
import ru from '@/lib/ru.json';
import publicEn from '@/lib/public-en.json';
import publicRu from '@/lib/public-ru.json';
const pages = import.meta.glob('../app/**/page.tsx');
const routes = ['features','pricing','tools','privacy','terms','integrations/amo-crm','integrations/bitrix24','integrations/google-sheets','integrations/hubspot','integrations/webhook','tutorials/telegram-auto-reply','tutorials/telegram-lead-scraping','tutorials/telegram-warmup'];
beforeEach(() => { cleanup(); localStorage.clear(); vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} }); });
it.each(routes)('localizes metadata and preserves alternates for %s', async route => {
 const page:any = await pages[`../app/${route}/page.tsx`]();
 const a = await page.generateMetadata({searchParams:{locale:'ru'}});
 const b = await page.generateMetadata({searchParams:{locale:'en'}});
 expect(a.title).not.toEqual(b.title); expect(a.description).not.toEqual(b.description);
 expect(JSON.stringify(a.title)).toMatch(/[А-Яа-я]/);
 expect(a.alternates.canonical).toBe(`https://www.24go.site/${route}?locale=ru`);
 expect(a.alternates.languages.en).toBe(`https://www.24go.site/${route}?locale=en`);
 const html = renderToStaticMarkup(await page.default({searchParams:{locale:'ru'}}));
 expect(html).not.toMatch(/历史数据|nunca|rates ответов|всего воронки/);
});
function Switch(){const {setLang}=useI18n();return <button onClick={()=>setLang('en')}>switch</button>}
it('switches cookie copy inside locale scope and retains consent storage', () => {
 render(<I18nProvider initialLang="ru"><Switch/><CookieConsent/></I18nProvider>);
 expect(screen.getByText('Принять')).toBeDefined();
 fireEvent.click(screen.getByText('switch')); expect(screen.getByText('Accept')).toBeDefined();
 fireEvent.click(screen.getByText('Decline')); expect(localStorage.getItem('24go_cookie_consent')).toBe('declined');
 expect(screen.queryByText('Accept')).toBeNull();
});
it.each([[publicEn,en],[publicRu,ru]])('keeps public message subset identical to full messages', (subset,full) => {
 for(const [key,value] of Object.entries(subset)) expect((full as Record<string,string>)[key],key).toBe(value);
});
it('uses curated recommendations and honest workflow controls in both dictionaries',()=>{
 for(const dict of [publicEn,publicRu]) {
 expect(dict['landing.step2Point4']).not.toMatch(/или VK|or VK/);
 expect(dict['landing.step3Point3']).not.toMatch(/и VK|and VK/);
 expect(dict['landing.step1Point2']).not.toMatch(/логин\/пароль|login\/password/);
 expect(dict['landing.step1Point4']).not.toMatch(/2-5/);
 for (const key of ['landing.step2Desc', 'landing.faq2A'] as const) expect(dict[key]).not.toMatch(/24\/7|every message|каждое сообщение/);
 }
});
it.each(['en', 'ru'])('does not advertise guaranteed warmup outcomes or fictitious controls (%s)', async locale => {
 const page:any = await pages['../app/tutorials/telegram-warmup/page.tsx']();
 const html = renderToStaticMarkup(await page.default({searchParams:{locale}}));
 expect(html).not.toMatch(/80%|20-30%|without bans|prevents bans|предотвращает баны|без банов|Enable the warmup worker|Включите воркер прогрева/);
 expect(html).toMatch(locale === 'ru' ? /Риск ограничений сохраняется/ : /Restrictions remain possible/);
});
it.each(['en', 'ru'])('explains platform capability limits on features (%s)', async locale => {
 const page:any = await pages['../app/features/page.tsx']();
 const html = renderToStaticMarkup(await page.default({searchParams:{locale}}));
 expect(html).toMatch(locale === 'ru' ? /Возможности различаются по платформам/ : /Capabilities differ by platform/);
});

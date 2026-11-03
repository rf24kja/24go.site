import { render, cleanup } from '@testing-library/react';
import { useEffect } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { platformHome, platformDestination, routePlatform, platformHref } from '@/lib/platform-routes';
const nav = vi.hoisted(() => ({ path: '/YT/channels', push: vi.fn(), replace: vi.fn() }));
vi.mock('next/navigation', () => ({ usePathname: () => nav.path, useRouter: () => nav }));
import { PlatformProvider, usePlatform, isPlatform } from '@/lib/platform';
afterEach(cleanup);
it('routes YT only to the implemented YouTube consumer, preserving namespaces', () => {
 expect(isPlatform('youtube')).toBe(true);
 expect(platformHome('youtube')).toBe('/YT/accounts');
 for (const tab of ['accounts','channels','templates','queue','settings','help']) {
  expect(routePlatform('/YT/'+tab)).toBe('youtube');
  expect(platformDestination('/YT/'+tab)).toBe('/YT');
  expect(platformHref('/'+tab+'?locale=ru', 'youtube')).toBe('/YT/'+tab+'?locale=ru');
 }
 for (const tab of ['leads','campaigns','groups','analytics']) expect(routePlatform('/YT/'+tab)).toBeNull();
 expect(routePlatform('/YT')).toBe('youtube');
 expect(platformDestination('/TG/accounts')).toBe('/accounts');
 expect(platformDestination('/WA/accounts')).toBe('/wa-accounts');
});
it('binds first child reads, switches and back to URL despite stale stored platform', () => {
 const reads:string[]=[];
 function Child(){const {platform}=usePlatform();useEffect(()=>{reads.push(platform)},[platform]);return null;}
 localStorage.setItem('platform','telegram');nav.path='/YT/channels';
 const v=render(<PlatformProvider><Child/></PlatformProvider>);
 expect(reads).toEqual(['youtube']);expect(localStorage.getItem('platform')).toBe('youtube');
 nav.path='/FB/groups';v.rerender(<PlatformProvider><Child/></PlatformProvider>);
 nav.path='/YT/queue';v.rerender(<PlatformProvider><Child/></PlatformProvider>);
 expect(reads).toEqual(['youtube','facebook','youtube']);
});

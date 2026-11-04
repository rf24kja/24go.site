import { describe, it, expect } from 'vitest';
import {routePlatform,platformHref,platformDestination} from '@/lib/platform-routes';
describe('implemented service rules destinations',()=>{
 for(const [service,prefix] of [['telegram','TG'],['vkontakte','VK'],['whatsapp','WA'],['facebook','FB'],['max','MAX']] as const){
 it(service,()=>{expect(routePlatform(`/${prefix}/lead-rules`)).toBe(service);expect(platformHref('/lead-rules',service)).toBe(`/${prefix}/lead-rules`);expect(platformDestination(`/${prefix}/lead-rules`)).toBe('/lead-rules');});
 }
 it('does not invent YouTube lead ingestion',()=>expect(routePlatform('/YT/lead-rules')).toBeNull());
});

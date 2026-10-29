import {it,expect,vi,afterEach} from 'vitest';
vi.hoisted(()=>{process.env.NEXT_PUBLIC_API_URL='https://api.24go.site';});
import {subscribeMax} from '@/lib/api';
afterEach(()=>vi.unstubAllGlobals());
it('posts secret only in authenticated JSON to existing scoped route and derives verified webhook URL',async()=>{
  const fetcher=vi.fn().mockResolvedValue({ok:true,status:200,json:async()=>({subscribed:true})});vi.stubGlobal('fetch',fetcher);
  const id='11111111-1111-4111-8111-111111111111',secret='synthetic_fixture_secret_0123456789abcdef';
  expect(await subscribeMax('fixture-auth',id,secret)).toEqual({subscribed:true});
  const [url,options]=fetcher.mock.calls[0];expect(url).toBe(`https://api.24go.site/api/v1/max/subscribe/${id}`);
  expect(options.method).toBe('POST');expect(options.headers.Authorization).toBe('Bearer fixture-auth');
  expect(JSON.parse(options.body)).toEqual({url:`https://api.24go.site/api/v1/max/webhooks/${id}`,secret});expect(url).not.toContain(secret);
});

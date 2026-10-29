import { afterEach, it, expect, vi } from 'vitest';
import { getPublicBlogPost, getPublicBlogPosts, getBlogSlugs } from '@/lib/api';
import { getAllPublicBlogPosts } from '@/lib/public-blog';
afterEach(()=>vi.unstubAllGlobals());
it.each([
 ['article',()=>getPublicBlogPost('fixture','en')],
 ['listing',()=>getPublicBlogPosts('en')],
 ['slugs',()=>getBlogSlugs()],
 ['archive',()=>getAllPublicBlogPosts('en')],
] as const)('reads fresh %s data across an upstream edit',async(kind,read)=>{
 let version='old';let saved:any;
 vi.stubGlobal('fetch',vi.fn(async(_url,options)=>{
  const data=kind==='article'?{title:version,content:version}:{items:[{slug:version,title:version,created_at:'2026-01-01'}],total:1};
  const body=options?.cache==='no-store'?data:(saved??=data);
  return new Response(JSON.stringify(body));
 }));
 await read();version='new';const second=JSON.stringify(await read());
 expect(second).toContain('new');expect(second).not.toContain('old');
});

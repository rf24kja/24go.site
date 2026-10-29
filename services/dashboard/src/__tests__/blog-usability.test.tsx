import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CookieConsent from '@/components/CookieConsent';
import PostPage from '@/app/blog/[slug]/page';
import { RelatedArticles } from '@/components/RelatedArticles';
const api=vi.hoisted(()=>({getPublicBlogPost:vi.fn(),getPublicBlogPosts:vi.fn()}));
vi.mock('@/lib/api',()=>({ ...api, getBlogSlugs:vi.fn(), ApiError:class extends Error{} }));
afterEach(()=>{vi.restoreAllMocks();vi.unstubAllGlobals();localStorage.clear();});
describe('blog rendering regressions',()=>{
 it('renders complete recommendation headings and locale links',async()=>{
  const title='A complete recommendation title long enough to span multiple lines without losing its last words';
  api.getPublicBlogPosts.mockResolvedValue({items:[{slug:'related-fixture',title,tags:[],created_at:'2026-01-01'}]});
  render(await RelatedArticles({slug:'fixture',tags:[],locale:'ru',translateTag:(tag)=>tag}));
  expect(screen.getByRole('heading',{name:title})).toBeInTheDocument();
  expect(screen.getByRole('link',{name:new RegExp(title)})).toHaveAttribute('href','/blog/related-fixture?locale=ru');
 });
 it('does not hold article rendering until recommendations finish',async()=>{
  api.getPublicBlogPost.mockResolvedValue({title:'Fixture',slug:'fixture',content:'Body',tags:[],created_at:'2026-01-01'});
  api.getPublicBlogPosts.mockReturnValue(new Promise(()=>{}));
  const completed=await Promise.race([PostPage({params:{slug:'fixture'},searchParams:{locale:'en'}}).then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),50))]);
  expect(completed).toBe(true);
 });
 it('reserves measured cookie notice height so last cards stay reachable',async()=>{
  let notify:()=>void=()=>{};
  vi.stubGlobal('ResizeObserver',class{constructor(cb:()=>void){notify=cb}observe(){notify()}disconnect(){}});
  vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({height:180} as DOMRect);
  render(<CookieConsent/>);
  const reserve=await screen.findByTestId('cookie-consent-space');
  expect(reserve.style.height).toBe('180px');
  fireEvent.click(screen.getByText('Decline'));
  await waitFor(()=>expect(screen.queryByTestId('cookie-consent-space')).not.toBeInTheDocument());
 });
});

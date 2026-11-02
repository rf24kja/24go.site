# Installed crawl / SEO / GEO delta v39

Status: **installed and publicly verified**. This is a bounded technical crawlability release, not a guarantee of rankings, Google indexing or AI citations.

## Sitemap

- Generates the complete current published article inventory without a build-time article-count snapshot. Upstream failures do not become a successful static-only sitemap.
- Supplies reciprocal `en`, `ru` and `x-default` links for genuinely translated pages and articles.
- Retains the three English-only tool canonicals once, without invented Russian translations.
- Uses the CMS's actual `updated_at`, falling back to known creation time when no update exists. Unknown static-page modification times are omitted instead of refreshed on every request.
- The public blog listing now exposes its existing update timestamp; no schema migration or editorial-content change was needed.

The route is explicitly dynamic and public inventory reads use no-store. Do not infer a last-known-good ISR fallback from older source comments: the verified contract is current complete inventory or a failure, not a fabricated partial success.

## Robots

A shared wildcard policy permits public pages, RU/EN locale queries, archive pagination and rendering assets. Private roots are covered both with and without a trailing slash, including query variants, and the platform namespaces `/TG`, `/VK`, `/WA`, `/FB`, `/MAX` are excluded.

Googlebot, Bingbot, OAI-SearchBot and PerplexityBot inherit those same restrictions; a separate broad bot-specific Allow group was intentionally not added. Existing training-crawler permissions were not changed. Robots rules are crawler guidance, not authentication or a way to force deindexing; application authorization and private noindex responses remain separate protections.

## Recorded acceptance

On the exact-image preview **and normal public HTTPS**, the complete acceptance inventory contained:

- 245 unique sitemap URLs, with106 article slugs represented in both locales (212 article URLs).
- 726 alternate-language links.
- 245 actual HTML reads checked for a matching canonical, real H1 and absence of unintended noindex/soft404.
- CMS timestamp equality, no invented static lastmod, private crawl exclusions and public asset/locale access checked.
- Requests with four search crawler User-Agent strings succeeded for public content. These were probes, not verified requests from real crawler IPs.

Counts are an acceptance snapshot, not a hardcoded future sitemap size. Fifteen unique relevant frontend methods were covered; the primary run had one timeout, and the complete affected four-case file passed a bounded retry without source changes. Backend registered-route serialization passed on the exact image with synthetic database results. One successful production build, including default type validation, was reused; it was not rebuilt after completion. RU390/EN1440 browser checks confirmed the existing page layout and public canonicals.

## Installed identities / scope

- Frontend: `sha256:b92421cf8ae617d0f673402cd14fb25e1900a89544fe6c9513698e2b8bf6896e`, BUILD_ID `Fh9JATY2tWK3luhHKDoyR`.
- API: `sha256:33838f362a53f80c7d8b596e213ec6eb35d54bc09562abc6d67514aeccf5a9f8`.
- Only frontend and API replaced, complete six-file Compose chain retained; workers, WA transport and all sibling containers preserved. Earlier v37/v38 guards were checked by hash.
- Canonical sources backed up and hash-verified; owned temporary preview removed.
- Git applies existing LF normalization to `robots.txt` and the Python router. Deployed bytes were not rewritten for Git. Runtime/Git-normalized SHA256: robots `c2e725242b2e65d22877915b901cdc27a04cae03d7d62ce19bffd7d3fb2ecf1f` / `5ea8bafd4bcc247ff695b5f858544aa53d64083e8e1cda99d3f596c4650b677c`; blog router `352880744990578af05b2946358ead9240b2b2c5f489814758f629787e0aade6` / `c6d3edb751f587904a404561ba8a69ca09974f13f8724cc2f2eeb54378c4ccc7`.

No Search Console write, indexing submission, social action, payment or private-data fixture was performed. CI success is not inferred from upload. Broader service readiness remains governed by [the completion plan](RELEASE_COMPLETION_PLAN.md).

## Official guidance checked

- [Google: sitemap construction, canonical URLs and accurate lastmod](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap): priority/changefreq are not ranking controls.
- [Google: AI features and your website](https://developers.google.com/search/docs/appearance/ai-features): ordinary SEO eligibility applies; no special AI markup is required.
- [OpenAI crawler roles](https://developers.openai.com/api/docs/bots): OAI-SearchBot search discovery is independent of GPTBot training.
- [Perplexity crawlers](https://docs.perplexity.ai/guides/bots): search crawler access and verified network identity are distinct.

# Backend routes inventory — services/backend/app (v0.3.3, generated 2026-10-12)

Source: `app/main.py` + all 28 files in `app/routers/*.py`. Paths are prefix + route as FastAPI serves them
(`redirect_slashes=False`, so trailing slash matters). Auth: `user` = `Depends(get_current_user)`;
`owner/admin` / `owner-email` = extra role check inside handler; `public` = no auth dep.

## App-level routes (main.py)

| method | full path | handler file:line | auth |
|---|---|---|---|
| WS | /ws/{tenant_id} | main.py:160 | JWT `?token=` must match tenant_id |
| POST | /internal/broadcast | main.py:229 | internal key (`X-Internal-Key`) |
| GET | /api/v1/events/poll | main.py:253 | JWT (query `token=` or `Authorization: Bearer`) |
| GET | /health | main.py:340 | public |

## Routers included in main.py (all 28 — none orphaned)

auth, tenants, targets, accounts, campaigns, leads, tasks, billing, analytics, listeners, audit,
campaign_analytics, scoring, system, groups, notifications, tenant_settings, blog, group_search,
auto_replies, balance, proxies, tools, mailings, metrics, phone_parser, contacts, max.

## Full route table (routers)

| method | full path | handler file:line | auth |
|---|---|---|---|
| POST | /api/v1/auth/register | auth.py:72 | public (IP rate-limit) |
| GET | /api/v1/auth/verify-email | auth.py:131 | public (Redis token) |
| POST | /api/v1/auth/login | auth.py:149 | public (IP rate-limit) |
| GET | /api/v1/auth/me | auth.py:176 | user |
| GET | /api/v1/auth/users | auth.py:192 | user |
| POST | /api/v1/auth/invite | auth.py:204 | user + owner/admin |
| PATCH | /api/v1/auth/users/{user_id}/role | auth.py:263 | user + owner/admin |
| DELETE | /api/v1/auth/users/{user_id} | auth.py:298 | user + owner/admin |
| PATCH | /api/v1/auth/tenant | auth.py:336 | user + owner |
| POST | /api/v1/auth/change-password | auth.py:374 | user |
| POST | /api/v1/auth/forgot-password | auth.py:408 | public (email rate-limit) |
| POST | /api/v1/auth/reset-password | auth.py:471 | public (JWT reset jti) |
| GET | /api/v1/tenants/ | tenants.py:16 | user |
| GET | /api/v1/tenants/{tenant_id} | tenants.py:27 | user (tenant match) |
| PATCH | /api/v1/tenants/{tenant_id} | tenants.py:42 | user + owner/admin |
| GET | /api/v1/targets/ | targets.py:21 | user |
| POST | /api/v1/targets/ | targets.py:47 | user (TargetCreate) |
| GET | /api/v1/targets/{target_id} | targets.py:70 | user |
| DELETE | /api/v1/targets/{target_id} | targets.py:85 | user |
| POST | /api/v1/targets/{target_id}/check-membership | targets.py:110 | user |
| POST | /api/v1/targets/{target_id}/join | targets.py:254 | user (JoinTargetRequest) |
| GET | /api/v1/targets/{target_id}/recent-posts | targets.py:378 | user |
| POST | /api/v1/targets/{target_id}/scrape-comments | targets.py:515 | user (ScrapeCommentsRequest) |
| POST | /api/v1/accounts/bulk | accounts.py:107 | user (BulkCreateRequest) |
| POST | /api/v1/accounts/bulk-import | accounts.py:169 | user (multipart files) |
| POST | /api/v1/accounts/bulk-import-vk | accounts.py:297 | user (VKBulkImportRequest) |
| POST | /api/v1/accounts/connect-all | accounts.py:392 | user (BulkConnectRequest) |
| GET | /api/v1/accounts/ | accounts.py:466 | user |
| POST | /api/v1/accounts/ | accounts.py:490 | user (AccountCreate) |
| GET | /api/v1/accounts/{account_id} | accounts.py:532 | user |
| POST | /api/v1/accounts/{account_id}/connect | accounts.py:553 | user (ConnectPhoneRequest) |
| POST | /api/v1/accounts/{account_id}/confirm | accounts.py:630 | user (ConfirmCodeRequest) |
| POST | /api/v1/accounts/{account_id}/confirm-password | accounts.py:784 | user (ConfirmPasswordRequest) |
| DELETE | /api/v1/accounts/{account_id} | accounts.py:912 | user |
| POST | /api/v1/accounts/{account_id}/disconnect | accounts.py:953 | user |
| GET | /api/v1/accounts/{account_id}/tg-status | accounts.py:1007 | user |
| POST | /api/v1/accounts/{account_id}/reconnect | accounts.py:1068 | user |
| POST | /api/v1/accounts/{account_id}/connect-vk | accounts.py:1147 | user (VKConnectRequest) |
| POST | /api/v1/accounts/{account_id}/assign-proxy | accounts.py:1248 | user (ProxyAssignRequest) |
| GET | /api/v1/campaigns/ | campaigns.py:19 | user |
| POST | /api/v1/campaigns/ | campaigns.py:36 | user (CampaignCreate) |
| GET | /api/v1/campaigns/{campaign_id} | campaigns.py:59 | user |
| DELETE | /api/v1/campaigns/{campaign_id} | campaigns.py:77 | user |
| PATCH | /api/v1/campaigns/{campaign_id} | campaigns.py:118 | user (CampaignUpdateRequest) |
| POST | /api/v1/campaigns/{campaign_id}/run | campaigns.py:160 | user |
| POST | /api/v1/campaigns/cron-preview | campaigns.py:265 | user (CronPreviewRequest) |
| GET | /api/v1/campaigns/{campaign_id}/ab-stats | campaigns.py:297 | user |
| GET | /api/v1/campaigns/{campaign_id}/stats | campaign_analytics.py:14 | user |
| GET | /api/v1/campaigns/{campaign_id}/logs | campaign_analytics.py:91 | user |
| GET | /api/v1/leads/stats | leads.py:22 | user |
| GET | /api/v1/leads/ | leads.py:52 | user |
| POST | /api/v1/leads/qualify | leads.py:99 | user (QualifyRequest) |
| PATCH | /api/v1/leads/{lead_id} | leads.py:129 | user (StatusUpdateRequest) |
| POST | /api/v1/leads/bulk-status | leads.py:182 | user (BulkStatusRequest) |
| GET | /api/v1/leads/export | leads.py:201 | user |
| POST | /api/v1/leads/import | leads.py:262 | user (ImportRequest) |
| GET | /api/v1/leads/{lead_id} | leads.py:326 | user |
| POST | /api/v1/tasks/parser/discover | tasks.py:42 | user (ParseRequest) |
| POST | /api/v1/tasks/poster/publish | tasks.py:63 | user (PostRequest) |
| POST | /api/v1/tasks/warmup/run | tasks.py:126 | user (WarmupRequest) |
| GET | /api/v1/billing/subscription | billing.py:89 | user |
| POST | /api/v1/billing/cancel | billing.py:125 | user |
| GET | /api/v1/billing/usage | billing.py:161 | user |
| GET | /api/v1/billing/invoice/{subscription_id} | billing.py:207 | user |
| GET | /api/v1/billing/history | billing.py:232 | user |
| POST | /api/v1/billing/checkout | billing.py:263 | user (CheckoutRequest) |
| POST | /api/v1/billing/stripe-webhook | billing.py:357 | public (Stripe sig) |
| POST | /api/v1/billing/webhook/yookassa | billing.py:423 | public (API verify-back) |
| GET | /api/v1/analytics/ | analytics.py:56 | user |
| GET | /api/v1/analytics/leaderboard | analytics.py:230 | user |
| GET | /api/v1/analytics/vk-overview | analytics.py:311 | user |
| POST | /api/v1/listeners/{account_id}/start | listeners.py:32 | user |
| POST | /api/v1/listeners/{account_id}/stop | listeners.py:86 | user |
| GET | /api/v1/listeners/status | listeners.py:110 | user |
| GET | /api/v1/audit/ | audit.py:18 | user |
| GET | /api/v1/audit/owner | audit.py:38 | owner-email (+owner role fallback) |
| GET | /api/v1/audit/owner/users | audit.py:117 | owner-email (no role fallback) |
| GET | /api/v1/audit/owner/subscriptions | audit.py:150 | owner-email (no role fallback) |
| GET | /api/v1/scoring/rules | scoring.py:22 | user |
| POST | /api/v1/scoring/rules | scoring.py:34 | user + owner/admin |
| DELETE | /api/v1/scoring/rules/{rule_id} | scoring.py:65 | user + owner/admin |
| POST | /api/v1/system/webhook/test | system.py:29 | user + owner/admin |
| GET | /api/v1/system/backup/leads | system.py:78 | user + owner/admin |
| GET | /api/v1/system/info | system.py:117 | user + owner/admin |
| POST | /api/v1/system/seed-demo | system.py:149 | user + owner/admin |
| GET | /api/v1/groups/ | groups.py:96 | user |
| POST | /api/v1/groups/ | groups.py:136 | user (GroupCreateRequest) |
| POST | /api/v1/groups/bulk-import | groups.py:314 | user (BulkImportRequest) |
| POST | /api/v1/groups/{group_id}/start | groups.py:373 | user |
| POST | /api/v1/groups/{group_id}/stop | groups.py:432 | user |
| DELETE | /api/v1/groups/{group_id} | groups.py:466 | user |
| POST | /api/v1/groups/discover | groups.py:517 | user (DiscoverRequest) |
| POST | /api/v1/notifications/test-smtp | notifications.py:29 | user |
| GET | /api/v1/notifications/status | notifications.py:68 | user |
| GET | /api/v1/settings/ | tenant_settings.py:24 | user |
| GET | /api/v1/settings/{section} | tenant_settings.py:33 | user |
| PUT | /api/v1/settings/{section} | tenant_settings.py:45 | user (SettingsUpdate) |
| POST | /api/v1/settings/reset/{section} | tenant_settings.py:64 | user |
| POST | /api/v1/settings/webhooks/test | tenant_settings.py:83 | user |
| GET | /api/v1/settings/api-keys | tenant_settings.py:139 | user |
| POST | /api/v1/settings/api-keys | tenant_settings.py:152 | user (ApiKeyCreate) |
| DELETE | /api/v1/settings/api-keys/{key_id} | tenant_settings.py:169 | user |
| GET | /api/v1/settings/export | tenant_settings.py:186 | user |
| POST | /api/v1/settings/delete-account | tenant_settings.py:222 | user (DeleteAccountRequest) |
| GET | /api/v1/blog/admin/list | blog.py:79 | user + owner |
| POST | /api/v1/blog/admin | blog.py:98 | user + owner (BlogPostCreate) |
| PUT | /api/v1/blog/admin/{post_id} | blog.py:125 | user + owner (BlogPostUpdate) |
| DELETE | /api/v1/blog/admin/{post_id} | blog.py:150 | user + owner |
| GET | /api/v1/blog | blog.py:172 | public |
| GET | /api/v1/blog/{slug} | blog.py:207 | public |
| POST | /api/v1/group-search/semantic | group_search.py:26 | user (SemanticQueryRequest) |
| POST | /api/v1/group-search | group_search.py:40 | user (GroupSearchRequest) |
| GET | /api/v1/group-search/stats | group_search.py:152 | user |
| GET | /api/v1/auto-replies/ | auto_replies.py:53 | user |
| POST | /api/v1/auto-replies/ | auto_replies.py:70 | user (AutoReplyCreate) |
| GET | /api/v1/auto-replies/{auto_reply_id} | auto_replies.py:97 | user |
| PUT | /api/v1/auto-replies/{auto_reply_id} | auto_replies.py:114 | user (AutoReplyUpdate) |
| DELETE | /api/v1/auto-replies/{auto_reply_id} | auto_replies.py:145 | user |
| POST | /api/v1/auto-replies/{auto_reply_id}/answers | auto_replies.py:162 | user |
| DELETE | /api/v1/auto-replies/{auto_reply_id}/answers/{answer_id} | auto_replies.py:192 | user |
| POST | /api/v1/auto-replies/{auto_reply_id}/import-answers | auto_replies.py:220 | user (BulkAnswerImport) |
| POST | /api/v1/auto-replies/{auto_reply_id}/toggle | auto_replies.py:255 | user |
| GET | /api/v1/balance | balance.py:30 | user |
| POST | /api/v1/balance/topup | balance.py:45 | user (TopUpRequest) |
| GET | /api/v1/balance/history | balance.py:88 | user |
| POST | /api/v1/balance/webhook | balance.py:108 | public (Stripe sig; note: `request` param untyped) |
| GET | /api/v1/proxies/ | proxies.py:36 | user |
| POST | /api/v1/proxies/ | proxies.py:65 | user (ProxyCreate) |
| PUT | /api/v1/proxies/{proxy_id} | proxies.py:80 | user (ProxyUpdate) |
| DELETE | /api/v1/proxies/{proxy_id} | proxies.py:102 | user |
| POST | /api/v1/proxies/{proxy_id}/test | proxies.py:124 | user |
| POST | /api/v1/proxies/bulk-import | proxies.py:173 | user (BulkImportRequest) |
| POST | /api/v1/proxies/bulk-assign | proxies.py:219 | user (BulkAssignRequest) |
| POST | /api/v1/tools/analyze-group | tools.py:38 | public (GroupAnalysisRequest) |
| POST | /api/v1/mailings/ | mailings.py:16 | user (MailingCreate) |
| GET | /api/v1/mailings/ | mailings.py:36 | user |
| GET | /api/v1/mailings/{mailing_id} | mailings.py:51 | user |
| POST | /api/v1/mailings/import | mailings.py:78 | user (MailingImportRequest; see suspect #1) |
| POST | /api/v1/mailings/{mailing_id}/start | mailings.py:154 | user |
| POST | /api/v1/mailings/{mailing_id}/pause | mailings.py:183 | user |
| POST | /api/v1/mailings/{mailing_id}/stop | mailings.py:206 | user |
| POST | /api/v1/mailings/{mailing_id}/check-read | mailings.py:226 | user |
| DELETE | /api/v1/mailings/{mailing_id} | mailings.py:248 | user |
| GET | /metrics | metrics.py:11 | public (no router prefix) |
| POST | /api/v1/wa/connect | phone_parser.py:46 | user (WaConnectRequest) |
| GET | /api/v1/wa/qr/{account_id} | phone_parser.py:79 | user |
| GET | /api/v1/accounts/{account_id}/whatsapp/qr | phone_parser.py:80 | user (compat alias, same handler) |
| GET | /api/v1/wa/pairing-code/{account_id} | phone_parser.py:95 | user |
| GET | /api/v1/wa/status/{account_id} | phone_parser.py:110 | user |
| GET | /api/v1/accounts/{account_id}/whatsapp/status | phone_parser.py:111 | user (compat alias, same handler) |
| POST | /api/v1/wa/disconnect/{account_id} | phone_parser.py:134 | user |
| POST | /api/v1/accounts/{account_id}/whatsapp/disconnect | phone_parser.py:135 | user (compat alias, same handler) |
| GET | /api/v1/wa/accounts | phone_parser.py:152 | user |
| DELETE | /api/v1/wa/accounts/{account_id} | phone_parser.py:165 | user |
| POST | /api/v1/wa/parse | phone_parser.py:180 | user (WaParseRequest) |
| POST | /api/v1/wa/parse-async | phone_parser.py:262 | user (WaParseRequest) |
| GET | /api/v1/wa/parse-status/{job_id} | phone_parser.py:346 | user |
| GET | /api/v1/wa/groups | phone_parser.py:374 | user |
| GET | /api/v1/wa/known-groups/{account_id} | phone_parser.py:387 | user |
| GET | /api/v1/wa/my-groups/{account_id} | phone_parser.py:402 | user |
| GET | /api/v1/contacts | phone_parser.py:418 | user -- DUPLICATE of contacts.py:22 |
| GET | /api/v1/contacts/stats | phone_parser.py:456 | user |
| GET | /api/v1/contacts/{contact_id} | phone_parser.py:473 | user |
| PUT | /api/v1/contacts/{contact_id} | phone_parser.py:488 | user (ContactUpdateRequest) |
| DELETE | /api/v1/contacts/{contact_id} | phone_parser.py:508 | user |
| POST | /api/v1/contacts/check-tg | phone_parser.py:525 | user (CheckTgRequest) |
| POST | /api/v1/contacts/export | phone_parser.py:540 | user |
| POST | /api/v1/contacts/bulk-tag | phone_parser.py:581 | user (BulkTagRequest) -- DUPLICATE of contacts.py:118 |
| POST | /api/v1/contacts/assign-campaign | phone_parser.py:609 | user (AssignCampaignRequest) |
| GET | /api/v1/contacts | contacts.py:22 | user -- DUPLICATE of phone_parser.py:418 |
| POST | /api/v1/contacts/check-platforms | contacts.py:58 | user (CheckPlatformsRequest) |
| POST | /api/v1/contacts/refresh-platforms | contacts.py:80 | user (RefreshPlatformsRequest) |
| POST | /api/v1/contacts/bulk-tag | contacts.py:118 | user (BulkTagRequest) -- DUPLICATE of phone_parser.py:581 |
| GET | /api/v1/contacts/export | contacts.py:147 | user (same path as phone_parser POST /contacts/export, other method) |
| POST | /api/v1/max/connect | max.py:58 | user (MaxConnectRequest) |
| GET | /api/v1/max/accounts | max.py:141 | user |
| DELETE | /api/v1/max/accounts/{account_id} | max.py:160 | user |
| GET | /api/v1/max/status/{account_id} | max.py:182 | user |
| POST | /api/v1/max/subscribe/{account_id} | max.py:261 | user (MaxSubscribeRequest) |
| POST | /api/v1/max/webhooks/{account_id} | max.py:322 | webhook-secret header (NO JWT) |

## Query-vs-body suspects (POST/PUT/PATCH scalar params FastAPI binds from query, not JSON body)

| # | location | signature | problem |
|---|---|---|---|
| 1 | mailings.py:78-84 (`import_recipients`) | `async def import_recipients(body: MailingImportRequest, mailing_id: str \| None = None, ...)` on `POST /api/v1/mailings/import` | `mailing_id` is a bare scalar with default on a POST -> FastAPI treats it as QUERY. A caller sending `{"mailing_id": ...}` inside the JSON body gets it silently ignored (always None -> auto-creates a new mailing). Fix: `mailing_id: str \| None = Query(default=None)` if query is intended, or move it into `MailingImportRequest`. |

Notes (checked, NOT suspects): every other POST/PUT/PATCH takes a single BaseModel body (or path-only params).
`request: Request = None` defaults in targets.py:260 (`join_target`) and leads.py:135 (`update_lead_status`)
are odd but harmless (Request is injected, not a query param). balance.py:108 `stripe_webhook(request, ...)`
has an UNTYPED `request` param — worth annotating as `Request` but it still works via Starlette.

## Duplicates / collisions

| # | method+path | place A | place B | effect |
|---|---|---|---|---|
| 1 | GET /api/v1/contacts | phone_parser.py:418 (`list_contacts`, WA-flavoured filters) | contacts.py:22 (`list_contacts`, cross-platform filters) | EXACT duplicate: second-registered router (`contacts`, included after `phone_parser` in main.py:336-337) SHADOWS the first. `GET /api/v1/contacts?search=&has_tg=&tags=` (phone_parser flavour) is unreachable. |
| 2 | POST /api/v1/contacts/bulk-tag | phone_parser.py:581 (`BulkTagRequest`: contact_ids/tags/action) | contacts.py:118 (`BulkTagRequest`: contact_ids/tags/action, min_length=1) | EXACT duplicate: `contacts` version wins (registered later); schemas differ slightly (contacts.py requires min_length=1). One handler is dead code. |
| 3 | /api/v1/contacts/export (GET vs POST) | phone_parser.py:540 POST (CSV, metadata tags/notes) | contacts.py:147 GET (CSV, has_tg/vk/wa columns) | Same path, different methods — both reachable, but two divergent CSV formats on one URL is a contract trap. Pick one. |

Shadowing risks (not exact duplicates, same-method prefix capture by registration order):
- tenant_settings.py:33 `GET /api/v1/settings/{section}` is registered BEFORE `GET /api-keys` (:139)
  and `GET /export` (:186). `GET /api/v1/settings/api-keys` and `GET /api/v1/settings/export` therefore
  match `{section}` first ("api-keys"/"export" not in DEFAULTS -> returns `{"error": ...}`); the real
  handlers are unreachable. Move literal routes above `/{section}` or constrain `section` with regex.
- Safe by order (verify if reordering): leads.py `GET /export` (:201) before `GET /{lead_id}` (:326) OK;
  blog.py `GET /{slug}` (:207) is last OK; groups/proxies/mailing sub-paths (`/bulk-import`, `/discover`,
  `/import`, `/cron-preview`, `/admin/list`) are multi-segment or registered before their `/{id}` GETs OK.
  mailings `POST /import` is safe vs `POST /{mailing_id}/start` (1 vs 2 segments).

## Routers never included in main.py

None. All 28 `app/routers/*.py` modules are imported and `include_router`-ed (main.py:309-337).
`metrics` router has no prefix and serves bare `GET /metrics` (metrics.py:11).

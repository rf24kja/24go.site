# Frontend API calls — services/dashboard/src

Source: `services/dashboard/src/lib/api.ts` (897 lines, read fully) + grep for `fetch(` + grep for `wss://|/ws/|WebSocket`.
Base URL: `getApiBase()` — `NEXT_PUBLIC_API_URL` or `http://localhost:8000` (localhost) or `https://api.24go.site`, prepended by central `api()` wrapper (`api.ts:69-77`).

## 1. api.ts — every exported endpoint function

caller function/file:line | method | path template | params

| caller | method | path template | params |
|---|---|---|---|
| login `lib/api.ts:104` | POST | /api/v1/auth/login | body {email, password} |
| register `lib/api.ts:111` | POST | /api/v1/auth/register | body {email, password, company_name} |
| getMe `lib/api.ts:118` | GET | /api/v1/auth/me | token header |
| getLeads `lib/api.ts:124` | GET | /api/v1/leads/ | query intent_score, status->status_filter, platform, limit, offset; token |
| getLead `lib/api.ts:131` | GET | /api/v1/leads/{leadId} | path leadId; token |
| qualifyLead `lib/api.ts:135` | POST | /api/v1/leads/qualify | body {user_handle, message_text, geo_tag?, user_full_name?, platform?}; token |
| getAccounts `lib/api.ts:144` | GET | /api/v1/accounts/ | query status_filter, platform, limit, offset; token |
| createAccount `lib/api.ts:149` | POST | /api/v1/accounts/ | body {platform, account_identifier}; token |
| connectTelegram `lib/api.ts:153` | POST | /api/v1/accounts/{accountId}/connect | path accountId; body {phone}; token |
| confirmTelegram `lib/api.ts:159` | POST | /api/v1/accounts/{accountId}/confirm | path accountId; body {phone, code}; token |
| confirmPassword2FA `lib/api.ts:165` | POST | /api/v1/accounts/{accountId}/confirm-password | path accountId; body {password}; token |
| disconnectTelegram `lib/api.ts:171` | POST | /api/v1/accounts/{accountId}/disconnect | path accountId; token, no body |
| deleteTelegram `lib/api.ts:175` | DELETE | /api/v1/accounts/{accountId} | path accountId; token |
| reconnectTelegram `lib/api.ts:179` | POST | /api/v1/accounts/{accountId}/reconnect | path accountId; token, no body |
| getTelegramStatus `lib/api.ts:183` | GET | /api/v1/accounts/{accountId}/tg-status | path accountId; token |
| bulkCreateAccounts `lib/api.ts:187` | POST | /api/v1/accounts/bulk | body {accounts[]}; token |
| bulkConnectAccounts `lib/api.ts:193` | POST | /api/v1/accounts/connect-all | body {account_ids[]}; token |
| bulkImportAccounts `lib/api.ts:199` | POST | /api/v1/accounts/bulk-import | body FormData files[]; token header (direct fetch, multipart) |
| connectVK `lib/api.ts:221` | POST | /api/v1/accounts/{accountId}/connect-vk | path accountId; body {group_token, group_id}; token |
| connectMax `lib/api.ts:229` | POST | /api/v1/max/connect | body {bot_token}; token |
| getMaxAccounts `lib/api.ts:235` | GET | /api/v1/max/accounts | token |
| getMaxStatus `lib/api.ts:239` | GET | /api/v1/max/status/{accountId} | path accountId; token |
| deleteMaxAccount `lib/api.ts:243` | DELETE | /api/v1/max/accounts/{accountId} | path accountId; token |
| connectWhatsApp `lib/api.ts:249` | POST | /api/v1/wa/connect | body {phone_number, method}; token |
| getWhatsAppQr `lib/api.ts:253` | GET | /api/v1/wa/qr/{accountId} | path accountId; token |
| getWhatsAppPairingCode `lib/api.ts:257` | GET | /api/v1/wa/pairing-code/{accountId} | path accountId; token |
| getWhatsAppStatus `lib/api.ts:261` | GET | /api/v1/wa/status/{accountId} | path accountId; token |
| disconnectWhatsApp `lib/api.ts:265` | POST | /api/v1/wa/disconnect/{accountId} | path accountId; token, no body |
| getWaAccounts `lib/api.ts:269` | GET | /api/v1/wa/accounts | token |
| deleteWhatsApp `lib/api.ts:273` | DELETE | /api/v1/wa/accounts/{accountId} | path accountId; token |
| getCampaigns `lib/api.ts:279` | GET | /api/v1/campaigns/ | query platform, limit, offset; token |
| createCampaign `lib/api.ts:284` | POST | /api/v1/campaigns/ | body data:any; token |
| updateCampaign `lib/api.ts:288` | PATCH | /api/v1/campaigns/{campaignId} | path campaignId; body data:any; token |
| deleteCampaign `lib/api.ts:292` | DELETE | /api/v1/campaigns/{campaignId} | path campaignId; token |
| runCampaign `lib/api.ts:296` | POST | /api/v1/campaigns/{campaignId}/run | path campaignId; token, no body |
| previewCron `lib/api.ts:300` | POST | /api/v1/campaigns/cron-preview | body {cron, timezone}; token |
| getCampaignStats `lib/api.ts:304` | GET | /api/v1/campaigns/{campaignId}/stats | path campaignId; token |
| getCampaignAbStats `lib/api.ts:308` | GET | /api/v1/campaigns/{campaignId}/ab-stats | path campaignId; token |
| getCampaignLogs `lib/api.ts:312` | GET | /api/v1/campaigns/{campaignId}/logs | path campaignId; query limit, offset; token |
| getTargets `lib/api.ts:319` | GET | /api/v1/targets/ | query platform, limit, offset; token |
| scrapeTargetComments `lib/api.ts:324` | POST | /api/v1/targets/{targetId}/scrape-comments | path targetId; body {post_id}; token |
| getRecentPosts `lib/api.ts:330` | GET | /api/v1/targets/{targetId}/recent-posts | path targetId; query limit, offset; token |
| checkMembership `lib/api.ts:336` | POST | /api/v1/targets/{targetId}/check-membership | path targetId; token, no body |
| joinTarget `lib/api.ts:342` | POST | /api/v1/targets/{targetId}/join | path targetId; body {account_ids \| null}; token |
| getGroups `lib/api.ts:353` | GET | /api/v1/groups/ | query platform, limit, offset; token |
| addGroup `lib/api.ts:358` | POST | /api/v1/groups/ | body {platform, group_identifier, account_id}; token |
| startGroupScanner `lib/api.ts:362` | POST | /api/v1/groups/{groupId}/start | path groupId; token, no body |
| stopGroupScanner `lib/api.ts:366` | POST | /api/v1/groups/{groupId}/stop | path groupId; token, no body |
| removeGroup `lib/api.ts:370` | DELETE | /api/v1/groups/{groupId} | path groupId; token |
| discoverGroups `lib/api.ts:374` | POST | /api/v1/groups/discover | body {geo_tag, niche, platform?, account_id?}; token |
| bulkImportGroups `lib/api.ts:380` | POST | /api/v1/groups/bulk-import | body {groups[]}; token |
| getSubscription `lib/api.ts:388` | GET | /api/v1/billing/subscription | token |
| getUsage `lib/api.ts:392` | GET | /api/v1/billing/usage | token |
| createCheckout `lib/api.ts:396` | POST | /api/v1/billing/checkout | body {plan, provider}; token |
| dispatchParser `lib/api.ts:406` | POST | /api/v1/tasks/parser/discover | body data:any; token |
| dispatchPoster `lib/api.ts:410` | POST | /api/v1/tasks/poster/publish | body data:any; token |
| getAnalytics `lib/api.ts:416` | GET | /api/v1/analytics/ | query days, platform?; token |
| getLeaderboard `lib/api.ts:421` | GET | /api/v1/analytics/leaderboard | query days, platform?; token |
| getVkOverview `lib/api.ts:426` | GET | /api/v1/analytics/vk-overview | query days; token |
| bulkImportVkAccounts `lib/api.ts:430` | POST | /api/v1/accounts/bulk-import-vk | body {accounts:{group_id, token}[]}; token |
| updateLeadStatus `lib/api.ts:440` | PATCH | /api/v1/leads/{leadId} | path leadId; body {status}; token |
| bulkUpdateLeadStatus `lib/api.ts:448` | POST | /api/v1/leads/bulk-status | body {lead_ids[], status}; token |
| exportLeadsCsv `lib/api.ts:456` | GET | /api/v1/leads/export | query intent_score?, status?, platform?; token header (direct fetch, returns Blob) |
| importLeadsCsv `lib/api.ts:472` | POST | /api/v1/leads/import | body {file, default_geo, default_platform}; token |
| startListener `lib/api.ts:482` | POST | /api/v1/listeners/{accountId}/start | path accountId; token, no body |
| stopListener `lib/api.ts:486` | POST | /api/v1/listeners/{accountId}/stop | path accountId; token, no body |
| getListenerStatus `lib/api.ts:490` | GET | /api/v1/listeners/status | token |
| getAuditLog `lib/api.ts:496` | GET | /api/v1/audit/ | query entity_type?, limit?; token |
| getOwnerAuditLog `lib/api.ts:501` | GET | /api/v1/audit/owner | query entity_type?, user_id?, tenant_id?, action?, date_from?, date_to?, limit?; token |
| getOwnerUsers `lib/api.ts:509` | GET | /api/v1/audit/owner/users | token |
| getOwnerSubscriptions `lib/api.ts:513` | GET | /api/v1/audit/owner/subscriptions | token |
| getUsers `lib/api.ts:519` | GET | /api/v1/auth/users | token |
| inviteUser `lib/api.ts:523` | POST | /api/v1/auth/invite | body {email, role}; token |
| updateUserRole `lib/api.ts:531` | PATCH | /api/v1/auth/users/{userId}/role | path userId; body {role}; token |
| removeUser `lib/api.ts:539` | DELETE | /api/v1/auth/users/{userId} | path userId; token |
| updateTenant `lib/api.ts:545` | PATCH | /api/v1/auth/tenant | body {company_name?}; token |
| getScoringRules `lib/api.ts:555` | GET | /api/v1/scoring/rules | token |
| createScoringRule `lib/api.ts:559` | POST | /api/v1/scoring/rules | body {name, intent, keywords[], min_confidence?, priority?}; token |
| deleteScoringRule `lib/api.ts:563` | DELETE | /api/v1/scoring/rules/{ruleId} | path ruleId; token |
| changePassword `lib/api.ts:567` | POST | /api/v1/auth/change-password | body {current_password, new_password}; token |
| forgotPassword `lib/api.ts:575` | POST | /api/v1/auth/forgot-password | body {email}; no token |
| resetPassword `lib/api.ts:582` | POST | /api/v1/auth/reset-password | body {token (reset token), new_password}; no auth header |
| getSystemInfo `lib/api.ts:591` | GET | /api/v1/system/info | token |
| seedDemoData `lib/api.ts:595` | POST | /api/v1/system/seed-demo | token, no body |
| backupLeads `lib/api.ts:599` | GET | /api/v1/system/backup/leads | token header (direct fetch, returns Blob) |
| getNotificationStatus `lib/api.ts:616` | GET | /api/v1/notifications/status | token |
| testSmtp `lib/api.ts:620` | POST | /api/v1/notifications/test-smtp | body {host, port, user, password, to_email}; token |
| getTenantSettings `lib/api.ts:625` | GET | /api/v1/settings/ | token |
| getSettingsSection `lib/api.ts:628` | GET | /api/v1/settings/{section} | path section; token |
| updateSettingsSection `lib/api.ts:631` | PUT | /api/v1/settings/{section} | path section; body {settings}; token |
| resetSettingsSection `lib/api.ts:634` | POST | /api/v1/settings/reset/{section} | path section; token, no body |
| testWebhook `lib/api.ts:638` | POST | /api/v1/settings/webhooks/test | body {url}; token |
| listBlogPosts `lib/api.ts:644` | GET | /api/v1/blog/admin/list | token |
| createBlogPost `lib/api.ts:648` | POST | /api/v1/blog/admin | body post:any; token |
| updateBlogPost `lib/api.ts:652` | PUT | /api/v1/blog/admin/{postId} | path postId; body post:any; token |
| deleteBlogPost `lib/api.ts:656` | DELETE | /api/v1/blog/admin/{postId} | path postId; token |
| getPublicBlogPosts `lib/api.ts:660` | GET | /api/v1/blog | query locale; no token |
| getPublicBlogPost `lib/api.ts:664` | GET | /api/v1/blog/{slug} | path slug; query locale; no token |
| getBlogSlugs `lib/api.ts:668` | GET | /api/v1/blog?limit=200 | no token |
| getMailings `lib/api.ts:675` | GET | /api/v1/mailings/ | query platform?, limit?, offset?; token |
| createMailing `lib/api.ts:680` | POST | /api/v1/mailings/ | body {name, message_text, platform, delay_seconds}; token |
| getMailing `lib/api.ts:684` | GET | /api/v1/mailings/{mailingId} | path mailingId; token |
| importMailingRecipients `lib/api.ts:688` | POST | /api/v1/mailings/import | query mailing_id?; body {file}; token |
| startMailing `lib/api.ts:697` | POST | /api/v1/mailings/{mailingId}/start | path mailingId; token, no body |
| pauseMailing `lib/api.ts:701` | POST | /api/v1/mailings/{mailingId}/pause | path mailingId; token, no body |
| stopMailing `lib/api.ts:705` | POST | /api/v1/mailings/{mailingId}/stop | path mailingId; token, no body |
| deleteMailing `lib/api.ts:709` | DELETE | /api/v1/mailings/{mailingId} | path mailingId; token |
| getAutoReplies `lib/api.ts:715` | GET | /api/v1/auto-replies/ | token |
| getAutoReply `lib/api.ts:719` | GET | /api/v1/auto-replies/{id} | path id; token |
| createAutoReply `lib/api.ts:723` | POST | /api/v1/auto-replies/ | body data:any; token |
| updateAutoReply `lib/api.ts:727` | PUT | /api/v1/auto-replies/{id} | path id; body data:any; token |
| deleteAutoReply `lib/api.ts:731` | DELETE | /api/v1/auto-replies/{id} | path id; token |
| addAutoReplyAnswer `lib/api.ts:735` | POST | /api/v1/auto-replies/{id}/answers | path id; body {text}; token |
| deleteAutoReplyAnswer `lib/api.ts:739` | DELETE | /api/v1/auto-replies/{id}/answers/{answerId} | path id, answerId; token |
| importAutoReplyAnswers `lib/api.ts:743` | POST | /api/v1/auto-replies/{id}/import-answers | path id; body {text}; token |
| toggleAutoReply `lib/api.ts:747` | POST | /api/v1/auto-replies/{id}/toggle | path id; token, no body |
| getBalance `lib/api.ts:753` | GET | /api/v1/balance | token |
| topUpBalance `lib/api.ts:757` | POST | /api/v1/balance/topup | body {amount_kopeks}; token |
| getBalanceHistory `lib/api.ts:761` | GET | /api/v1/balance/history | token |
| searchGroupsTgstat `lib/api.ts:767` | POST | /api/v1/group-search | body data:any; token |
| expandSemanticQueries `lib/api.ts:771` | POST | /api/v1/group-search/semantic | body {keyword, country, niche}; token |
| getGroupSearchStats `lib/api.ts:775` | GET | /api/v1/group-search/stats | token |
| getProxies `lib/api.ts:781` | GET | /api/v1/proxies/ | token |
| createProxy `lib/api.ts:785` | POST | /api/v1/proxies/ | body {proxy_url, geo_location?, rotation_api_url?}; token |
| updateProxy `lib/api.ts:789` | PUT | /api/v1/proxies/{id} | path id; body data:any; token |
| deleteProxy `lib/api.ts:793` | DELETE | /api/v1/proxies/{id} | path id; token |
| testProxy `lib/api.ts:797` | POST | /api/v1/proxies/{id}/test | path id; token, no body |
| bulkImportProxies `lib/api.ts:801` | POST | /api/v1/proxies/bulk-import | body {proxies[], geo_location?}; token |
| bulkAssignProxies `lib/api.ts:805` | POST | /api/v1/proxies/bulk-assign | body {reset_first}; token |
| assignAccountProxy `lib/api.ts:809` | POST | /api/v1/accounts/{accountId}/assign-proxy | path accountId; body {proxy_id \| null}; token |
| parseWaGroups `lib/api.ts:815` | POST | /api/v1/wa/parse | body {account_id, group_links[], tags?}; token |
| parseWaGroupsAsync `lib/api.ts:819` | POST | /api/v1/wa/parse-async | body {account_id, group_links?, group_ids?, leave?}; token |
| getWaParseStatus `lib/api.ts:823` | GET | /api/v1/wa/parse-status/{jobId} | path jobId; token |
| getWaGroups `lib/api.ts:827` | GET | /api/v1/wa/groups | token |
| getContacts `lib/api.ts:847` | GET | /api/v1/contacts | query search?, platform?, country?, tags?, quality?, page?, limit?; token |
| getContactStats `lib/api.ts:855` | GET | /api/v1/contacts/stats | token |
| updateContact `lib/api.ts:859` | PUT | /api/v1/contacts/{contactId} | path contactId; body {tags?, notes?}; token |
| deleteContact `lib/api.ts:863` | DELETE | /api/v1/contacts/{contactId} | path contactId; token |
| checkPlatforms `lib/api.ts:867` | POST | /api/v1/contacts/check-platforms | body {phone_numbers[]}; token |
| refreshPlatforms `lib/api.ts:873` | POST | /api/v1/contacts/refresh-platforms | body {contact_ids[]}; token |
| exportContactsCsv `lib/api.ts:879` | GET | /api/v1/contacts/export | token header (direct fetch, returns Blob) |
| bulkTagContacts `lib/api.ts:887` | POST | /api/v1/contacts/bulk-tag | body {contact_ids[], tags[]}; token |
| getWaOverview `lib/api.ts:895` | GET | /api/v1/wa/overview | token |

Non-endpoint helpers (not counted as calls): `getApiBase` (`lib/api.ts:6`), `extractErrorMessage` (`lib/api.ts:33`), generic `api(path, opts)` wrapper (`lib/api.ts:69`, central fetch at line 77).

## 2. Direct fetch() calls outside api.ts

caller file:line | method | path template | params

| caller | method | path template | params |
|---|---|---|---|
| GET feed `app/feed.xml/route.ts:8` | GET | /api/v1/blog?limit=100 | no auth, ISR revalidate 3600 |
| getBlogPosts `app/sitemap.ts:12` | GET | /api/v1/blog?limit=200 | no auth, ISR revalidate 3600 |
| analyze `app/tools/group-analyzer/analyzer.tsx:29` | POST | /api/v1/tools/analyze-group | body {url}; no auth header |
| health check `app/(dashboard)/health/page.tsx:40` | GET | /health | no auth (root health, not /api/v1) |
| health check `app/(dashboard)/health/page.tsx:41` | GET | /api/v1/listeners/status | token header |
| health check `app/(dashboard)/health/page.tsx:42` | GET | /api/v1/system/info | token header |
| api-keys list `app/(dashboard)/settings/page.tsx:787` | GET | /api/v1/settings/api-keys | token header |
| generateKey `app/(dashboard)/settings/page.tsx:795` | POST | /api/v1/settings/api-keys | body {name}; token header |
| generateKey refresh `app/(dashboard)/settings/page.tsx:803` | GET | /api/v1/settings/api-keys | token header (re-list after create) |
| revokeKey `app/(dashboard)/settings/page.tsx:812` | DELETE | /api/v1/settings/api-keys/{id} | path id; token header |
| handleExport `app/(dashboard)/settings/page.tsx:884` | GET | /api/v1/settings/export | token header, returns Blob |
| handleDeleteAccount `app/(dashboard)/settings/page.tsx:898` | POST | /api/v1/settings/delete-account | body {confirm:true}; token header |
| check-read btn `app/(dashboard)/mailings/page.tsx:356` | POST | /api/v1/mailings/{id}/check-read | path id; token header, no body |
| poll fallback `lib/useWebSocket.ts:58` | GET | /api/v1/events/poll?since={ts} | query since; token header (2s interval) |

Internal direct-fetch helpers inside api.ts (not counted above, all use `fetch` not `api()`): `bulkImportAccounts` (`lib/api.ts:202` POST /api/v1/accounts/bulk-import, multipart), `exportLeadsCsv` (`lib/api.ts:458` GET /api/v1/leads/export, Blob), `backupLeads` (`lib/api.ts:600` GET /api/v1/system/backup/leads, Blob), `exportContactsCsv` (`lib/api.ts:880` GET /api/v1/contacts/export, Blob).

## 3. WebSocket URLs

caller file:line | method | path template | params

| caller | method | path template | params |
|---|---|---|---|
| connectWs `lib/useWebSocket.ts:88` | WS | ws(s)://{base}/ws/{tenantId}?token={jwt} | path tenantId; query token (jwt); base ws://localhost:8000 local else NEXT_PUBLIC_API_URL with http->ws |
| consumers (no new URL): `components/Sidebar.tsx:21`, `app/(dashboard)/leads/page.tsx:74` via `useWebSocket(tenant_id, token)` | — | (same as above) | — |

Poll fallback when WS unavailable (Vercel): GET /api/v1/events/poll (see section 2).

## 4. Deprecated / duplicated / TODO notes

- No TODO/FIXME/DEPRECATED/legacy markers found in `src/` grep (only hit: `components/BlogList.tsx:31` group slug mapping, not an endpoint).
- No `/v0`, `/v1beta`, or `deprecated` path segments anywhere in `src/`.
- Duplicated same-endpoint access (wrapper + direct fetch): GET /api/v1/listeners/status — `getListenerStatus` (`api.ts:490`) + direct fetch (`health/page.tsx:41`); GET /api/v1/system/info — `getSystemInfo` (`api.ts:591`) + direct fetch (`health/page.tsx:42`).
- Same base path, different query/limit (not conflicts, just overlap): GET /api/v1/blog — `getPublicBlogPosts` (`api.ts:660` ?locale=), `getBlogSlugs` (`api.ts:668` ?limit=200), feed (`feed.xml/route.ts:8` ?limit=100), sitemap (`sitemap.ts:12` ?limit=200).
- Endpoints used ONLY via direct fetch, no wrapper in api.ts (contract risk if backend renames): /api/v1/settings/api-keys (GET/POST/DELETE), /api/v1/settings/export, /api/v1/settings/delete-account, /api/v1/mailings/{id}/check-read, /api/v1/tools/analyze-group, /api/v1/events/poll, /health.
- Near-duplicate WA parse pair (both live, different semantics): POST /api/v1/wa/parse (`parseWaGroups`, sync, tags) vs POST /api/v1/wa/parse-async (`parseWaGroupsAsync`, job_id + group_ids/leave).
- Counts: 143 endpoint functions + 3 helpers in api.ts; 14 direct-fetch call sites outside api.ts; 1 WebSocket URL template.

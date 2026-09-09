/**
 * API client for LeadGen Control Plane.
 * Centralized — all API calls go through this module.
 */

export function getApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window === "undefined") return "https://api.24go.site"; // SSR: always use full URL
  if (window.location.hostname === "localhost") return "http://localhost:8000";
  return "https://api.24go.site";
}

const API_URL = getApiBase();

interface FetchOptions extends RequestInit {
  token?: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function toQuery(params?: Record<string, string | number | undefined | null>): string {
  if (!params) return "";
  const filtered = Object.fromEntries(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== "")
  );
  return new URLSearchParams(filtered as Record<string, string>).toString();
}

export async function api<T = any>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { token, ...init } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  // 401 interceptor — session expired, redirect to login
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    throw new ApiError(401, "Session expired");
  }

  if (!res.ok) {
    const body = await res.text();
    // Try to extract a clean error message from the response
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message = parsed.detail || parsed.error || body;
    } catch { /* use raw body */ }
    throw new ApiError(res.status, message);
  }
  return res.json();
}

// ── Auth ──────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  return api<{ access_token: string; token_type: string }>("/api/v1/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function register(email: string, password: string, company_name: string) {
  return api<{ access_token: string; user: any; tenant: any }>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, password, company_name }),
  });
}

export async function getMe(token: string) {
  return api<any>("/api/v1/auth/me", { token });
}

// ── Leads ─────────────────────────────────────────────────────────────

export async function getLeads(token: string, params?: { intent_score?: string; status?: string; platform?: string; limit?: number; offset?: number }) {
  const mapped: Record<string, string | number | undefined> = params ? { ...params } : {};
  if (mapped.status) { mapped.status_filter = mapped.status as string; delete mapped.status; }
  const qs = toQuery(mapped);
  return api<{ items: any[]; total: number; limit: number; offset: number }>(`/api/v1/leads/${qs ? `?${qs}` : ""}`, { token });
}

export async function getLead(token: string, leadId: string) {
  return api<any>(`/api/v1/leads/${leadId}`, { token });
}

export async function qualifyLead(token: string, data: {
  user_handle: string; message_text: string; geo_tag?: string;
  user_full_name?: string; platform?: string;
}) {
  return api<any>("/api/v1/leads/qualify", { method: "POST", body: JSON.stringify(data), token });
}

// ── Accounts ──────────────────────────────────────────────────────────

export async function getAccounts(token: string, params?: { status_filter?: string; platform?: string; limit?: number; offset?: number }) {
  const qs = toQuery(params);
  return api<{ items: any[]; total: number; limit: number; offset: number }>(`/api/v1/accounts/${qs ? `?${qs}` : ""}`, { token });
}

export async function createAccount(token: string, data: { platform: string; account_identifier: string }) {
  return api<any>("/api/v1/accounts/", { method: "POST", body: JSON.stringify(data), token });
}

export async function connectTelegram(token: string, accountId: string, phone: string) {
  return api<any>(`/api/v1/accounts/${accountId}/connect`, {
    method: "POST", body: JSON.stringify({ phone }), token,
  });
}

export async function confirmTelegram(token: string, accountId: string, phone: string, code: string) {
  return api<any>(`/api/v1/accounts/${accountId}/confirm`, {
    method: "POST", body: JSON.stringify({ phone, code }), token,
  });
}

export async function confirmPassword2FA(token: string, accountId: string, password: string) {
  return api<any>(`/api/v1/accounts/${accountId}/confirm-password`, {
    method: "POST", body: JSON.stringify({ password }), token,
  });
}

export async function disconnectTelegram(token: string, accountId: string) {
  return api<any>(`/api/v1/accounts/${accountId}/disconnect`, { method: "POST", token });
}

export async function deleteTelegram(token: string, accountId: string) {
  return api<any>(`/api/v1/accounts/${accountId}`, { method: "DELETE", token });
}

export async function reconnectTelegram(token: string, accountId: string) {
  return api<any>(`/api/v1/accounts/${accountId}/reconnect`, { method: "POST", token });
}

export async function getTelegramStatus(token: string, accountId: string) {
  return api<any>(`/api/v1/accounts/${accountId}/tg-status`, { token });
}

export async function bulkCreateAccounts(token: string, accounts: { platform: string; account_identifier: string }[]) {
  return api<{ created: number; errors: string[] }>("/api/v1/accounts/bulk", {
    method: "POST", body: JSON.stringify({ accounts }), token,
  });
}

export async function bulkConnectAccounts(token: string, accountIds: string[]) {
  return api<{ sent: number; failed: string[] }>("/api/v1/accounts/connect-all", {
    method: "POST", body: JSON.stringify({ account_ids: accountIds }), token,
  });
}

export async function bulkImportAccounts(token: string, files: File[]) {
  const formData = new FormData();
  files.forEach((f) => formData.append("files", f));
  const res = await fetch(`${API_URL}/api/v1/accounts/bulk-import`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: formData,
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    throw new Error("Session expired");
  }
  if (!res.ok) {
    const body = await res.text();
    let message = body;
    try {
      const parsed = JSON.parse(body);
      message = parsed.detail || parsed.error || body;
    } catch { /* use raw body */ }
    throw new Error(message);
  }
  return res.json();
}

export async function connectVK(token: string, accountId: string, groupToken: string, groupId: number) {
  return api<any>(`/api/v1/accounts/${accountId}/connect-vk`, {
    method: "POST", body: JSON.stringify({ group_token: groupToken, group_id: groupId }), token,
  });
}

// ── Campaigns ─────────────────────────────────────────────────────────

export async function getCampaigns(token: string, params?: { platform?: string; limit?: number; offset?: number }) {
  const qs = toQuery(params);
  return api<{ items: any[]; total: number; limit: number; offset: number }>(`/api/v1/campaigns/${qs ? `?${qs}` : ""}`, { token });
}

export async function createCampaign(token: string, data: any) {
  return api<any>("/api/v1/campaigns/", { method: "POST", body: JSON.stringify(data), token });
}

export async function updateCampaign(token: string, campaignId: string, data: any) {
  return api<any>(`/api/v1/campaigns/${campaignId}`, { method: "PATCH", body: JSON.stringify(data), token });
}

export async function deleteCampaign(token: string, campaignId: string) {
  return api<any>(`/api/v1/campaigns/${campaignId}`, { method: "DELETE", token });
}

export async function runCampaign(token: string, campaignId: string) {
  return api<any>(`/api/v1/campaigns/${campaignId}/run`, { method: "POST", token });
}

export async function previewCron(token: string, cron: string, timezone: string) {
  return api<any>("/api/v1/campaigns/cron-preview", { method: "POST", body: JSON.stringify({ cron, timezone }), token });
}

export async function getCampaignStats(token: string, campaignId: string) {
  return api<any>(`/api/v1/campaigns/${campaignId}/stats`, { token });
}

export async function getCampaignAbStats(token: string, campaignId: string) {
  return api<any>(`/api/v1/campaigns/${campaignId}/ab-stats`, { token });
}

export async function getCampaignLogs(token: string, campaignId: string, params?: { limit?: number; offset?: number }) {
  const qs = toQuery(params);
  return api<any>(`/api/v1/campaigns/${campaignId}/logs${qs ? `?${qs}` : ""}`, { token });
}

// ── Targets ───────────────────────────────────────────────────────────

export async function getTargets(token: string, params?: { platform?: string; limit?: number; offset?: number }) {
  const qs = toQuery(params);
  return api<{ items: any[]; total: number; limit: number; offset: number }>(`/api/v1/targets/${qs ? `?${qs}` : ""}`, { token });
}

export async function scrapeTargetComments(token: string, targetId: string, postId: string) {
  return api<any>(`/api/v1/targets/${targetId}/scrape-comments`, {
    method: "POST", body: JSON.stringify({ post_id: postId }), token,
  });
}

export async function getRecentPosts(token: string, targetId: string, limit: number = 50, offset: number = 0) {
  return api<{ posts: { id: number; text: string; date: string; views: number; comments: number }[]; total: number }>(
    `/api/v1/targets/${targetId}/recent-posts?limit=${limit}&offset=${offset}`, { token }
  );
}

export async function checkMembership(token: string, targetId: string) {
  return api<{ target_id: string; is_joined: boolean }>(
    `/api/v1/targets/${targetId}/check-membership`, { method: "POST", token }
  );
}

export async function joinTarget(token: string, targetId: string, accountIds?: string[]) {
  return api<{ target_id: string; results: { account_id: string; status: string; error?: string }[] }>(
    `/api/v1/targets/${targetId}/join`, {
      method: "POST", token,
      body: JSON.stringify({ account_ids: accountIds || null }),
    }
  );
}

// ── Groups (Monitored) ────────────────────────────────────────────────

export async function getGroups(token: string, params?: { platform?: string; limit?: number; offset?: number }) {
  const qs = toQuery(params);
  return api<{ items: any[]; total: number; limit: number; offset: number }>(`/api/v1/groups/${qs ? `?${qs}` : ""}`, { token });
}

export async function addGroup(token: string, data: { platform: string; group_identifier: string; account_id: string }) {
  return api<any>("/api/v1/groups/", { method: "POST", body: JSON.stringify(data), token });
}

export async function startGroupScanner(token: string, groupId: string) {
  return api<any>(`/api/v1/groups/${groupId}/start`, { method: "POST", token });
}

export async function stopGroupScanner(token: string, groupId: string) {
  return api<any>(`/api/v1/groups/${groupId}/stop`, { method: "POST", token });
}

export async function removeGroup(token: string, groupId: string) {
  return api<any>(`/api/v1/groups/${groupId}`, { method: "DELETE", token });
}

export async function discoverGroups(token: string, data: { geo_tag: string; niche: string; platform?: string; account_id?: string }) {
  return api<{ results: any[]; total: number }>("/api/v1/groups/discover", {
    method: "POST", body: JSON.stringify(data), token,
  });
}

export async function bulkImportGroups(token: string, groups: { group_identifier: string; platform: string }[]) {
  return api<{ imported: number; skipped: number; errors: string[] }>("/api/v1/groups/bulk-import", {
    method: "POST", body: JSON.stringify({ groups }), token,
  });
}

// ── Billing ───────────────────────────────────────────────────────────

export async function getSubscription(token: string) {
  return api<any>("/api/v1/billing/subscription", { token });
}

export async function getUsage(token: string) {
  return api<any>("/api/v1/billing/usage", { token });
}

export async function createCheckout(token: string, plan: string, provider: string) {
  return api<any>("/api/v1/billing/checkout", {
    method: "POST",
    body: JSON.stringify({ plan, provider }),
    token,
  });
}

// ── Tasks ─────────────────────────────────────────────────────────────

export async function dispatchParser(token: string, data: any) {
  return api<any>("/api/v1/tasks/parser/discover", { method: "POST", body: JSON.stringify(data), token });
}

export async function dispatchPoster(token: string, data: any) {
  return api<any>("/api/v1/tasks/poster/publish", { method: "POST", body: JSON.stringify(data), token });
}

// ── Analytics ─────────────────────────────────────────────────────────

export async function getAnalytics(token: string, days = 30, platform?: string) {
  const plat = platform ? `&platform=${platform}` : "";
  return api<any>(`/api/v1/analytics/?days=${days}${plat}`, { token });
}

export async function getLeaderboard(token: string, days = 30, platform?: string) {
  const plat = platform ? `&platform=${platform}` : "";
  return api<any>(`/api/v1/analytics/leaderboard?days=${days}${plat}`, { token });
}

export async function getVkOverview(token: string, days = 30) {
  return api<any>(`/api/v1/analytics/vk-overview?days=${days}`, { token });
}

export async function bulkImportVkAccounts(token: string, accounts: { group_id: number; token: string }[]) {
  return api<any>("/api/v1/accounts/bulk-import-vk", {
    method: "POST",
    body: JSON.stringify({ accounts }),
    token,
  });
}

// ── Lead Status ───────────────────────────────────────────────────────

export async function updateLeadStatus(token: string, leadId: string, status: string) {
  return api<any>(`/api/v1/leads/${leadId}`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
    token,
  });
}

export async function bulkUpdateLeadStatus(token: string, leadIds: string[], status: string) {
  return api<any>("/api/v1/leads/bulk-status", {
    method: "POST",
    body: JSON.stringify({ lead_ids: leadIds, status }),
    token,
  });
}

export async function exportLeadsCsv(token: string, params?: { intent_score?: string; status?: string; platform?: string }) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/api/v1/leads/export${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(`Export failed: ${res.status}`);
  return res.blob();
}

export async function importLeadsCsv(token: string, csvContent: string, defaultGeo?: string, defaultPlatform?: string) {
  return api<any>("/api/v1/leads/import", {
    method: "POST",
    body: JSON.stringify({ file: csvContent, default_geo: defaultGeo || "", default_platform: defaultPlatform || "telegram" }),
    token,
  });
}

// ── Listeners ─────────────────────────────────────────────────────────

export async function startListener(token: string, accountId: string) {
  return api<any>(`/api/v1/listeners/${accountId}/start`, { method: "POST", token });
}

export async function stopListener(token: string, accountId: string) {
  return api<any>(`/api/v1/listeners/${accountId}/stop`, { method: "POST", token });
}

export async function getListenerStatus(token: string) {
  return api<any>("/api/v1/listeners/status", { token });
}

// ── Audit ─────────────────────────────────────────────────────────────

export async function getAuditLog(token: string, params?: { entity_type?: string; limit?: number }) {
  const qs = toQuery(params);
  return api<any[]>(`/api/v1/audit/${qs ? `?${qs}` : ""}`, { token });
}

export async function getOwnerAuditLog(token: string, params?: {
  entity_type?: string; user_id?: string; tenant_id?: string;
  action?: string; date_from?: string; date_to?: string; limit?: number;
}) {
  const qs = toQuery(params);
  return api<any[]>(`/api/v1/audit/owner${qs ? `?${qs}` : ""}`, { token });
}

// ── Users ─────────────────────────────────────────────────────────────

export async function getUsers(token: string) {
  return api<any[]>("/api/v1/auth/users", { token });
}

export async function inviteUser(token: string, email: string, role: string) {
  return api<any>("/api/v1/auth/invite", {
    method: "POST",
    body: JSON.stringify({ email, role }),
    token,
  });
}

export async function updateUserRole(token: string, userId: string, role: string) {
  return api<any>(`/api/v1/auth/users/${userId}/role`, {
    method: "PATCH",
    body: JSON.stringify({ role }),
    token,
  });
}

export async function removeUser(token: string, userId: string) {
  return api<any>(`/api/v1/auth/users/${userId}`, { method: "DELETE", token });
}

// ── Tenant ────────────────────────────────────────────────────────────

export async function updateTenant(token: string, data: { company_name?: string }) {
  return api<any>("/api/v1/auth/tenant", {
    method: "PATCH",
    body: JSON.stringify(data),
    token,
  });
}

// ── Scoring Rules ─────────────────────────────────────────────────────

export async function getScoringRules(token: string) {
  return api<any[]>("/api/v1/scoring/rules", { token });
}

export async function createScoringRule(token: string, data: { name: string; intent: string; keywords: string[]; min_confidence?: number; priority?: number }) {
  return api<any>("/api/v1/scoring/rules", { method: "POST", body: JSON.stringify(data), token });
}

export async function deleteScoringRule(token: string, ruleId: string) {
  return api<any>(`/api/v1/scoring/rules/${ruleId}`, { method: "DELETE", token });
}

export async function changePassword(token: string, currentPassword: string, newPassword: string) {
  return api<any>("/api/v1/auth/change-password", {
    method: "POST",
    body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
    token,
  });
}

export async function forgotPassword(email: string) {
  return api<any>("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function resetPassword(token: string, password: string) {
  return api<any>("/api/v1/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token, new_password: password }),
  });
}

// ── System ───────────────────────────────────────────────────────────

export async function getSystemInfo(token: string) {
  return api<any>("/api/v1/system/info", { token });
}

export async function seedDemoData(token: string) {
  return api<any>("/api/v1/system/seed-demo", { method: "POST", token });
}

export async function backupLeads(token: string) {
  const res = await fetch(`${API_URL}/api/v1/system/backup/leads`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) {
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    throw new Error("Session expired");
  }
  if (!res.ok) throw new Error(`Backup failed: ${res.status}`);
  return res.blob();
}

// ── Notifications ───────────────────────────────────────────────────

export async function getNotificationStatus(token: string) {
  return api<any>("/api/v1/notifications/status", { token });
}

export async function testSmtp(token: string, data: { host: string; port: number; user: string; password: string; to_email: string }) {
  return api<any>("/api/v1/notifications/test-smtp", { method: "POST", body: JSON.stringify(data), token });
}

// ── Tenant Settings ──────────────────────────────────────────────
export async function getTenantSettings(token: string) {
  return api<{ settings: Record<string, any>; defaults: Record<string, any> }>("/api/v1/settings/", { token });
}
export async function getSettingsSection(token: string, section: string) {
  return api<{ section: string; settings: Record<string, any>; defaults: Record<string, any> }>(`/api/v1/settings/${section}`, { token });
}
export async function updateSettingsSection(token: string, section: string, settings: Record<string, any>) {
  return api<{ section: string; settings: Record<string, any>; status: string }>(`/api/v1/settings/${section}`, { method: "PUT", body: JSON.stringify({ settings }), token });
}
export async function resetSettingsSection(token: string, section: string) {
  return api<{ section: string; settings: Record<string, any>; status: string }>(`/api/v1/settings/reset/${section}`, { method: "POST", token });
}

export async function testWebhook(token: string, url: string) {
  return api<{ status_code: number; success: boolean; error?: string }>("/api/v1/settings/webhooks/test", { method: "POST", body: JSON.stringify({ url }), token });
}

// ── Blog ─────────────────────────────────────────────────────────────

export async function listBlogPosts(token: string) {
  return api<any>("/api/v1/blog/admin/list", { token });
}

export async function createBlogPost(token: string, post: any) {
  return api<any>("/api/v1/blog/admin", { method: "POST", body: JSON.stringify(post), token });
}

export async function updateBlogPost(token: string, postId: string, post: any) {
  return api<any>(`/api/v1/blog/admin/${postId}`, { method: "PUT", body: JSON.stringify(post), token });
}

export async function deleteBlogPost(token: string, postId: string) {
  return api<any>(`/api/v1/blog/admin/${postId}`, { method: "DELETE", token });
}

export async function getPublicBlogPosts(locale = "en") {
  return api<any>(`/api/v1/blog?locale=${locale}`);
}

export async function getPublicBlogPost(slug: string, locale = "en") {
  return api<any>(`/api/v1/blog/${slug}?locale=${locale}`);
}

export async function getBlogSlugs() {
  const data = await api<{ items: { slug: string }[]; total: number }>("/api/v1/blog?limit=100");
  return data.items || [];
}

// ── Mailings ─────────────────────────────────────────────────────

export async function getMailings(token: string, params?: { platform?: string; limit?: number; offset?: number }) {
  const qs = toQuery(params);
  return api<{ items: any[]; total: number; limit: number; offset: number }>(`/api/v1/mailings/${qs ? `?${qs}` : ""}`, { token });
}

export async function createMailing(token: string, data: { name: string; message_text: string; platform: string; delay_seconds: number }) {
  return api<any>("/api/v1/mailings/", { method: "POST", body: JSON.stringify(data), token });
}

export async function getMailing(token: string, mailingId: string) {
  return api<any>(`/api/v1/mailings/${mailingId}`, { token });
}

export async function importMailingRecipients(token: string, csvContent: string, mailingId?: string) {
  const qs = mailingId ? `?mailing_id=${mailingId}` : "";
  return api<any>(`/api/v1/mailings/import${qs}`, {
    method: "POST",
    body: JSON.stringify({ file: csvContent }),
    token,
  });
}

export async function startMailing(token: string, mailingId: string) {
  return api<any>(`/api/v1/mailings/${mailingId}/start`, { method: "POST", token });
}

export async function pauseMailing(token: string, mailingId: string) {
  return api<any>(`/api/v1/mailings/${mailingId}/pause`, { method: "POST", token });
}

export async function stopMailing(token: string, mailingId: string) {
  return api<any>(`/api/v1/mailings/${mailingId}/stop`, { method: "POST", token });
}

export async function deleteMailing(token: string, mailingId: string) {
  return api<any>(`/api/v1/mailings/${mailingId}`, { method: "DELETE", token });
}

// ── Auto-replies ─────────────────────────────────────────────────

export async function getAutoReplies(token: string) {
  return api<any>(`/api/v1/auto-replies/`, { token });
}

export async function getAutoReply(token: string, id: string) {
  return api<any>(`/api/v1/auto-replies/${id}`, { token });
}

export async function createAutoReply(token: string, data: any) {
  return api<any>(`/api/v1/auto-replies/`, { method: "POST", body: JSON.stringify(data), token });
}

export async function updateAutoReply(token: string, id: string, data: any) {
  return api<any>(`/api/v1/auto-replies/${id}`, { method: "PUT", body: JSON.stringify(data), token });
}

export async function deleteAutoReply(token: string, id: string) {
  return api<any>(`/api/v1/auto-replies/${id}`, { method: "DELETE", token });
}

export async function addAutoReplyAnswer(token: string, id: string, text: string) {
  return api<any>(`/api/v1/auto-replies/${id}/answers`, { method: "POST", body: JSON.stringify({ text }), token });
}

export async function deleteAutoReplyAnswer(token: string, id: string, answerId: string) {
  return api<any>(`/api/v1/auto-replies/${id}/answers/${answerId}`, { method: "DELETE", token });
}

export async function importAutoReplyAnswers(token: string, id: string, text: string) {
  return api<any>(`/api/v1/auto-replies/${id}/import-answers`, { method: "POST", body: JSON.stringify({ text }), token });
}

export async function toggleAutoReply(token: string, id: string) {
  return api<any>(`/api/v1/auto-replies/${id}/toggle`, { method: "POST", token });
}

// ── Balance ──────────────────────────────────────────────────────

export async function getBalance(token: string) {
  return api<any>(`/api/v1/balance`, { token });
}

export async function topUpBalance(token: string, amountKopeks: number) {
  return api<any>(`/api/v1/balance/topup`, { method: "POST", body: JSON.stringify({ amount_kopeks: amountKopeks }), token });
}

export async function getBalanceHistory(token: string) {
  return api<any[]>(`/api/v1/balance/history`, { token });
}

// ── Group Search ─────────────────────────────────────────────────

export async function searchGroupsTgstat(token: string, data: any) {
  return api<any>(`/api/v1/group-search`, { method: "POST", body: JSON.stringify(data), token });
}

export async function expandSemanticQueries(token: string, keyword: string, country: string, niche: string) {
  return api<any>(`/api/v1/group-search/semantic`, { method: "POST", body: JSON.stringify({ keyword, country, niche }), token });
}

export async function getGroupSearchStats(token: string) {
  return api<any>(`/api/v1/group-search/stats`, { token });
}

// ── Proxies ─────────────────────────────────────────────────────

export async function getProxies(token: string) {
  return api<any[]>(`/api/v1/proxies/`, { token });
}

export async function createProxy(token: string, data: { proxy_url: string; geo_location?: string; rotation_api_url?: string }) {
  return api<any>(`/api/v1/proxies/`, { method: "POST", body: JSON.stringify(data), token });
}

export async function updateProxy(token: string, id: string, data: any) {
  return api<any>(`/api/v1/proxies/${id}`, { method: "PUT", body: JSON.stringify(data), token });
}

export async function deleteProxy(token: string, id: string) {
  return api<any>(`/api/v1/proxies/${id}`, { method: "DELETE", token });
}

export async function testProxy(token: string, id: string) {
  return api<any>(`/api/v1/proxies/${id}/test`, { method: "POST", token });
}

export async function bulkImportProxies(token: string, proxies: string[], geo_location?: string) {
  return api<any>(`/api/v1/proxies/bulk-import`, { method: "POST", body: JSON.stringify({ proxies, geo_location }), token });
}

export async function bulkAssignProxies(token: string, resetFirst: boolean = false) {
  return api<any>(`/api/v1/proxies/bulk-assign`, { method: "POST", body: JSON.stringify({ reset_first: resetFirst }), token });
}

export async function assignAccountProxy(token: string, accountId: string, proxyId: string | null) {
  return api<any>(`/api/v1/accounts/${accountId}/assign-proxy`, { method: "POST", body: JSON.stringify({ proxy_id: proxyId }), token });
}

/**
 * API client for LeadGen Control Plane.
 * Uses server-side fetch for RSC, client-side fetch for mutations.
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || process.env.API_URL || "http://localhost:8000";

interface FetchOptions extends RequestInit {
  token?: string;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function api<T = any>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { token, ...init } = opts;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string> || {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    const body = await res.text();
    throw new ApiError(res.status, body);
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

export async function getLeads(token: string, params?: { intent_score?: string; status?: string }) {
  const qs = new URLSearchParams(params).toString();
  return api<any[]>(`/api/v1/leads/${qs ? `?${qs}` : ""}`, { token });
}

export async function qualifyLead(token: string, data: {
  user_handle: string; message_text: string; geo_tag?: string;
  user_full_name?: string; platform?: string;
}) {
  return api<any>("/api/v1/leads/qualify", { method: "POST", body: JSON.stringify(data), token });
}

// ── Accounts ──────────────────────────────────────────────────────────

export async function getAccounts(token: string) {
  return api<any[]>("/api/v1/accounts/", { token });
}

// ── Campaigns ─────────────────────────────────────────────────────────

export async function getCampaigns(token: string) {
  return api<any[]>("/api/v1/campaigns/", { token });
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

// ── Targets ───────────────────────────────────────────────────────────

export async function getTargets(token: string) {
  return api<any[]>("/api/v1/targets/", { token });
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

export async function getAnalytics(token: string, days = 30) {
  return api<any>(`/api/v1/analytics/?days=${days}`, { token });
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

export async function exportLeadsCsv(token: string, params?: { intent_score?: string; status?: string }) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_URL}/api/v1/leads/export${qs ? `?${qs}` : ""}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
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
  const qs = new URLSearchParams(params as any).toString();
  return api<any[]>(`/api/v1/audit/${qs ? `?${qs}` : ""}`, { token });
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

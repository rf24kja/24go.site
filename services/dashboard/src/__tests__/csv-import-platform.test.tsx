import { afterEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, waitFor } from "@testing-library/react";
import LeadsPage from "@/app/(dashboard)/leads/page";
const state = vi.hoisted(() => ({ platform: "vkontakte" }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ auth: { token: "synthetic", user: { tenant_id: "test-tenant" } } }) }));
vi.mock("@/lib/platform", () => ({ usePlatform: () => ({ platform: state.platform }) }));
vi.mock("@/lib/useWebSocket", () => ({ useWebSocket: () => ({ connected: false, lastEvent: null }) }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key, lang: "en" }) }));
vi.mock("@/components/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/api")>(),
  getLeads: vi.fn(async () => ({ items: [], total: 0 })),
}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it.each(["telegram", "vkontakte", "whatsapp", "max", "facebook"])("imports CSV using selected %s platform", async (platform) => {
  state.platform = platform;
  const fetcher = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
    expect(String(input)).toContain("/api/v1/leads/import");
    return new Response('{"imported":1,"skipped":0,"errors":[]}');
  });
  vi.stubGlobal("fetch", fetcher);
  const { container } = render(<LeadsPage />);
  await waitFor(() => expect(container.querySelector('input[type="file"]')).not.toBeNull());
  const file = new File(["user_handle,message_text\nid1,hello"], "leads.csv", { type: "text/csv" });
  Object.defineProperty(file, "text", { value: async () => "user_handle,message_text\nid1,hello" });
  fireEvent.change(container.querySelector('input[type="file"]')!, { target: { files: [file] } });
  await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body)).default_platform).toBe(platform);
});

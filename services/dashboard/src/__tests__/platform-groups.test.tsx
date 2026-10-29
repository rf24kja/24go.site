import { render, screen, waitFor, fireEvent, cleanup, act } from "@testing-library/react";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ platform: "vkontakte", token: "fixture", getGroups: vi.fn(), getAccounts: vi.fn(), getTargets: vi.fn(), joinTarget: vi.fn(), searchGroupsTgstat: vi.fn() }));
vi.mock("@/lib/auth", () => ({ useAuth: () => ({ auth: { token: state.token } }) }));
vi.mock("@/lib/platform", () => ({ usePlatform: () => ({ platform: state.platform }) }));
vi.mock("@/lib/i18n", () => ({ useI18n: () => ({ t: (key: string) => key, lang: "en" }) }));
vi.mock("@/components/Toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/lib/api", () => ({ getGroups: state.getGroups, getAccounts: state.getAccounts, getTargets: state.getTargets, joinTarget: state.joinTarget, searchGroupsTgstat: state.searchGroupsTgstat }));
import GroupsPage from "@/app/(dashboard)/groups/page";
import TargetsPage from "@/app/(dashboard)/targets/page";
beforeEach(() => { vi.clearAllMocks(); state.platform = "vkontakte"; state.getGroups.mockResolvedValue({items: []}); state.getAccounts.mockResolvedValue({items: []}); state.getTargets.mockResolvedValue({items: []}); });
afterEach(() => { cleanup(); vi.useRealTimers(); });
it("group load failures are errors, not successful empty states, and retry works", async () => {
 state.getGroups.mockRejectedValueOnce(new Error("service unavailable"));
 render(<GroupsPage />);
 await waitFor(() => expect(screen.getByRole("alert").textContent).toContain("service unavailable"));
 fireEvent.click(screen.getByText("Retry"));
 await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
});
it("FB monitoring displays Facebook guidance rather than TG/VK steps", async () => {
 state.platform = "facebook"; render(<GroupsPage />);
 await waitFor(() => expect(state.getGroups).toHaveBeenCalledWith("fixture", {platform: "facebook"}));
 expect(screen.getAllByText(/Facebook: connect an account/).length).toBeGreaterThan(0);
 expect(screen.queryByText("groups.step1Desc")).toBeNull();
 fireEvent.click(screen.getByText("groups.addGroup"));
 expect(screen.getByPlaceholderText("https://www.facebook.com/groups/123456789")).toBeTruthy();
});
it("polling switches to the selected platform and discards the previous response", async () => {
 vi.useFakeTimers();
 let finish: (v: any) => void = () => {};
 state.getGroups.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
 const view = render(<GroupsPage />);
 state.platform = "facebook"; view.rerender(<GroupsPage />);
 await act(async () => { await Promise.resolve(); finish({items:[{id:"old", title:"STALE VK", platform:"vkontakte"}]}); });
 expect(screen.queryByText("STALE VK")).toBeNull();
 await act(async () => { vi.advanceTimersByTime(5000); await Promise.resolve(); });
 expect(state.getGroups.mock.calls.map(c => c[1].platform)).toEqual(["vkontakte","facebook","facebook"]);
});
it("VK targets never offer TGStat or automated join", async () => {
 state.getTargets.mockResolvedValue({items:[{id:"v",title:"VK community",platform:"vkontakte",is_active:true}]});
 render(<TargetsPage />);
 await screen.findByText("VK community");
 expect(screen.queryByText("TgStat")).toBeNull();
 expect(screen.queryByText("targets.join")).toBeNull();
 expect(state.searchGroupsTgstat).not.toHaveBeenCalled();
});
it("join lists and submits only active selected-platform accounts", async () => {
 state.platform = "telegram";
 state.getTargets.mockResolvedValue({items:[{id:"t",title:"TG community",platform:"telegram",is_active:true}]});
 state.getAccounts.mockResolvedValue({items:[{id:"tg",account_identifier:"TG ACTIVE",platform:"telegram",status:"active"},{id:"vk",account_identifier:"VK WRONG",platform:"vkontakte",status:"active"},{id:"off",account_identifier:"TG OFF",platform:"telegram",status:"disabled"}]});
 state.joinTarget.mockResolvedValue({results:[]});
 render(<TargetsPage />); await screen.findByText("TG community"); fireEvent.click(screen.getByText("targets.join"));
 await screen.findByText("TG ACTIVE");
 expect(screen.queryByText("VK WRONG")).toBeNull(); expect(screen.queryByText("TG OFF")).toBeNull();
 fireEvent.click(screen.getByText("targets.join targets.joinAll"));
 await waitFor(() => expect(state.joinTarget).toHaveBeenCalledWith("fixture","t",["tg"]));
 expect(state.getAccounts).toHaveBeenCalledWith("fixture",{platform:"telegram",status_filter:"active"});
});

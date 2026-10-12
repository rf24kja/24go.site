import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}));

describe("LanguageSwitcher", () => {
  it("renders EN and RU buttons", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByText("EN")).toBeDefined();
    expect(screen.getByText("RU")).toBeDefined();
  });
});

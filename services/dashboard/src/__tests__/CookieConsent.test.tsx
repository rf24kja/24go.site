import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import CookieConsent from "@/components/CookieConsent";

describe("CookieConsent", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("renders accept and decline buttons", () => {
    render(<CookieConsent />);
    expect(screen.getByText("Accept")).toBeDefined();
    expect(screen.getByText("Decline")).toBeDefined();
  });

  it("renders privacy policy link", () => {
    render(<CookieConsent />);
    expect(screen.getByText("Privacy Policy")).toBeDefined();
  });
});

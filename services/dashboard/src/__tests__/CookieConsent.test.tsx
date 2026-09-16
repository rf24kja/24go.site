import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import CookieConsent from "@/components/CookieConsent";

describe("CookieConsent", () => {
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

import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import LanguageSwitcher from "@/components/LanguageSwitcher";

// Mock next/navigation
jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: jest.fn() }),
}));

describe("LanguageSwitcher", () => {
  it("renders EN and RU buttons", () => {
    render(<LanguageSwitcher />);
    expect(screen.getByText("EN")).toBeDefined();
    expect(screen.getByText("RU")).toBeDefined();
  });
});

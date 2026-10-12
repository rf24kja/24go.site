import { describe, it, expect } from "vitest";
import { validateE164, normalizePhone } from "@/lib/validate";

describe("validateE164", () => {
  it("accepts valid E.164 numbers", () => {
    expect(validateE164("+66920004002")).toBe(true);
    expect(validateE164("+12025550183")).toBe(true);
    expect(validateE164("+7")).toBe(false); // too short: needs country + subscriber
  });

  it("rejects non-E.164 input", () => {
    expect(validateE164("66920004002")).toBe(false); // missing +
    expect(validateE164("+0123")).toBe(false); // leading zero country
    expect(validateE164("+66 92 000 4002")).toBe(false); // spaces
    expect(validateE164("")).toBe(false);
    expect(validateE164("+")).toBe(false);
  });

  it("rejects overlong numbers", () => {
    expect(validateE164("+1234567890123456")).toBe(false); // >15 digits total
  });
});

describe("normalizePhone", () => {
  it("adds missing plus", () => {
    expect(normalizePhone("66920004002")).toBe("+66920004002");
  });

  it("strips spaces, dashes, brackets", () => {
    expect(normalizePhone("+66 92-000-4002")).toBe("+66920004002");
    expect(normalizePhone("+7 (900) 123-45-67")).toBe("+79001234567");
  });

  it("keeps valid input unchanged", () => {
    expect(normalizePhone("+66920004002")).toBe("+66920004002");
  });
});

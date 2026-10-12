import { describe, it, expect } from "vitest";
import { extractErrorMessage } from "@/lib/api";

describe("extractErrorMessage", () => {
  it("flattens FastAPI 422 detail arrays (no [object Object])", () => {
    const body = JSON.stringify({
      detail: [
        { loc: ["body", "password"], msg: "Password must contain at least one uppercase letter", type: "value_error" },
      ],
    });
    const msg = extractErrorMessage(body);
    expect(msg).toContain("uppercase");
    expect(msg).not.toContain("[object Object]");
  });

  it("joins multiple validation errors", () => {
    const body = JSON.stringify({
      detail: [{ loc: ["a"], msg: "first problem" }, { loc: ["b"], msg: "second problem" }],
    });
    const msg = extractErrorMessage(body);
    expect(msg).toContain("first problem");
    expect(msg).toContain("second problem");
  });

  it("passes through string details", () => {
    expect(extractErrorMessage(JSON.stringify({ detail: "Email already registered" }))).toBe(
      "Email already registered"
    );
  });

  it("returns raw body for non-JSON", () => {
    expect(extractErrorMessage("Internal Server Error")).toBe("Internal Server Error");
  });

  it("handles error-keyed bodies", () => {
    expect(extractErrorMessage(JSON.stringify({ error: "Rate limited" }))).toBe("Rate limited");
  });
});

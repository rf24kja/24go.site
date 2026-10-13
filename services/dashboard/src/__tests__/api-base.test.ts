import { describe, it, expect, vi, afterEach } from "vitest";
import { getApiBase } from "@/lib/api";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("getApiBase", () => {
  it("explicit env override wins (staging builds)", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://staging-api.example.com");
    expect(getApiBase()).toBe("https://staging-api.example.com");
  });

  it("localhost browser hits compose fastapi mapping :8001, not container :8000", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    expect(window.location.hostname).toBe("localhost"); // jsdom default
    expect(getApiBase()).toBe("http://localhost:8001");
  });

  it("prod browser falls back to api.24go.site", () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "");
    Object.defineProperty(window, "location", {
      value: { hostname: "app.24go.site" },
      writable: true,
      configurable: true,
    });
    expect(getApiBase()).toBe("https://api.24go.site");
  });
});

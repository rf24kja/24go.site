import { expect, it, vi } from "vitest";
vi.mock("@/components/motion/AnimatedSection", () => ({ AnimatedSection: () => null }));
vi.mock("@/components/motion/MotionCard", () => ({ MotionCard: () => null }));
vi.mock("@/components/magicui", () => ({ TextAnimate: () => null }));
vi.mock("@/components/motion/SmoothScrollProvider", () => ({ SmoothScrollProvider: () => null }));
import { generateMetadata } from "@/app/page";
it("owns homepage locale canonical and alternates without leaking into child routes", async () => {
  const metadata = await generateMetadata({ searchParams: { locale: "ru" } });
  expect(metadata.alternates?.canonical).toBe("https://www.24go.site?locale=ru");
  expect(metadata.alternates?.languages?.en).toBe("https://www.24go.site?locale=en");
});

"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

// Register GSAP plugins once
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

/**
 * SmoothScrollProvider — Lenis × GSAP ScrollTrigger integration.
 *
 * Implements the official Lenis ↔ GSAP ScrollTrigger sync pattern:
 *   1. lenis.on("scroll", ScrollTrigger.update)
 *   2. gsap.ticker.add(time => lenis.raf(time * 1000))
 *
 * Animation spec: duration 1.2s, power2.out easing, smooth momentum scroll.
 */
export function SmoothScrollProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    // Initialize Lenis
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t: number): number =>
        Math.min(1, 1.001 * Math.pow(t - 1, 3) + 1), // power2.out
      smoothWheel: true,
      // Lenis already respects each target's CSS scroll-margin-top.
      anchors: true,
      prevent: (node) => node.hasAttribute("data-lenis-prevent"),
      touchMultiplier: 0.5,
      wheelMultiplier: 0.8,
      // Lenis automatically calls rAF, but we let GSAP's ticker drive it
    });

    lenisRef.current = lenis;

    // Step 1: Sync Lenis scroll events with GSAP ScrollTrigger
    lenis.on("scroll", () => {
      ScrollTrigger.update();
    });

    // Step 2: Integrate Lenis into GSAP's ticker for perfect sync
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      lenisRef.current = null;

    };
  }, []);

  // No wrapper element — passes children through directly
  return <>{children}</>;
}

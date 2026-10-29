"use client";

import { CSSProperties, ReactNode, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface BlurFadeProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
  offset?: number;
  direction?: "up" | "down" | "left" | "right";
  once?: boolean;
  style?: CSSProperties;
}

/**
 * BlurFade — GSAP-based replacement for Magic UI's <BlurFade>.
 *
 * Uses GSAP ScrollTrigger for scroll-based entrance with blur + fade.
 * Animation spec: 0.3–0.8s, power2.out easing.
 *
 * @see https://magicuidesign.com/docs/components/blur-fade
 */
export function BlurFade({
  children,
  className = "",
  delay = 0,
  duration = 0.6,
  offset = 20,
  direction = "up",
  once = true,
  style,
}: BlurFadeProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(el as any);

    const fromVars: any = {
      opacity: 0,
      duration,
      ease: "power2.out",
      delay,
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: once ? "play none none" : "play none none reverse",
      },
      filter: "blur(8px)",
    };

    switch (direction) {
      case "up":
        fromVars.y = offset;
        break;
      case "down":
        fromVars.y = -offset;
        break;
      case "left":
        fromVars.x = offset;
        fromVars.filter = "blur(4px)";
        break;
      case "right":
        fromVars.x = -offset;
        fromVars.filter = "blur(4px)";
        break;
    }

    gsap.from(el, fromVars);

    return () => ctx.revert();
  }, [delay, duration, offset, direction, once]);

  return (
    <div ref={ref} className={className} style={style}>
      {children}
    </div>
  );
}
"use client";

import { ReactNode, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface BlurFadeContainerProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
  duration?: number;
  offset?: number;
  once?: boolean;
}

/**
 * BlurFadeContainer — staggered blur-fade entrance for children.
 * GSAP-based replacement for Magic UI's <BlurFadeContainer>.
 *
 * Animation spec: 0.4–0.6s per item, stagger 0.08–0.12s, power2.out.
 *
 * @see https://magicuidesign.com/docs/components/blur-fade
 */
export function BlurFadeContainer({
  children,
  className = "",
  delay = 0,
  stagger = 0.1,
  duration = 0.5,
  offset = 20,
  once = true,
}: BlurFadeContainerProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(el as any);

    // Direct element children only
    const elements = Array.from(el.children).filter(
      (child) => child.nodeType === Node.ELEMENT_NODE
    );

    if (elements.length === 0) return;

    gsap.from(elements, {
      opacity: 0,
      y: offset,
      filter: "blur(8px)",
      duration,
      ease: "power2.out",
      stagger: { each: stagger, from: "start" },
      delay,
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: once ? "play none none" : "play none none reverse",
      },
    });

    return () => ctx.revert();
  }, [delay, stagger, duration, offset, once]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
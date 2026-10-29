"use client";

import { ReactNode, useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface AnimatedSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  stagger?: number;
  direction?: "up" | "down" | "left" | "right";
  once?: boolean;
}

/**
 * AnimatedSection — wrapper that animates all direct children
 * with a staggered GSAP entrance on scroll.
 *
 * Animation spec: 0.3–0.8s, power2.out, stagger 0.05–0.15s.
 */
export function AnimatedSection({
  children,
  className = "",
  delay = 0,
  stagger = 0.1,
  direction = "up",
  once = true,
}: AnimatedSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    // Collect direct element children (skip text/comment nodes)
    const elements = Array.from(el.children).filter(
      (child) => child.nodeType === Node.ELEMENT_NODE
    );

    if (elements.length === 0) return;

    // Direction-based transforms
    const fromVars: any = {
      opacity: 0,
      duration: 0.6,
      ease: "power2.out",
      stagger: { each: stagger, from: "start" },
      delay,
      scrollTrigger: {
        trigger: el,
        start: "top 85%",
        toggleActions: once ? "play none none" : "play none none reverse",
      },
    };

    switch (direction) {
      case "up":
        fromVars.y = 24;
        break;
      case "down":
        fromVars.y = -24;
        break;
      case "left":
        fromVars.x = 24;
        break;
      case "right":
        fromVars.x = -24;
        break;
    }

    const ctx = gsap.context(() => { gsap.from(elements, fromVars); }, el);

    return () => ctx.revert();
  }, [delay, stagger, direction, once]);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
"use client";

/**
 * Magnetic — hover magnetic effect on mouse move.
 * GSAP-based replacement for Magic UI's <Magnetic>.
 *
 * @see https://magicuidesign.com/docs/components/magnetic
 */

import { ReactNode, useEffect, useRef } from "react";
import gsap from "gsap";

interface MagneticProps {
  children: ReactNode;
  className?: string;
  strength?: number;
  ease?: string;
  duration?: number;
}

export function Magnetic({
  children,
  className = "",
  strength = 0.15,
  ease = "power2.out",
  duration = 0.3,
}: MagneticProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const ctx = gsap.context(el as any);

    const handleMouseEnter = () => {
      gsap.to(el, {
        scale: 1 + strength,
        duration,
        ease,
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const deltaX = ((x - centerX) / centerX) * 30 * strength;
      const deltaY = ((y - centerY) / centerY) * 30 * strength;

      gsap.to(el, {
        x: deltaX,
        y: deltaY,
        duration,
        ease,
      });
    };

    const handleMouseLeave = (e: MouseEvent) => {
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const deltaX = ((x - centerX) / centerX) * 30 * strength;
      const deltaY = ((y - centerY) / centerY) * 30 * strength;

      gsap.to(el, {
        x: deltaX,
        y: deltaY,
        duration,
        ease,
        onComplete: () => {
          gsap.to(el, {
            x: 0,
            y: 0,
            scale: 1,
            duration,
            ease,
          });
        },
      });
    };

    el.addEventListener("mouseenter", handleMouseEnter);
    el.addEventListener("mousemove", handleMouseMove);
    el.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      el.removeEventListener("mouseenter", handleMouseEnter);
      el.removeEventListener("mousemove", handleMouseMove);
      el.removeEventListener("mouseleave", handleMouseLeave);
      ctx.revert();
    };
  }, [strength, ease, duration]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

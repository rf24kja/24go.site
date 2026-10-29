"use client";

import {
  forwardRef,
  ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

interface MotionCardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  hover?: boolean;
  delay?: number;
  accent?: string;
}

/**
 * MotionCard — premium card component with GSAP entrance animation
 * and Magic UI-style magnetic hover.
 *
 * Animation spec: 0.3–0.8s, power2.out easing.
 * Compatible drop-in for the existing Card component.
 */
export const MotionCard = forwardRef<HTMLDivElement, MotionCardProps>(
  function MotionCard(
    {
      title,
      description,
      children,
      className = "",
      hover = false,
      delay = 0,
      accent = "var(--color-accent, #6366f1)",
    },
    externalRef
  ) {
    const innerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    // Merge refs
    const setRef = (node: HTMLDivElement | null) => {
      (innerRef as any).current = node;
      if (typeof externalRef === "function") {
        externalRef(node);
      } else if (externalRef) {
        (externalRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
      }
    };

    useEffect(() => {
      const el = innerRef.current;
      if (!el || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

      const ctx = gsap.context(() => {

      // Keep entrance animation on compositor-friendly opacity and transform.
      gsap.from(el, {
        opacity: 0,
        y: 24,

        duration: 0.6,
        ease: "power2.out",
        delay,
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none reverse",
        },
        onComplete: () => setIsVisible(true),
      });
      }, el);

      // Magnetic hover effect (Magic UI <Magnetic> inspired)
      if (hover) {
        const handleMouseEnter = () => {
          gsap.to(el, {
            scale: 1.02,
            boxShadow: `0 0 0 2px ${accent}40`,
            duration: 0.3,
            ease: "power2.out",
          });
        };

        const handleMouseMove = (e: MouseEvent) => {
          const rect = el.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
          const centerX = rect.width / 2;
          const centerY = rect.height / 2;
          const deltaX = ((x - centerX) / centerX) * 8;
          const deltaY = ((y - centerY) / centerY) * 8;

          gsap.to(el, {
            x: deltaX,
            y: deltaY,
            duration: 0.3,
            ease: "power2.out",
          });
        };

        const handleMouseLeave = () => {
          gsap.to(el, {
            scale: 1,
            x: 0,
            y: 0,
            boxShadow: "none",
            duration: 0.3,
            ease: "power2.out",
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
      }

      return () => ctx.revert();
    }, [delay, hover, accent]);

    return (
      <div
        ref={setRef}
        className={
          `bg-zinc-900 border border-zinc-800 rounded-xl p-6 ` +
          `transition-colors duration-300 relative overflow-hidden ` +
          `${className}`
        }
      >
        {/* Accent glow bar */}
        {hover && (
          <div
            className="absolute top-0 left-0 w-0.5 h-full opacity-40"
            style={{ background: accent }}
            aria-hidden="true"
          />
        )}

        <div className="mb-4">
          <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
          {description && (
            <p className="text-sm text-zinc-400 mt-1">{description}</p>
          )}
        </div>

        {children}
      </div>
    );
  }
);

MotionCard.displayName = "MotionCard";

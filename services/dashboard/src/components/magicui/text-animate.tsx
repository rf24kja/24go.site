"use client";

import { CSSProperties, Fragment } from "react";

interface TextAnimateProps {
  text: string;
  className?: string;
  delay?: number;
  duration?: number;
  stagger?: number;
  ease?: string;
  style?: "fade-up" | "fade" | "slide-up" | "slide-down" | "scale";
  as?: "h1" | "h2" | "h3" | "h4" | "p" | "span" | "div";
  splitBy?: "char" | "word" | "line";
}

/**
 * Keep text in SSR/React rather than clearing and rebuilding headings after
 * hydration. Word-level compositor animation avoids hundreds of layout reads.
 */
export function TextAnimate({
  text,
  className = "",
  delay = 0,
  duration = 0.5,
  stagger = 0.03,
  ease = "power2.out",
  style = "fade-up",
  as = "span",
  splitBy = "word",
}: TextAnimateProps) {
  const Tag = as;
  const parts = splitBy === "char" ? Array.from(text) : text.split(/(\s+)/);
  const transform = style === "fade" ? "none" : style === "scale" ? "scale(.8)" :
    `translateY(${style === "slide-down" ? -20 : style === "slide-up" ? 20 : 16}px)`;
  const timing = ease === "power2.out" ? "cubic-bezier(.215,.61,.355,1)" : "ease-out";
  let index = 0;
  return <Tag className={className}>{parts.map((part, position) => /^\s+$/.test(part) ?
    <Fragment key={position}>{part}</Fragment> :
    <span key={`${text}-${position}`} className="text-reveal" style={{
      "--text-from": transform,
      animationDuration: `${duration}s`,
      animationDelay: `${delay + index++ * stagger}s`,
      animationTimingFunction: timing,
    } as CSSProperties}>{part}</span>
  )}</Tag>;
}

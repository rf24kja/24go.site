"use client";

import { ReactNode, useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { HelpCircle } from "./Icons";

interface FieldHintProps {
  hint: string;
  children?: ReactNode;
}

export function FieldHint({ hint, children }: FieldHintProps) {
  const [show, setShow] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (show && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({
        top: rect.top - 8,
        left: rect.left + rect.width / 2,
      });
    }
  }, [show]);

  const tooltip = show ? createPortal(
    <span
      className="pointer-events-none fixed px-3 py-1.5 text-xs text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg max-w-[240px] text-center leading-relaxed"
      style={{
        top: pos.top,
        left: pos.left,
        transform: "translate(-50%, -100%)",
        zIndex: 9999,
      }}
    >
      {hint}
      <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-800" />
    </span>,
    document.body
  ) : null;

  return (
    <span
      ref={triggerRef}
      className="relative inline-flex items-center ml-1.5"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children || (
        <HelpCircle className="w-3.5 h-3.5 text-zinc-500 hover:text-zinc-300 transition cursor-help" />
      )}
      {tooltip}
    </span>
  );
}

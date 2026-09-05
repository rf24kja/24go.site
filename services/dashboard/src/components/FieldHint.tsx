"use client";

import { ReactNode } from "react";
import { HelpCircle } from "./Icons";

interface FieldHintProps {
  hint: string;
  children?: ReactNode;
}

export function FieldHint({ hint, children }: FieldHintProps) {
  return (
    <span className="relative inline-flex items-center ml-1.5 group">
      {children || (
        <HelpCircle className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300 transition cursor-help" />
      )}
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-[100] max-w-[240px] text-center leading-relaxed">
        {hint}
        <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-800" />
      </span>
    </span>
  );
}

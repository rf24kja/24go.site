"use client";

import { ReactNode, useState } from "react";
import { HelpCircle } from "./Icons";

interface FieldHintProps {
  hint: string;
  children?: ReactNode;
}

export function FieldHint({ hint, children }: FieldHintProps) {
  const [show, setShow] = useState(false);

  return (
    <span className="relative inline-flex items-center ml-1.5">
      {children || (
        <button
          type="button"
          onMouseEnter={() => setShow(true)}
          onMouseLeave={() => setShow(false)}
          onClick={() => setShow(!show)}
          className="text-zinc-500 hover:text-zinc-300 transition"
        >
          <HelpCircle className="w-3.5 h-3.5" />
        </button>
      )}
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 text-xs text-zinc-200 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg whitespace-nowrap z-50 max-w-xs text-center">
          {hint}
          <span className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-zinc-800" />
        </span>
      )}
    </span>
  );
}

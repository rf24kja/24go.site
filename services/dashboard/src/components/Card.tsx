"use client";
import { ReactNode } from "react";

interface CardProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ title, description, children, className = "", hover = false }: CardProps) {
  return (
    <div className={`bg-zinc-900 border border-zinc-800 rounded-xl p-6 transition-all duration-300 ${
      hover ? "hover:border-zinc-700 hover:shadow-lg hover:shadow-zinc-900/50 hover:-translate-y-0.5" : ""
    } ${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-zinc-100">{title}</h3>
        {description && <p className="text-sm text-zinc-400 mt-1">{description}</p>}
      </div>
      {children}
    </div>
  );
}

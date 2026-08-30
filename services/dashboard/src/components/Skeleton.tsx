"use client";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-zinc-800 rounded animate-shimmer ${className}`} />
  );
}

export function TableSkeleton({ rows = 5, cols = 5, colWidths }: { rows?: number; cols?: number; colWidths?: string[] }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
      <div className="p-4 space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <Skeleton key={j} className={`h-4 ${colWidths?.[j] ?? "flex-1"}`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 space-y-2">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-7 w-24" />
        </div>
      ))}
    </div>
  );
}

export function KanbanSkeleton() {
  return (
    <div className="grid grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-3 space-y-2 min-h-[200px]">
          <Skeleton className="h-4 w-20" />
          {Array.from({ length: 2 }).map((_, j) => (
            <div key={j} className="bg-zinc-800 rounded-lg p-3 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

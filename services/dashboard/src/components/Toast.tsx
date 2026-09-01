"use client";

import { createContext, useContext, useState, useCallback, ReactNode } from "react";

type Toast = {
  id: number;
  message: string;
  type: "success" | "error" | "info";
};

interface ToastContextType {
  toast: (message: string, type?: Toast["type"]) => void;
}

const ToastContext = createContext<ToastContextType>({ toast: () => {} });

let _toastId = 0;

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((message: string, type: Toast["type"] = "info") => {
    const id = ++_toastId;
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container */}
      <div className="fixed bottom-4 right-4 z-[100] space-y-2 pointer-events-none">
        {toasts.map((t) => {
          const colors = {
            success: "bg-emerald-500/90 text-white",
            error: "bg-rose-500/90 text-white",
            info: "bg-zinc-700/90 text-zinc-100",
          };
          return (
            <div key={t.id}
              className={`px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg pointer-events-auto animate-toast-in ${colors[t.type]}`}>
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

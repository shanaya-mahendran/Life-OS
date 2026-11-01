"use client";

import { useEffect } from "react";
import { CircleCheck, TriangleAlert, X } from "lucide-react";

export interface ToastMessage {
  id: number;
  text: string;
  tone?: "success" | "error";
}

export function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-[calc(max(env(safe-area-inset-bottom,0px),12px)+5.5rem)] left-1/2 z-[110] flex w-[min(92vw,26rem)] -translate-x-1/2 flex-col gap-2 lg:bottom-6">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

function Toast({ toast, onDismiss }: { toast: ToastMessage; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4200);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  const error = toast.tone === "error";

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-[0.8rem] shadow-2xl backdrop-blur-xl ${
        error
          ? "border-rose-400/30 bg-rose-950/80 text-rose-100"
          : "border-emerald-400/25 bg-emerald-950/70 text-emerald-100"
      }`}
    >
      {error ? <TriangleAlert className="h-4 w-4 shrink-0" /> : <CircleCheck className="h-4 w-4 shrink-0" />}
      <span className="flex-1">{toast.text}</span>
      <button onClick={() => onDismiss(toast.id)} className="text-white/40 hover:text-white" aria-label="Dismiss">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export function Modal({ open, onClose, title, subtitle, children, footer, size = "md" }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);

    // Prevent background scrolling while modal is open
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  if (!open || !mounted) return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-end justify-center px-3 pb-[calc(max(env(safe-area-inset-bottom,0px),12px)+1rem)] sm:items-center sm:p-4"
    >
      <button
        className="fixed inset-0 -z-10 bg-black/75 backdrop-blur-md transition-opacity"
        onClick={onClose}
        aria-label="Close"
      />
      <div
        className={cn(
          "surface relative flex w-full max-h-[85dvh] flex-col animate-[rise_0.22s_cubic-bezier(0.22,1,0.36,1)] overflow-hidden shadow-2xl ring-1 ring-white/10",
          widths[size],
        )}
      >
        {(title || subtitle) && (
          <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
            <div>
              {title && <h3 className="font-display text-[1.05rem] font-semibold text-white">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-[0.74rem] text-white/40">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="btn btn-quiet p-1.5" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-white/[0.08] bg-[#0c081e]/95 px-5 py-3.5 backdrop-blur-md">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

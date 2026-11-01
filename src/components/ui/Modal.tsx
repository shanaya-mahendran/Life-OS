"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    if (!open) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center px-3 pb-3 sm:items-center sm:pb-0">
      <button className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} aria-label="Close" />
      <div
        className={cn(
          "surface relative w-full animate-[rise_0.22s_cubic-bezier(0.22,1,0.36,1)] overflow-hidden",
          widths[size],
        )}
      >
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
            <div>
              {title && <h3 className="font-display text-[1.05rem] font-semibold text-white">{title}</h3>}
              {subtitle && <p className="mt-0.5 text-[0.74rem] text-white/40">{subtitle}</p>}
            </div>
            <button onClick={onClose} className="btn btn-quiet p-1.5" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="max-h-[72vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && <div className="border-t border-white/[0.06] px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

import type { ReactNode } from "react";
import { withAlpha } from "@/lib/utils";

interface PageBannerProps {
  icon: ReactNode;
  title: string;
  subtitle: string;
  accent?: string;
  aside?: ReactNode;
}

export function PageBanner({ icon, title, subtitle, accent = "#7c5cff", aside }: PageBannerProps) {
  return (
    <section
      className="relative overflow-hidden rounded-2xl border p-4 sm:p-5"
      style={{
        borderColor: withAlpha(accent, 0.22),
        background: `linear-gradient(115deg, ${withAlpha(accent, 0.22)} 0%, rgba(20,14,38,0.92) 45%, rgba(12,8,24,0.96) 100%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full blur-3xl"
        style={{ backgroundColor: withAlpha(accent, 0.35) }}
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-1/2 opacity-40"
        style={{
          background: `radial-gradient(ellipse at 80% 120%, ${withAlpha(accent, 0.55)}, transparent 62%)`,
        }}
      />

      <div className="relative flex flex-wrap items-center gap-3.5">
        <span
          className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border text-white"
          style={{
            borderColor: withAlpha(accent, 0.4),
            backgroundColor: withAlpha(accent, 0.28),
            boxShadow: `0 12px 28px -16px ${withAlpha(accent, 0.9)}`,
          }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-[1.35rem] font-semibold leading-tight tracking-tight text-white sm:text-[1.55rem]">
            {title}
          </h1>
          <p className="mt-0.5 text-[0.78rem] text-white/45">{subtitle}</p>
        </div>
        {aside && <div className="ml-auto w-full sm:w-auto">{aside}</div>}
      </div>
    </section>
  );
}

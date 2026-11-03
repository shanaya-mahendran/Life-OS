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
      className="relative rounded-xl border border-white/[0.08] bg-[var(--bg-surface)] p-4 shadow-sm sm:p-5"
      style={{
        borderColor: withAlpha(accent, 0.2),
      }}
    >
      <div className="relative flex flex-wrap items-center gap-3.5">
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border"
          style={{
            borderColor: withAlpha(accent, 0.24),
            backgroundColor: withAlpha(accent, 0.12),
            color: accent,
          }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <h1 className="font-display text-[1.375rem] font-semibold leading-tight tracking-tight text-white sm:text-[1.5rem]">
            {title}
          </h1>
          <p className="mt-1 text-sm leading-5 text-white/65">{subtitle}</p>
        </div>
        {aside && <div className="ml-auto w-full sm:w-auto">{aside}</div>}
      </div>
    </section>
  );
}

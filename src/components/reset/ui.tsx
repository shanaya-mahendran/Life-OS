import type { ReactNode } from "react";
import {
  Anchor,
  Ban,
  Flame,
  ShieldCheck,
  Sunrise,
  Target,
  type LucideIcon,
} from "lucide-react";
import { cn, withAlpha } from "@/lib/utils";
import { KIND_META, type ResetKind } from "@/lib/reset/constants";

const KIND_ICONS: Record<ResetKind, LucideIcon> = {
  cut: Ban,
  anchor: Anchor,
  routine: Sunrise,
  nonnegotiable: ShieldCheck,
  goal: Target,
  challenge: Flame,
};

export function KindIcon({ kind, size = 16, className }: { kind: string; size?: number; className?: string }) {
  const Icon = KIND_ICONS[kind as ResetKind] ?? Target;
  return <Icon className={className} size={size} strokeWidth={1.9} aria-hidden />;
}

export function kindTone(kind: string): string {
  const tones: Record<string, string> = {
    cut: "#f472b6",
    anchor: "#a78bfa",
    routine: "#38bdf8",
    nonnegotiable: "#2dd4bf",
    goal: "#34d399",
    challenge: "#fbbf24",
  };
  return tones[kind] ?? "#a78bfa";
}

export function KindChip({ kind, className }: { kind: string; className?: string }) {
  const accent = kindTone(kind);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.1em]",
        className,
      )}
      style={{
        borderColor: withAlpha(accent, 0.35),
        backgroundColor: withAlpha(accent, 0.12),
        color: withAlpha(accent, 0.95),
      }}
    >
      <KindIcon kind={kind} size={9} />
      {KIND_META[kind as ResetKind]?.label ?? kind}
    </span>
  );
}

export function StatCard({
  label,
  value,
  caption,
  icon,
  accent = "#8b5cf6",
  className,
}: {
  label: string;
  value: ReactNode;
  caption?: string;
  icon?: ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-2xl border p-3.5", className)}
      style={{
        borderColor: withAlpha(accent, 0.2),
        background: `linear-gradient(140deg, ${withAlpha(accent, 0.12)}, rgba(16,11,30,0.92) 70%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full blur-2xl"
        style={{ backgroundColor: withAlpha(accent, 0.2) }}
      />
      <div className="relative flex items-center gap-2">
        {icon && (
          <span
            className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border"
            style={{
              borderColor: withAlpha(accent, 0.28),
              backgroundColor: withAlpha(accent, 0.16),
              color: accent,
            }}
          >
            {icon}
          </span>
        )}
        <span className="text-[0.58rem] font-semibold uppercase tracking-[0.14em] text-white/35">{label}</span>
      </div>
      <div className="relative mt-2 font-display text-[1.25rem] font-bold leading-none text-white">{value}</div>
      {caption && <p className="relative mt-1.5 text-[0.65rem] leading-relaxed text-white/35">{caption}</p>}
    </div>
  );
}

export function ProgressBar({
  value,
  accent = "#8b5cf6",
  className,
  height = "h-1.5",
}: {
  value: number;
  accent?: string;
  className?: string;
  height?: string;
}) {
  const percent = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={cn("w-full overflow-hidden rounded-full bg-white/[0.08]", height, className)}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${Math.max(percent > 0 ? 3 : 0, percent)}%`,
          background: `linear-gradient(90deg, ${accent}, ${withAlpha(accent, 0.55)})`,
          boxShadow: `0 0 10px ${withAlpha(accent, 0.5)}`,
        }}
      />
    </div>
  );
}

const RESULT_COLOR: Record<string, string> = {
  done: "#34d399",
  skipped: "#fbbf24",
  missed: "#fb7185",
};

export function HeatDots({
  recent,
  accent = "#34d399",
  className,
}: {
  recent: { dateKey: string; result: string | null }[];
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1", className)}>
      {recent.map((day) => {
        const color = day.result ? RESULT_COLOR[day.result] ?? accent : null;
        return (
          <span
            key={day.dateKey}
            title={`${day.dateKey} · ${day.result ?? "no check-in"}`}
            className="h-3 w-3 rounded-[4px] border transition"
            style={{
              borderColor: color ? withAlpha(color, 0.4) : "rgba(255,255,255,0.06)",
              backgroundColor: color ? withAlpha(color, 0.32) : "rgba(255,255,255,0.035)",
              boxShadow: day.result === "done" ? `0 0 7px ${withAlpha(color ?? accent, 0.35)}` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-5 py-10 text-center">
      <span className="mb-2 grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-white/35">
        {icon}
      </span>
      <p className="text-[0.9rem] font-semibold text-white/75">{title}</p>
      <p className="mt-1 max-w-sm text-[0.75rem] leading-relaxed text-white/35">{body}</p>
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}

export function SectionHeading({
  icon,
  title,
  subtitle,
  aside,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  aside?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex items-start gap-2.5">
        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-violet-200">
          {icon}
        </span>
        <div>
          <h2 className="font-display text-[0.98rem] font-semibold text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[0.68rem] leading-relaxed text-white/35">{subtitle}</p>}
        </div>
      </div>
      {aside}
    </div>
  );
}

export function LimitMeter({
  label,
  used,
  limit,
  accent = "#8b5cf6",
}: {
  label: string;
  used: number;
  limit: number;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[6.8rem] shrink-0 text-[0.66rem] font-medium text-white/45">{label}</span>
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(100, (used / limit) * 100)}%`,
            backgroundColor: used >= limit ? "#fb7185" : accent,
          }}
        />
      </div>
      <span className="w-6 text-right text-[0.63rem] font-semibold text-white/40">
        {used}/{limit}
      </span>
    </div>
  );
}

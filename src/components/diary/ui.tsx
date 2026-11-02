import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, Flame, LayoutDashboard, Settings2, Sun } from "lucide-react";
import { cn, withAlpha } from "@/lib/utils";
import { DIARY_ACCENT } from "@/lib/diary/constants";

/* -------------------------------------------------------------------------- */
/* Tabs                                                                       */
/* -------------------------------------------------------------------------- */

const TABS = [
  { href: "/diary", label: "Journal", icon: LayoutDashboard },
  { href: "/diary/burn", label: "Burn Diary", icon: Flame },
  { href: "/diary/stories", label: "Stories", icon: BookOpen },
  { href: "/diary/settings", label: "Settings", icon: Settings2 },
];

export function DiaryTabs({ active }: { active: string }) {
  return (
    <nav className="no-scrollbar -mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-0.5">
      {TABS.map((tab) => {
        const isActive = tab.href === active;
        const Icon = tab.icon;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[0.72rem] font-semibold transition",
              isActive
                ? "border-amber-400/35 bg-amber-500/15 text-amber-100"
                : "border-white/[0.07] bg-white/[0.025] text-white/45 hover:border-white/15 hover:text-white/80",
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

/* -------------------------------------------------------------------------- */
/* Page header                                                                */
/* -------------------------------------------------------------------------- */

export function DiaryHeading({
  title,
  subtitle,
  aside,
  icon,
}: {
  title: string;
  subtitle: string;
  aside?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-amber-200"
          style={{ borderColor: withAlpha(DIARY_ACCENT, 0.3), backgroundColor: withAlpha(DIARY_ACCENT, 0.12) }}
        >
          {icon ?? <Sun className="h-4 w-4" />}
        </span>
        <div>
          <h1 className="font-display text-[1.15rem] font-bold leading-tight text-white">{title}</h1>
          <p className="mt-0.5 max-w-xl text-[0.72rem] leading-relaxed text-white/35">{subtitle}</p>
        </div>
      </div>
      {aside}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Stamps                                                                     */
/* -------------------------------------------------------------------------- */

export function StampRow({ stamps, size = "md" }: { stamps: string[]; size?: "sm" | "md" | "lg" }) {
  if (!stamps.length) return null;
  const sizing = size === "lg" ? "h-9 w-9 text-[1.05rem]" : size === "sm" ? "h-6 w-6 text-[0.72rem]" : "h-7 w-7 text-[0.85rem]";

  return (
    <div className="flex items-center gap-1.5">
      {stamps.map((stamp, index) => (
        <span
          key={`${stamp}-${index}`}
          className={cn(
            "grid place-items-center rounded-lg border border-white/10 bg-white/[0.06] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
            sizing,
          )}
          aria-hidden
        >
          {stamp}
        </span>
      ))}
    </div>
  );
}

export function StampGrid({ stamps }: { stamps: { emoji: string; count: number }[] }) {
  if (!stamps.length) {
    return (
      <p className="rounded-xl border border-dashed border-white/10 px-3 py-5 text-center text-[0.7rem] leading-relaxed text-white/30">
        The stamp collection starts with your first entry. Three emojis land on every finished page.
      </p>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {stamps.map((stamp) => (
        <span
          key={stamp.emoji}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] px-2.5 py-1.5"
        >
          <span className="text-[1.05rem] leading-none">{stamp.emoji}</span>
          <span className="text-[0.62rem] font-semibold text-white/40">×{stamp.count}</span>
        </span>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Cards                                                                      */
/* -------------------------------------------------------------------------- */

export function NoteCard({
  label,
  children,
  accent = DIARY_ACCENT,
  action,
}: {
  label: string;
  children: ReactNode;
  accent?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className="rounded-2xl border p-3.5"
      style={{
        borderColor: withAlpha(accent, 0.22),
        background: `linear-gradient(140deg, ${withAlpha(accent, 0.1)}, rgba(12,8,22,0.9) 65%)`,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[0.58rem] font-bold uppercase tracking-[0.14em]" style={{ color: withAlpha(accent, 0.85) }}>
          {label}
        </p>
        {action}
      </div>
      <div className="mt-2 text-[0.78rem] leading-relaxed text-white/65">{children}</div>
    </div>
  );
}

export function DiaryEmpty({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 px-5 py-9 text-center">
      <span className="mb-2 grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-amber-200/60">
        <BookOpen className="h-4 w-4" />
      </span>
      <p className="text-[0.88rem] font-semibold text-white/75">{title}</p>
      <p className="mt-1 max-w-sm text-[0.73rem] leading-relaxed text-white/35">{body}</p>
      {action && <div className="mt-3.5">{action}</div>}
    </div>
  );
}

export function formatDiaryDate(value: string): string {
  const date = new Date(value);
  return date.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
}

export function excerpt(body: string, length = 120): string {
  const clean = body.replace(/\s+/g, " ").trim();
  return clean.length > length ? `${clean.slice(0, length)}…` : clean;
}
